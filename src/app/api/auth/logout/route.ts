import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

/** POST /api/auth/logout — clears the owner session cookie. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
