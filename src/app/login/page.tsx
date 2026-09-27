"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Shield } from "lucide-react";
import { store } from "@/lib/store";

const DEMO = [
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
      setError("Account not found. Choose a demonstration role below.");
      return;
    }
    store.setCurrentUser(user);
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=60)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/95 to-forest/90" />

          <div className="relative">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-md bg-white text-[13px] font-bold text-ink">
                ER
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-ink" />
              </div>
              <div>
                <div className="font-semibold tracking-tight">EduReport</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Ghana Basic Schools
                </div>
              </div>
            </Link>
          </div>

          <div className="relative max-w-md">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              School workspace
            </div>
            <h1 className="font-display mt-4 text-4xl font-medium leading-[1.15] tracking-[-0.02em] xl:text-[2.75rem]">
              One place for marks, learners, and terminal reports.
            </h1>
            <p className="mt-5 text-[15px] leading-7 text-white/55">
              Sign in to enter scores, manage student records, and issue consistent
              report cards aligned with Ghana Education Service practice.
            </p>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-white/40">
            <Shield size={14} />
            Role-based access · Demonstration environment
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-[400px]">
            <Link
              href="/"
              className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
            >
              <ArrowLeft size={15} />
              Back
            </Link>

            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-[12px] font-bold text-white">
                ER
              </div>
              <span className="font-semibold">EduReport</span>
            </div>

            <div className="eyebrow">Welcome</div>
            <h2 className="font-display mt-2 text-3xl font-medium tracking-[-0.02em]">
              Sign in to your workspace
            </h2>
            <p className="mt-2 text-sm text-muted">
              Use a demonstration account to explore the full term workflow.
            </p>

            <form onSubmit={handleLogin} className="surface mt-8 rounded-xl p-6">
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
              <input className="field" type="password" defaultValue="demo123" />
              <p className="mt-1.5 text-[11px] text-muted">
                Prototype mode — any password is accepted for demo accounts.
              </p>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary mt-6 w-full">
                Continue
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-5 border border-line bg-paper-elevated p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Demonstration roles
              </div>
              <div className="mt-3 space-y-1.5">
                {DEMO.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => {
                      setEmail(d.email);
                      setError("");
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                      email === d.email
                        ? "border-ink bg-ink text-white"
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
