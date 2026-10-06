"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  GraduationCap,
  Mail,
  Shield,
} from "lucide-react";
import { browserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const redirectTo =
      window.location.origin + "/auth/recovery?next=/update-password";

    const { error } = await browserClient().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );

    setPending(false);

    if (error) {
      setError(
        "We could not start password recovery right now. Please try again or contact support.",
      );
      return;
    }

    setSent(true);
  }

  return (
    <main className="min-h-[100svh] bg-paper">
      <div className="kente-bar" />
      <div className="grid min-h-[calc(100vh-4px)] lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-[var(--g-green-dark)] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
          <div className="relative">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[var(--g-green)]">
                <GraduationCap size={22} />
              </div>
              <div>
                <div className="font-semibold tracking-tight">EduReport</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/60">
                  Ghana Basic Schools
                </div>
              </div>
            </Link>
          </div>

          <div className="relative max-w-md">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--g-gold)]">
              Secure account recovery
            </div>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Reset access without exposing school accounts.
            </h1>
            <p className="mt-5 text-[15px] leading-7 text-white/70">
              We send a secure recovery link to the account email. For privacy,
              we do not reveal whether an email is registered.
            </p>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-white/50">
            <Shield size={14} className="text-[var(--g-gold)]" />
            Secure recovery · Protected session
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-[420px]">
            <Link
              href="/login"
              className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
            >
              <ArrowLeft size={15} />
              Back to sign in
            </Link>

            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--g-green)] text-white">
                <GraduationCap size={20} />
              </div>
              <div>
                <span className="block font-semibold">EduReport</span>
                <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">
                  Ghana Basic Schools
                </span>
              </div>
            </div>

            {!sent ? (
              <>
                <div className="eyebrow">Account recovery</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
                  Forgot your password?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Enter the email used for your school account. If it is
                  registered, we will send a secure password reset link.
                </p>

                <form
                  onSubmit={submit}
                  className="surface mt-8 rounded-2xl p-5 sm:p-6"
                >
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                    Account email
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="field pl-11"
                      placeholder="you@school.edu.gh"
                      required
                      maxLength={254}
                    />
                    <Mail
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>

                  {error && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={pending}
                    className="btn-primary mt-6 w-full"
                  >
                    {pending ? "Sending reset link…" : "Send reset link"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              </>
            ) : (
              <div className="surface rounded-2xl p-6 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 size={28} />
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                  Check your email
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  If an EduReport account exists for <strong>{email}</strong>, a
                  secure password reset link has been sent. Check your inbox and
                  spam folder.
                </p>
                <Link href="/login" className="btn-primary mt-6 w-full">
                  Return to sign in
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
