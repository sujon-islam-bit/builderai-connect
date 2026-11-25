import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";

import { OWNER_EMAIL_SETTING, OWNER_PASSWORD_HASH_SETTING, ownerLoginConfigured } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, SESSION_LIFETIME_SECONDS } from "@/lib/session";

/**
 * POST /api/auth/setup — the one-time first-run owner setup.
 * Body: { email, password, confirmPassword }.
 *
 * This route exists so the owner can set a dashboard password from
 * the site itself (the /login page shows the setup form while no
 * owner is configured) instead of hand-generating a bcrypt hash for
 * env. It ONLY works while no owner is configured anywhere — the
 * configuration is re-checked inside the handler, and once an owner
 * exists (env or database) every further call is refused with 409.
 *
 * On success the email + a bcrypt hash (cost 10) are saved in the
 * Setting table — the plain password is never stored or logged — and
 * the owner is signed in with the same session cookie the login
 * route issues.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

export async function POST(request: NextRequest) {
  if (await ownerLoginConfigured()) {
    return NextResponse.json({ error: "Owner login is already set up." }, { status: 409 });
  }

  let payload: { email?: string; password?: string; confirmPassword?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const email = (payload.email ?? "").trim();
  const password = payload.password ?? "";
  const confirmPassword = payload.confirmPassword ?? "";

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "The two passwords do not match." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // `create` (not upsert) inside one transaction: if a racing setup
    // already wrote these keys, the primary-key conflict aborts the
    // transaction and nothing is overwritten.
    await prisma.$transaction([
      prisma.setting.create({ data: { key: OWNER_EMAIL_SETTING, value: email } }),
      prisma.setting.create({ data: { key: OWNER_PASSWORD_HASH_SETTING, value: passwordHash } }),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Owner login is already set up." }, { status: 409 });
    }
    throw error;
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(email), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
