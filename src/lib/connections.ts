import "server-only";

import type { Connection } from "@/generated/prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { providerClientId, providerClientSecret, type OAuth2ProviderConfig } from "@/lib/providers";

/** The decrypted token bundle stored in Connection.data. */
export type TokenData = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds when the access token stops working. */
  expiresAt: number;
  scope: string;
};

export function parseTokenData(connection: Connection): TokenData | null {
  const plain = decryptSecret(connection.data);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as TokenData;
    if (!parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** The decrypted key bundle stored in Connection.data for API_KEY providers. */
export type ApiKeyData = {
  apiKey: string;
};

export function parseApiKeyData(connection: Connection): ApiKeyData | null {
  const plain = decryptSecret(connection.data);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as ApiKeyData;
    if (!parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveConnectionTokens(connectionId: string, tokens: TokenData): Promise<void> {
  await prisma.connection.update({
    where: { id: connectionId },
    data: { data: encryptSecret(JSON.stringify(tokens)) },
  });
}

type TokenEndpointResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

async function tokenRequest(
  provider: OAuth2ProviderConfig,
  params: Record<string, string>,
): Promise<TokenEndpointResponse | null> {
  try {
    const res = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: providerClientId(provider),
        client_secret: providerClientSecret(provider),
        ...params,
      }),
    });
    return (await res.json()) as TokenEndpointResponse;
  } catch {
    return null;
  }
}

/** Exchange an authorization code for the first token bundle. */
export async function exchangeCode(
  provider: OAuth2ProviderConfig,
  code: string,
  redirectUri: string,
): Promise<TokenData | null> {
  const body = await tokenRequest(provider, {
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (!body?.access_token) return null;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? "",
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    scope: body.scope ?? "",
  };
}

/**
 * A usable token bundle for a connection: refreshes the access token
 * (and saves the new bundle) when the stored one has expired.
 * Returns null when the tokens cannot be read or refreshed.
 */
export async function usableTokens(provider: OAuth2ProviderConfig, connection: Connection): Promise<TokenData | null> {
  const tokens = parseTokenData(connection);
  if (!tokens) return null;
  if (tokens.expiresAt > Date.now() + 30_000) return tokens;
  if (!tokens.refreshToken) return null;
  const body = await tokenRequest(provider, {
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });
  if (!body?.access_token) return null;
  const refreshed: TokenData = {
    accessToken: body.access_token,
    // Google usually does not send a new refresh token — keep the old one.
    refreshToken: body.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    scope: body.scope ?? tokens.scope,
  };
  await saveConnectionTokens(connection.id, refreshed);
  return refreshed;
}
