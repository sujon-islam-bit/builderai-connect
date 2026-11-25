import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import HeaderNav from "@/components/header-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "BuilderAI Connect",
  description: "The connection service for BuilderAI — users connect their app accounts here, BuilderAI uses them through one API.",
};

function PlugMark() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 7V3" />
        <path d="M15 7V3" />
        <path d="M7 7h10v4a5 5 0 0 1-10 0V7Z" />
        <path d="M12 16v5" />
      </svg>
    </span>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
            <PlugMark />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[15px] font-bold">BuilderAI Connect</p>
              <p className="truncate text-xs text-neutral-500">The accounts hub for your BuilderAI apps</p>
            </div>
            <Suspense fallback={null}>
              <HeaderNav />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
          <p className="text-xs text-neutral-400">
            BuilderAI Connect is a separate service from BuilderAI. Tokens are stored locked (encrypted) and are never shown on any page.
          </p>
        </footer>
      </body>
    </html>
  );
}
