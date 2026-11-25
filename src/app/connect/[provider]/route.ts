import { NextResponse, type NextRequest } from "next/server";

import { appUrl } from "@/lib/config";
import { encryptSecret } from "@/lib/crypto";
import { messagePage, tokenFormPage } from "@/lib/message-page";
import { decodeState, encodeState, newNonce } from "@/lib/oauth-state";
import { prisma } from "@/lib/prisma";
import {
  getProvider,
  providerClientId,
  providerConfigured,
  providerScopes,
  type ApiKeyProviderConfig,
} from "@/lib/providers";

/**
 * /connect/[provider]?user=<builderAiUserId>&return_url=<url>
 *
 * OAuth2 providers (GET): signs a state, sets the nonce cookie and
 * redirects to the provider's authorization page. The provider sends
 * the user back to /oauth/callback, which saves the connection and
 * returns the user to return_url.
 *
 * API_KEY providers (GET + POST): GET renders a short form (the user
 * pastes a key, e.g. a Telegram bot token); POST verifies the key with
 * the provider, saves the connection (key encrypted) and returns the
 * user to return_url. The form carries the same signed state + nonce
 * cookie protection as the OAuth flow.
 */

const NONCE_COOKIE = "connect_oauth_nonce";

function missingUserPage() {
  return messagePage(
    "Who is connecting?",
    "This connect link is missing the user id. BuilderAI adds it automatically — open the connect button from inside BuilderAI.",
    400,
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) return messagePage("Unknown app", "This connect link names an app this service does not know.", 404);

  const user = request.nextUrl.searchParams.get("user")?.trim() ?? "";
  if (!user) return missingUserPage();

  const returnUrl = request.nextUrl.searchParams.get("return_url")?.trim() ?? "";
  const nonce = newNonce();
  const state = encodeState({ p: provider.id, u: user, r: returnUrl, n: nonce });

  if (provider.authMode === "API_KEY") {
    const response = telegramForm(provider, state);
    response.headers.set("Set-Cookie", nonceCookie(nonce));
    return response;
  }

  if (!providerConfigured(provider)) {
    return messagePage(
      `${provider.displayName} is not configured yet`,
      `This service does not have its ${provider.displayName} sign-in keys yet (the ${provider.clientIdEnv} and ${provider.clientSecretEnv} settings are empty), so nobody can connect a ${provider.displayName} account right now. Once the keys are added, this same link will work.`,
    );
  }

  const authParams = new URLSearchParams({
    client_id: providerClientId(provider),
    redirect_uri: `${appUrl()}/oauth/callback`,
    scope: providerScopes(provider).join(" "),
    state,
    ...provider.authorizationParams,
  });

  const response = NextResponse.redirect(`${provider.authorizationUrl}?${authParams.toString()}`);
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}

function nonceCookie(nonce: string): string {
  return `${NONCE_COOKIE}=${nonce}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`;
}

/** The Telegram connect form. Re-rendered with an error line when a token is refused. */
function telegramForm(provider: ApiKeyProviderConfig, state: string, error?: string): Response {
  return tokenFormPage({
    title: `Connect ${provider.displayName}`,
    steps: [
      "Open Telegram and talk to @BotFather.",
      "Send /newbot and follow the steps to create your bot.",
      "BotFather gives you a token — copy it and paste it below.",
    ],
    note: "The token is stored locked and never shown again.",
    state,
    error,
    fieldLabel: "Bot token",
    placeholder: "1234567890:ABCdef…",
    buttonLabel: "Connect this bot",
  });
}

/**
 * Verify a Telegram bot token the catalog's way: GET /getMe with the
 * token in the URL. Returns the bot's username on success, null when
 * Telegram refuses the token, and "unreachable" when the call itself
 * fails. The token is only ever sent to Telegram — never logged.
 */
async function verifyTelegramToken(token: string): Promise<{ username: string | null } | "unreachable" | null> {
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  } catch {
    return "unreachable";
  }
  if (!res.ok) return null;
  try {
    const json = (await res.json()) as { ok?: boolean; result?: { username?: string } };
    if (!json.ok) return null;
    return { username: json.result?.username ?? null };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) return messagePage("Unknown app", "This connect link names an app this service does not know.", 404);
  if (provider.authMode !== "API_KEY") {
    return messagePage("Nothing to submit here", "This app connects with sign-in, not a form. Start again from the connect button in BuilderAI.", 405);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return messagePage("That form did not arrive", "The form could not be read. Start again from the connect button in BuilderAI.", 400);
  }

  const state = decodeState(form.get("state")?.toString() ?? null);
  if (!state || state.p !== provider.id) {
    return messagePage("This form has expired", "The connect form could not be checked. Start again from the connect button in BuilderAI.", 400);
  }
  const nonceCookie = request.cookies.get(NONCE_COOKIE)?.value;
  if (!nonceCookie || nonceCookie !== state.n) {
    return messagePage("This form has expired", "The connect form could not be checked. Start again from the connect button in BuilderAI.", 400);
  }

  const token = form.get("token")?.toString().trim() ?? "";
  if (!token) {
    return telegramForm(provider, form.get("state")!.toString(), "Paste the bot token first — BotFather gave it to you when you created the bot.");
  }

  const verified = await verifyTelegramToken(token);
  if (verified === "unreachable") {
    return telegramForm(provider, form.get("state")!.toString(), "Telegram could not be reached just now — wait a moment and try again.");
  }
  if (!verified) {
    return telegramForm(provider, form.get("state")!.toString(), "Telegram did not accept this token — check it and try again.");
  }

  const connection = await prisma.connection.create({
    data: {
      provider: provider.id,
      externalUserId: state.u,
      accountEmail: verified.username ? `@${verified.username}` : null,
      data: encryptSecret(JSON.stringify({ apiKey: token })),
    },
  });

  const target = state.r ? new URL(state.r, appUrl()) : new URL("/connections", appUrl());
  target.searchParams.set("status", "connected");
  target.searchParams.set("provider", provider.id);
  target.searchParams.set("connection", connection.id);

  const response = NextResponse.redirect(target);
  response.cookies.set(NONCE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
