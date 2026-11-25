"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Two-step delete (same pattern as BuilderAI): first tap arms it, second tap deletes. */
export default function DeleteButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/connections/${connectionId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        armed ? "bg-red-600 text-white hover:bg-red-700" : "bg-red-50 text-red-600 hover:bg-red-100"
      } disabled:opacity-50`}
    >
      {busy ? "Deleting…" : armed ? "Tap again to delete" : "Delete"}
    </button>
  );
}
