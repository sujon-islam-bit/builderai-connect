import { NextResponse, type NextRequest } from "next/server";

import { ownerEmail, ownerLoginConfigured, verifyOwnerCredentials } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, SESSION_LIFETIME_SECONDS } from "@/lib/session";

/**
 * POST /api/auth/login — owner sign-in for the dashboard.
 * Body: { email, password }. On success sets the signed, httpOnly
 * session cookie (7 days). The plain password is only ever compared
 * against the bcrypt hash in env — never stored, never logged.
 */
export async function POST(request: NextRequest) {
  if (!ownerLoginConfigured()) {
    return NextResponse.json({ error: "Owner login is not configured yet." }, { status: 503 });
  }

  let payload: { email?: string; password?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const email = payload.email ?? "";
  const password = payload.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const ok = await verifyOwnerCredentials(email, password);
  if (!ok) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(ownerEmail()), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
