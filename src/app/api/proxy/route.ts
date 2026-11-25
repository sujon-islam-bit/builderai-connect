import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { parseApiKeyData, usableTokens } from "@/lib/connections";
import { prisma } from "@/lib/prisma";
import { getProvider, providerApiBaseUrls } from "@/lib/providers";

/**
 * POST /api/proxy — how BuilderAI uses a connection.
 *
 * Header: x-connect-key must equal CONNECT_API_KEY.
 * Body: { connectionId, method, path, body? }
 *   OAuth2 providers: path is a full URL under the provider's API base
 *   (its default base or any service's own base — e.g. Google Sheets
 *   lives on sheets.googleapis.com), or a "/..." path joined onto the
 *   default base, and the stored access token goes in the
 *   Authorization header.
 *   API_KEY providers: path is a plain "/..." path only, appended to
 *   the provider's key URL template (e.g. /bot<token>) — the key rides
 *   in the upstream URL, never in a header or a response.
 *   Either way, calls can never leave the provider's API.
 * Response: { status, data } mirroring the upstream response.
 * Tokens are used here and never appear in any response.
 */

function keyMatches(given: string | null): boolean {
  const expected = process.env.CONNECT_API_KEY ?? "";
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!keyMatches(request.headers.get("x-connect-key"))) {
    return NextResponse.json({ error: "Missing or wrong connect key." }, { status: 401 });
  }

  let payload: { connectionId?: string; method?: string; path?: string; body?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { connectionId, method = "GET", path } = payload;
  if (!connectionId || !path) {
    return NextResponse.json({ error: "connectionId and path are required." }, { status: 400 });
  }

  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) return NextResponse.json({ error: "Unknown connection." }, { status: 404 });

  const provider = getProvider(connection.provider);
  if (!provider) return NextResponse.json({ error: "Unknown provider for this connection." }, { status: 400 });

  let url: string;
  const headers: Record<string, string> = {};
  if (provider.authMode === "API_KEY") {
    // The key rides inside the upstream URL (e.g. Telegram's
    // /bot<token>/…), so only plain in-API paths are accepted here:
    // no absolute URLs, no protocol-relative "//host", no ".." escapes.
    // The built URL is never returned or logged — it holds the key.
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("://") || path.split("/").includes("..")) {
      return NextResponse.json({ error: "path must be a plain path inside the provider's API (like /getMe)." }, { status: 400 });
    }
    const keyData = parseApiKeyData(connection);
    if (!keyData) {
      return NextResponse.json(
        { error: "This connection's key could not be read — the user may need to connect again." },
        { status: 502 },
      );
    }
    url = `${provider.apiKeyUrlTemplate.replace("{apiKey}", keyData.apiKey)}${path}`;
  } else {
    // A full URL is allowed when it is one of the provider's API bases
    // (default or per-service) or a path under one. The match must end
    // at a "/" boundary so a look-alike host such as
    // "sheets.googleapis.com.evil.example" never passes.
    const allowedBases = providerApiBaseUrls(provider);
    if (allowedBases.some((base) => path === base || path.startsWith(`${base}/`))) url = path;
    else if (path.startsWith("/")) url = `${provider.apiBaseUrl}${path}`;
    else return NextResponse.json({ error: "path must stay inside the provider's API base URL." }, { status: 400 });

    const tokens = await usableTokens(provider, connection);
    if (!tokens) {
      return NextResponse.json(
        { error: "This connection's tokens could not be read or refreshed — the user may need to connect again." },
        { status: 502 },
      );
    }
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        ...headers,
        ...(payload.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
    });
  } catch {
    return NextResponse.json({ error: "The provider's API could not be reached." }, { status: 502 });
  }

  const text = await upstream.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Upstream answered with non-JSON text — pass it through as-is.
  }
  return NextResponse.json({ status: upstream.status, data });
}
