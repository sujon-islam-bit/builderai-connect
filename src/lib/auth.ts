import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";

/**
 * Owner login for the dashboard. There is exactly one owner account and
 * it lives in env, not the database: OWNER_EMAIL + OWNER_PASSWORD_HASH
 * (a bcrypt hash — the plain password is never stored or logged).
 * When either value is unset the login is NOT configured and the
 * dashboard stays locked; there is no open-access fallback.
 */

export function ownerLoginConfigured(): boolean {
  return (process.env.OWNER_EMAIL ?? "").trim().length > 0 && (process.env.OWNER_PASSWORD_HASH ?? "").trim().length > 0;
}

export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? "").trim();
}

export async function verifyOwnerCredentials(email: string, password: string): Promise<boolean> {
  if (!ownerLoginConfigured()) return false;
  if (email.trim().toLowerCase() !== ownerEmail().toLowerCase()) return false;
  try {
    return await bcrypt.compare(password, process.env.OWNER_PASSWORD_HASH ?? "");
  } catch {
    return false;
  }
}

export async function getOwnerSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
