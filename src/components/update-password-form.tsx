"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Shield,
} from "lucide-react";

export default function UpdatePasswordForm({
  errorCode,
}: {
  errorCode?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <main className="min-h-[100svh] bg-paper">
      <div className="kente-bar" />
      <div className="flex min-h-[calc(100vh-4px)] items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-[440px]">
          <Link
            href="/login"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
          >
            <ArrowLeft size={15} />
            Back to sign in
          </Link>

          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--g-green)] text-white">
              <GraduationCap size={21} />
            </div>
            <div>
              <div className="font-semibold">EduReport</div>
              <div className="text-[10px] uppercase tracking-[0.13em] text-muted">
                Secure password update
              </div>
            </div>
          </div>

          <div className="eyebrow">Account recovery</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
            Choose a new password
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Use a strong password you have not used elsewhere.
          </p>

          <form
            method="post"
            action="/auth/update-password"
            onSubmit={(event) => {
              const form = event.currentTarget;
              const password = (
                form.elements.namedItem("password") as HTMLInputElement
              ).value;
              const confirm = (
                form.elements.namedItem("confirm_password") as HTMLInputElement
              ).value;

              if (password !== confirm) {
                event.preventDefault();
                alert("The two passwords do not match.");
                return;
              }

              setPending(true);
            }}
            className="surface mt-8 rounded-2xl p-5 sm:p-6"
          >
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                className="field pr-12"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-slate-100"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <label
              htmlFor="confirm_password"
              className="mb-1.5 mt-4 block text-sm font-medium"
            >
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm_password"
                name="confirm_password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                className="field pr-12"
                placeholder="Repeat new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((value) => !value)}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-slate-100"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-800">
              <Shield size={15} className="mt-0.5 shrink-0" />
              Your recovery session is temporary and will be signed out after
              the password is changed.
            </div>

            {errorCode && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                The password could not be updated. Use at least 8 characters and
                choose a stronger password, then try again.
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="btn-primary mt-6 w-full"
            >
              {pending ? "Updating password…" : "Update password"}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
