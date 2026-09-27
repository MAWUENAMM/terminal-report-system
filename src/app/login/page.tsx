"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, GraduationCap, Shield } from "lucide-react";

const HERO_IMG = "/hero-students.jpg";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
function LoginForm() {
  const params = useSearchParams();
  const error = !params.has("error")
    ? ""
    : params.get("error") === "inactive"
      ? "This account is inactive. Contact your school administrator."
      : params.get("error") === "expired"
        ? "This password link is invalid or has expired. Contact your administrator."
        : "Sign in failed. Check your email and password, or contact your school administrator.";
  const updated = params.has("updated");
  const [pending, setPending] = useState(false);

  return (
    <main className="min-h-[100svh] bg-paper">
      <div className="kente-bar" />
      <div className="grid min-h-[calc(100vh-4px)] lg:grid-cols-2">
        <section className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <Image
            src={HERO_IMG}
            fill
            priority
            sizes="50vw"
            alt="Ghanaian students"
            className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-[var(--g-green)]/70 to-black/60" />

          <div className="relative">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--g-green)] text-white shadow-lg shadow-black/30">
                <GraduationCap size={22} strokeWidth={2} />
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
              School workspace
            </div>
            <h1 className="font-display mt-4 text-4xl font-medium leading-[1.15] tracking-[-0.02em] xl:text-[2.75rem]">
              One place for marks, learners, and terminal reports.
            </h1>
            <p className="mt-5 text-[15px] leading-7 text-white/70">
              Sign in to enter scores, manage student records, and issue
              consistent report cards for your school.
            </p>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-white/50">
            <Shield size={14} className="text-[var(--g-gold)]" />
            Role-based access · Secure session
          </div>
        </section>

        <section className="flex min-w-0 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-[400px] min-w-0 animate-fade-up">
            <Link
              href="/"
              className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
            >
              <ArrowLeft size={15} />
              Back
            </Link>

            <Link
              href="/"
              className="mb-8 flex w-fit items-center gap-3 rounded-xl transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--g-green)]/30 lg:hidden"
              aria-label="EduReport home"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--g-green)] text-white shadow-sm">
                <GraduationCap size={20} />
              </div>
              <div className="min-w-0">
                <span className="block truncate font-semibold">EduReport</span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                  Ghana Basic Schools
                </span>
              </div>
            </Link>

            <div className="eyebrow">Welcome</div>
            <h2 className="font-display mt-2 text-[2rem] font-medium leading-tight tracking-[-0.02em] sm:text-3xl">
              Sign in to your workspace
            </h2>
            <p className="mt-2 text-sm text-muted">
              Use the email and password issued for your school account.
            </p>

            <form
              method="post"
              action="/auth/login"
              onSubmit={() => setPending(true)}
              className="surface mt-7 rounded-2xl p-4 sm:mt-8 sm:p-6"
            >
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium"
              >
                Email
              </label>
              <input
                className="field"
                type="email"
                id="email"
                name="email"
                autoComplete="username"
                maxLength={254}
                placeholder="you@school.edu.gh"
                required
              />

              <label
                htmlFor="password"
                className="mb-1.5 mt-4 block text-sm font-medium"
              >
                Password
              </label>
              <input
                className="field"
                id="password"
                name="password"
                autoComplete="current-password"
                type="password"
                required
                maxLength={128}
                placeholder="Enter password"
              />

              {updated && (
                <p className="mt-4 text-sm text-green-800">
                  Password updated. Sign in with your new password.
                </p>
              )}
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
                {pending ? "Signing in…" : "Sign in"}
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-6 space-y-3 text-sm text-muted">
              <p>
                New school?{" "}
                <Link
                  href="/request-access"
                  className="font-semibold text-[var(--g-green)]"
                >
                  Request school access
                </Link>
              </p>
              <p>
                Forgot your password? Ask your school administrator to reset it,
                or{" "}
                <Link href="/contact" className="underline">
                  contact support
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
