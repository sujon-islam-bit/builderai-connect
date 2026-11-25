"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * First-run owner setup form. Rendered by /login only while no owner
 * is configured; POSTs to /api/auth/setup, which saves the email +
 * bcrypt hash and signs the owner in. Once saved, this form can never
 * be reached again — /login switches to the sign-in form.
 */
export default function SetupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Setup failed — please try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Setup failed — please try again.");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/30";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="setup-email" className="mb-1.5 block text-sm font-semibold">
          Email
        </label>
        <input
          id="setup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="setup-password" className="mb-1.5 block text-sm font-semibold">
          Password
        </label>
        <input
          id="setup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 10 characters"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="setup-confirm-password" className="mb-1.5 block text-sm font-semibold">
          Confirm password
        </label>
        <input
          id="setup-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Type the same password again"
          className={inputClass}
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save and sign in"}
      </button>
    </form>
  );
}
