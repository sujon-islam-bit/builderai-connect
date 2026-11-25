import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import LoginForm from "@/components/login-form";
import { getOwnerSession, ownerLoginConfigured } from "@/lib/auth";

async function LoginContent() {
  await connection();
  const session = await getOwnerSession();
  if (session) redirect("/");

  return (
    <div className="mx-auto max-w-md pt-6 sm:pt-12">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Owner sign in</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">Only the owner can open this dashboard.</p>

        <div className="mt-6">
          {ownerLoginConfigured() ? (
            <LoginForm />
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
              <p className="text-sm font-semibold text-amber-900">Owner login is not configured yet</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-800">
                The dashboard stays locked until the owner email and password hash are set in this service&apos;s
                environment (OWNER_EMAIL and OWNER_PASSWORD_HASH). There is no open-access fallback.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md pt-6 sm:pt-12">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
            Loading the sign-in page…
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
