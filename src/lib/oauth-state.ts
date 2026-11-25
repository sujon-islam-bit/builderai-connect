import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * OAuth `state` for the connect flow. The state carries everything the
 * callback needs (provider, BuilderAI user id, return URL, nonce) and is
 * HMAC-signed with this service's own key, so it cannot be forged or
 * edited in the browser. A matching nonce cookie is also set at connect
 * time and checked at callback time.
 */

export type OAuthState = {
  /** Provider id ("google"). */
  p: string;
  /** BuilderAI user id the connection will belong to. */
  u: string;
  /** Where to send the user after connecting ("" = the /connections page). */
  r: string;
  /** Random nonce, mirrored in the connect_oauth_nonce cookie. */
  n: string;
};

function hmacKey(): string {
  return process.env.CONNECT_ENCRYPTION_KEY ?? "";
}

function sign(payload: string): string {
  return createHmac("sha256", hmacKey()).update(payload).digest("base64url");
}

export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

export function encodeState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeState(raw: string | null): OAuthState | null {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (!parsed.p || !parsed.u || !parsed.n) return null;
    return parsed;
  } catch {
    return null;
  }
}
