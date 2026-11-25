import Link from "next/link";

import LogoutButton from "@/components/logout-button";
import MobileMenu from "@/components/mobile-menu";
import { getOwnerSession } from "@/lib/auth";

/**
 * Header navigation. Desktop (lg+): the inline links + Log out, only
 * for a signed-in owner. Below lg the inline links disappear and the
 * ☰ drawer (MobileMenu) carries the navigation instead, so the brand
 * name is never squeezed. The route gate itself lives in
 * src/proxy.ts; this is only the chrome.
 */
export default async function HeaderNav() {
  const session = await getOwnerSession();

  return (
    <>
      {session ? (
        <nav className="ml-auto hidden items-center gap-1 text-sm font-medium lg:flex">
          <Link href="/" className="rounded-full px-3 py-1.5 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900">
            Home
          </Link>
          <Link
            href="/connections"
            className="rounded-full px-3 py-1.5 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            Connections
          </Link>
          <LogoutButton />
        </nav>
      ) : null}
      <MobileMenu loggedIn={!!session} />
    </>
  );
}
