import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed owner-session tokens for the dashboard login.
 *
 * Shape: "<base64url payload>.<base64url HMAC-SHA256>", the same pattern
 * as the OAuth state in oauth-state.ts. Payload: { sub, exp } where sub
 * is the owner email and exp is a unix-seconds expiry (7 days from
 * issue). Signing key: SESSION_SECRET, falling back to
 * CONNECT_ENCRYPTION_KEY so a deployment that already has the token-lock
 * key works without a second secret. This module is pure (no next/*
 * imports) so both the proxy and server components can use it.
 */

export const SESSION_COOKIE = "connect_owner_session";
export const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

export type SessionPayload = {
  /** Owner email the session was issued to. */
  sub: string;
  /** Expiry, unix seconds. */
  exp: number;
};

function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? process.env.CONNECT_ENCRYPTION_KEY ?? "";
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(email: string): string {
  const payload: SessionPayload = {
    sub: email,
    exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(raw: string | undefined | null): SessionPayload | null {
  if (!raw || !sessionSecret()) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.sub || typeof parsed.exp !== "number") return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
