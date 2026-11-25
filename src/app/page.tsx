import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { getOwnerSession } from "@/lib/auth";
import { configStatus } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { PROVIDERS } from "@/lib/providers";

function StatusItem({ ok, label, okLine, missingLine }: { ok: boolean; label: string; okLine: string; missingLine: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-400"}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm text-neutral-500">{ok ? okLine : missingLine}</p>
      </div>
    </div>
  );
}

async function HomeContent() {
  await connection();
  // Defense in depth: src/proxy.ts already gates this route; the page
  // also refuses to render without an owner session.
  if (!(await getOwnerSession())) redirect("/login");
  const status = configStatus();
  const counts = await prisma.connection.groupBy({ by: ["provider"], _count: { _all: true } });
  const countFor = (providerId: string) => counts.find((c) => c.provider === providerId)?._count._all ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Connect your apps</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-neutral-500">
          This service holds the app accounts your BuilderAI agents use. A user connects an account once here, and
          BuilderAI reaches that app through this service — tokens stay locked here, never inside BuilderAI.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-bold tracking-wide text-neutral-900 uppercase">Service status</h2>
        <p className="mt-1 text-sm text-neutral-500">What is ready right now, and what is still missing.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <StatusItem
            ok={status.googleConfigured}
            label="Google sign-in"
            okLine="Google keys are set — users can connect Google accounts."
            missingLine="Google keys are not set yet — add them to turn Google connections on."
          />
          <StatusItem
            ok={status.apiKeySet}
            label="Service API key"
            okLine="Set — BuilderAI can call apps through this service."
            missingLine="Not set — BuilderAI cannot use connections until this key exists."
          />
          <StatusItem
            ok={status.encryptionKeySet}
            label="Token lock"
            okLine="Set — connection tokens are stored locked (encrypted)."
            missingLine="Not set — tokens cannot be locked until this key exists."
          />
        </div>
      </section>

      {PROVIDERS.map((provider) => {
        const count = countFor(provider.id);
        return (
          <section key={provider.id}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{provider.displayName} apps</h2>
                <p className="mt-0.5 text-sm text-neutral-500">{provider.plainLine}</p>
              </div>
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                {count} connected account{count === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {provider.services.map((service) => (
                <article key={service.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow">
                  <div className="flex items-center gap-3.5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-lg font-bold text-brand">
                      {service.displayName.replace(/^(Google )/, "").charAt(0)}
                    </span>
                    <h3 className="font-semibold">{service.displayName}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-500">{service.plainLine}</p>
                  <p className="mt-4">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                      {count} connected account{count === 1 ? "" : "s"}
                    </span>
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/connect/${provider.id}?user=local-demo&return_url=/connections`}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
              >
                Connect a {provider.displayName} account
              </Link>
              <p className="text-sm text-neutral-500">
                {provider.authMode === "API_KEY"
                  ? "Opens a short form — paste a key, then come back here."
                  : `Opens ${provider.displayName} sign-in, then comes back here.`}
              </p>
              <Link href="/connections" className="text-sm font-semibold text-brand hover:underline">
                See all connections →
              </Link>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          Loading the dashboard…
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
