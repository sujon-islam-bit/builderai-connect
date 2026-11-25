import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import DeleteButton from "@/components/delete-button";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/providers";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

async function ConnectionsContent() {
  await connection();
  // Defense in depth: src/proxy.ts already gates this route; the page
  // also refuses to render without an owner session.
  if (!(await getOwnerSession())) redirect("/login");
  const rows = await prisma.connection.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Connections</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-neutral-500">
          Every account users have connected through this service. Deleting a connection removes its stored tokens —
          BuilderAI will not be able to use that account until the user connects it again.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold">No connections yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
            When a user connects an app account, it will show up here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
          >
            Go to the dashboard
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs tracking-wide text-neutral-500 uppercase">
                <th className="px-5 py-3.5 font-semibold">App</th>
                <th className="px-5 py-3.5 font-semibold">Account</th>
                <th className="px-5 py-3.5 font-semibold">BuilderAI user</th>
                <th className="px-5 py-3.5 font-semibold">Connected</th>
                <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2.5 font-semibold">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand">
                        {(getProvider(row.provider)?.displayName ?? row.provider).charAt(0)}
                      </span>
                      {getProvider(row.provider)?.displayName ?? row.provider}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-neutral-600">{row.accountEmail ?? "—"}</td>
                  <td className="px-5 py-4 font-mono text-xs text-neutral-600">{row.externalUserId}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-neutral-600">{dateFormat.format(row.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <DeleteButton connectionId={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          Loading connections…
        </div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  );
}
