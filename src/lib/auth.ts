import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";
import { getSettings } from "@/lib/settings";

/**
 * Owner login for the dashboard. There is exactly one owner account,
 * resolved from two places, in this order:
 *
 *   1. env — OWNER_EMAIL + OWNER_PASSWORD_HASH (a bcrypt hash; the
 *      plain password is never stored or logged). Set by whoever runs
 *      the deployment; always wins when both values are present.
 *   2. database — the `owner_email` + `owner_password_hash` rows in
 *      the Setting table, written once by the first-run setup page on
 *      /login (POST /api/auth/setup) when env does not configure an
 *      owner. This is how the owner sets a password from the site
 *      itself, with no env editing and no hash-generator tools.
 *
 * When neither place has both values the login is NOT configured and
 * the dashboard stays locked; there is no open-access fallback.
 */

export const OWNER_EMAIL_SETTING = "owner_email";
export const OWNER_PASSWORD_HASH_SETTING = "owner_password_hash";

export type OwnerConfig = {
  email: string;
  /** bcrypt hash of the owner's password — never the plain password. */
  passwordHash: string;
  source: "env" | "db";
};

function envOwnerConfig(): OwnerConfig | null {
  const email = (process.env.OWNER_EMAIL ?? "").trim();
  const passwordHash = (process.env.OWNER_PASSWORD_HASH ?? "").trim();
  if (!email || !passwordHash) return null;
  return { email, passwordHash, source: "env" };
}

/**
 * The one place owner credentials are resolved. Env takes precedence;
 * the database settings are the fallback. Returns null when the owner
 * login is not configured anywhere yet.
 */
export async function getOwnerConfig(): Promise<OwnerConfig | null> {
  const fromEnv = envOwnerConfig();
  if (fromEnv) return fromEnv;
  const settings = await getSettings([OWNER_EMAIL_SETTING, OWNER_PASSWORD_HASH_SETTING]);
  const email = (settings.get(OWNER_EMAIL_SETTING) ?? "").trim();
  const passwordHash = (settings.get(OWNER_PASSWORD_HASH_SETTING) ?? "").trim();
  if (!email || !passwordHash) return null;
  return { email, passwordHash, source: "db" };
}

export async function ownerLoginConfigured(): Promise<boolean> {
  return (await getOwnerConfig()) !== null;
}

/**
 * Checks an email + plain password against the resolved owner config.
 * Returns the canonical owner email on success (the session token is
 * issued to it), null on any failure.
 */
export async function verifyOwnerCredentials(email: string, password: string): Promise<string | null> {
  const config = await getOwnerConfig();
  if (!config) return null;
  if (email.trim().toLowerCase() !== config.email.toLowerCase()) return null;
  try {
    return (await bcrypt.compare(password, config.passwordHash)) ? config.email : null;
  } catch {
    return null;
  }
}

export async function getOwnerSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
