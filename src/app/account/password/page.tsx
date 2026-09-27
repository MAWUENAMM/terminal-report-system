"use client";
import { useState } from "react";
import Link from "next/link";
import { staffAction } from "@/lib/api";
import { browserClient } from "@/lib/supabase/client";
export default function Password() {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <Link href="/" className="eyebrow">
        EduReport
      </Link>
      <h1 className="page-title mt-6">Choose your password</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Use at least 12 characters. Your initial password must be changed before
        school records become available.
      </p>
      <form
        method="post"
        className="surface mt-6 space-y-5 rounded-2xl p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (password !== confirm) {
            setError("The passwords do not match.");
            return;
          }
          setBusy(true);
          try {
            await staffAction({ action: "set_password", password });
            await browserClient().auth.signOut();
            window.location.assign("/login?updated=1");
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Password could not be updated.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm font-medium">
          New password
          <input
            className="field mt-2"
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Confirm password
          <input
            className="field mt-2"
            type="password"
            name="confirmation"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Updating…" : "Save password and sign in"}
        </button>
      </form>
    </main>
  );
}
