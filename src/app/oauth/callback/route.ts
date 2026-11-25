import { NextResponse, type NextRequest } from "next/server";

import { appUrl } from "@/lib/config";
import { exchangeCode } from "@/lib/connections";
import { encryptSecret } from "@/lib/crypto";
import { messagePage } from "@/lib/message-page";
import { decodeState } from "@/lib/oauth-state";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/providers";

/**
 * GET /oauth/callback?code=…&state=…
 *
 * The provider sends the user back here after sign-in. Verifies the
 * signed state + nonce cookie, exchanges the code for tokens, saves the
 * connection (tokens encrypted), and returns the user to the return URL
 * from the connect link.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const providerError = query.get("error");
  if (providerError) {
    return messagePage(
      "Connection was not finished",
      `The sign-in page sent back an error (${providerError}). Nothing was connected — you can close this tab and try again from BuilderAI.`,
    );
  }

  const code = query.get("code");
  const state = decodeState(query.get("state"));
  if (!code || !state) {
    return messagePage("This link has expired", "The connect link could not be checked. Start again from the connect button in BuilderAI.", 400);
  }

  const nonceCookie = request.cookies.get("connect_oauth_nonce")?.value;
  if (!nonceCookie || nonceCookie !== state.n) {
    return messagePage("This link has expired", "The connect link could not be checked. Start again from the connect button in BuilderAI.", 400);
  }

  const provider = getProvider(state.p);
  if (!provider) return messagePage("Unknown app", "This connect link names an app this service does not know.", 404);
  if (provider.authMode !== "OAUTH2") {
    return messagePage("Wrong door", "This app does not use sign-in — it connects with a key instead. Start again from the connect button in BuilderAI.", 400);
  }

  const redirectUri = `${appUrl()}/oauth/callback`;
  const tokens = await exchangeCode(provider, code, redirectUri);
  if (!tokens) {
    return messagePage(
      "Sign-in did not complete",
      "The sign-in code could not be exchanged for access. Nothing was connected — try again from BuilderAI.",
      502,
    );
  }
  if (!tokens.scope) tokens.scope = query.get("scope") ?? "";

  // The connected account's email (display only) from Google userinfo.
  let accountEmail: string | null = null;
  try {
    const info = await fetch(`${provider.apiBaseUrl}/oauth2/v2/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (info.ok) {
      const json = (await info.json()) as { email?: string };
      accountEmail = json.email ?? null;
    }
  } catch {
    accountEmail = null;
  }

  const connection = await prisma.connection.create({
    data: {
      provider: provider.id,
      externalUserId: state.u,
      accountEmail,
      data: encryptSecret(JSON.stringify(tokens)),
    },
  });

  const target = state.r ? new URL(state.r, appUrl()) : new URL("/connections", appUrl());
  target.searchParams.set("status", "connected");
  target.searchParams.set("provider", provider.id);
  target.searchParams.set("connection", connection.id);

  const response = NextResponse.redirect(target);
  response.cookies.set("connect_oauth_nonce", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
