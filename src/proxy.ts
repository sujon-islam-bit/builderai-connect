import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Dashboard gate. Every UI page requires a valid owner session cookie;
 * without one the request is redirected to /login. The matcher covers
 * all paths EXCEPT the ones that must stay public by design:
 *   /login          — the sign-in page itself
 *   /connect/*      — end users connecting their app accounts
 *   /oauth/callback — the provider redirect target
 *   /api/*          — machine endpoints (the proxy keeps its own
 *                     x-connect-key check; /api/auth/* runs the login)
 * Any future dashboard page is protected automatically because it does
 * not live under one of those prefixes.
 */
export function proxy(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Each public prefix must end at a path boundary ("/" or end), so
  // "/connect/..." stays public while "/connections" stays protected.
  matcher: ["/((?!login(?:/|$)|connect(?:/|$)|oauth(?:/|$)|api(?:/|$)|_next/static|_next/image|favicon.ico).*)"],
};
