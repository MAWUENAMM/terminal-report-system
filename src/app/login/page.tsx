"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Shield,
} from "lucide-react";
import { store } from "@/lib/store";

const HERO_IMG =
  "https://raw.githubusercontent.com/MAWUENAMM/terminal-report-system/main/hero-students.jpg";

const ACCOUNTS = [
  { role: "Administrator", email: "admin@school.edu.gh", note: "Full system access" },
  { role: "Headteacher", email: "head@school.edu.gh", note: "School oversight" },
  { role: "Class Teacher", email: "teacher@school.edu.gh", note: "Assessment & reports" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("teacher@school.edu.gh");
  const [error, setError] = useState("");

  useEffect(() => {
    store.seed();
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const user = store.getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      setError("No account found for this email. Select a role below or check the address.");
      return;
    }
    store.setCurrentUser(user);
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="kente-bar" />
      <div className="grid min-h-[calc(100vh-4px)] lg:grid-cols-2">
        <section className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <img
            src={HERO_IMG}
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
              Sign in to enter scores, manage student records, and issue consistent
              report cards aligned with Ghana Education Service practice.
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

            <div
              className="mb-8 flex items-center gap-3 lg:hidden"
              aria-label="EduReport"
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
            </div>

            <div className="eyebrow">Welcome</div>
            <h2 className="font-display mt-2 text-[2rem] font-medium leading-tight tracking-[-0.02em] sm:text-3xl">
              Sign in to your workspace
            </h2>
            <p className="mt-2 text-sm text-muted">
              Enter your school email to continue.
            </p>

            <form onSubmit={handleLogin} className="surface mt-7 rounded-2xl p-4 sm:mt-8 sm:p-6">
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu.gh"
                required
              />

              <label className="mb-1.5 mt-4 block text-sm font-medium">Password</label>
              <input className="field" type="password" defaultValue="" placeholder="Enter password" />

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary mt-6 w-full">
                Sign in
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-4 rounded-2xl border border-line bg-white p-3.5 sm:mt-5 sm:p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--g-green)]">
                Quick access
              </div>
              <div className="mt-3 space-y-1.5">
                {ACCOUNTS.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => {
                      setEmail(d.email);
                      setError("");
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                      email === d.email
                        ? "border-[var(--g-green)] bg-[var(--g-green)] text-white"
                        : "border-line bg-white hover:bg-paper"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium">{d.role}</span>
                      <span
                        className={`block text-[11px] ${
                          email === d.email ? "text-white/60" : "text-muted"
                        }`}
                      >
                        {d.note}
                      </span>
                    </span>
                    <span
                      className={`font-mono text-[11px] ${
                        email === d.email ? "text-white/50" : "text-muted"
                      }`}
                    >
                      {d.email.split("@")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
