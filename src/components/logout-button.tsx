"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // The cookie is cleared server-side on success; if the call itself
      // failed we still send the owner to /login, which stays locked
      // without a valid session.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={pending}
      className={
        className ??
        "rounded-full px-3 py-1.5 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-60"
      }
    >
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
