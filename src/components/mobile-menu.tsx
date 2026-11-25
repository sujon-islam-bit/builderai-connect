"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import LogoutButton from "@/components/logout-button";

/**
 * Phone/tablet navigation (below lg). The header keeps only the brand
 * and this ☰ button; tapping it opens a slide-in drawer from the left
 * with the dashboard navigation — Home, Connections, and Log out when
 * the owner is signed in. Closes on backdrop tap, on the ✕ button, on
 * Escape, and whenever the route changes (including after navigation).
 * Desktop (lg+) never renders this — it uses the inline header links.
 */
export default function MobileMenu({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation (link taps, logout redirect, back button) —
  // React's "adjust state when a value changes" pattern.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open ]);

  const linkClass = (href: string) =>
    `rounded-xl px-4 py-3 text-[15px] font-medium transition ${
      pathname === href ? "bg-brand-soft font-semibold text-brand" : "text-neutral-700 hover:bg-neutral-100"
    }`;

  return (
    <div className="ml-auto lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-xl text-neutral-700 transition hover:bg-neutral-100"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      </button>

      {open
        ? // Portalled to <body>: the sticky header's backdrop-blur would
          // otherwise become the containing block for the fixed drawer
          // and squash it into the header strip.
          createPortal(
            <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="animate-fade-in absolute inset-0 h-full w-full bg-black/40" />
          <aside className="animate-drawer-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center gap-3 border-b border-neutral-200 px-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 7V3" />
                  <path d="M15 7V3" />
                  <path d="M7 7h10v4a5 5 0 0 1-10 0V7Z" />
                  <path d="M12 16v5" />
                </svg>
              </span>
              <p className="min-w-0 flex-1 truncate text-[15px] font-bold">BuilderAI Connect</p>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-neutral-600 transition hover:bg-neutral-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col gap-1 p-3">
              <Link href="/" onClick={() => setOpen(false)} className={linkClass("/")}>
                Home
              </Link>
              <Link href="/connections" onClick={() => setOpen(false)} className={linkClass("/connections")}>
                Connections
              </Link>
            </nav>

            <div className="mt-auto border-t border-neutral-200 p-3">
              {loggedIn ? (
                <LogoutButton className="w-full rounded-xl px-4 py-3 text-left text-[15px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60" />
              ) : pathname !== "/login" ? (
                <Link href="/login" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-[15px] font-medium text-neutral-700 transition hover:bg-neutral-100">
                  Owner sign in
                </Link>
              ) : null}
            </div>
            </aside>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
