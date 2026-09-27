"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";

function useCountUp(target: number, duration = 1600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= target) {
        setValue(target);
        clearInterval(id);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return value;
}

export default function HomePage() {
  const students = useCountUp(428);
  const classes = useCountUp(14);
  const reports = useCountUp(96);

  return (
    <main className="min-h-screen bg-[var(--cream)] text-[var(--ink)] overflow-x-hidden">
      <div className="kente-bar" />

      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8 pt-3">
          <Link href="/" className="flex items-center gap-2.5 animate-fade-in">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--g-green)] text-white shadow-lg shadow-green-900/30">
              <GraduationCap size={22} strokeWidth={2} />
            </div>
            <div className="text-white">
              <div className="text-[15px] font-bold tracking-tight leading-none">EduReport</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/70 mt-0.5">
                Ghana Basic Schools
              </div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/80">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#how" className="hover:text-white transition">How it works</a>
            <a href="#why" className="hover:text-white transition">Why EduReport</a>
          </nav>
          <Link href="/login" className="btn-gold !py-2.5 !px-5 text-[13px] animate-fade-in delay-1">
            Open system
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="relative min-h-[100svh] flex items-end pb-16 pt-28 lg:items-center lg:pb-0">
        <div className="absolute inset-0">
          <img
            src="/hero-students.jpg"
            alt="Ghanaian basic school students in uniform"
            className="h-full w-full object-cover object-[center_20%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-5 lg:px-8">
          <div className="max-w-xl">
            <div className="animate-slide-right inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
              <Sparkles size={13} className="text-[var(--g-gold)]" />
              Built for Ghana Education Service
            </div>

            <h1 className="animate-fade-up delay-1 font-display mt-6 text-[2.6rem] font-medium leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl lg:text-[3.4rem]">
              Terminal reports
              <span className="block text-[var(--g-gold)]">worthy of every learner.</span>
            </h1>

            <p className="animate-fade-up delay-2 mt-5 max-w-md text-base leading-7 text-white/75 sm:text-lg">
              From SBA entry to signed report cards — one workspace for Ghanaian
              basic schools. Accurate. Consistent. Ready for parents&apos; day.
            </p>

            <div className="animate-fade-up delay-3 mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-gold">
                Launch demonstration
                <ArrowRight size={16} />
              </Link>
              <a href="#how" className="btn-outline-light">
                See how it works
              </a>
            </div>

            <div className="animate-fade-up delay-4 mt-12 grid grid-cols-3 gap-4 border-t border-white/15 pt-8 max-w-md">
              {[
                [students, "+", "Learners tracked"],
                [classes, "", "Active classes"],
                [reports, "%", "Reports ready"],
              ].map(([val, suffix, label]) => (
                <div key={String(label)}>
                  <div className="text-2xl font-bold text-white tabular-nums">
                    {val}
                    <span className="text-[var(--g-gold)]">{suffix}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-white/50">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 right-6 hidden lg:flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--g-red)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--g-gold)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--g-green)]" />
        </div>
      </section>

      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--g-green)]">
              Platform capabilities
            </div>
            <h2 className="font-display mt-3 text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
              Everything a school needs for a clean reporting term.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: ClipboardList,
                title: "SBA & exam entry",
                body: "Capture continuous assessment and end-of-term scores. Automatic 50:50 scaling, grades and class positions.",
                accent: "bg-[var(--g-green)]",
              },
              {
                icon: Users,
                title: "Learner profiles",
                body: "Photos, admission numbers, class placement and guardian contacts — organised by class and year.",
                accent: "bg-[var(--g-gold)]",
              },
              {
                icon: FileText,
                title: "Terminal report PDFs",
                body: "Branded, print-ready report cards with scores, attendance, conduct and dual teacher remarks.",
                accent: "bg-[var(--g-red)]",
              },
              {
                icon: Award,
                title: "GES-aligned grading",
                body: "Letter grades A–F with descriptors. Configurable SBA and exam weights per school.",
                accent: "bg-[var(--g-green)]",
              },
              {
                icon: Shield,
                title: "Role-based access",
                body: "Admin, headteacher, class teacher and subject teacher — each sees only what they need.",
                accent: "bg-[var(--ink)]",
              },
              {
                icon: BookOpen,
                title: "School workspace",
                body: "One place for the full term cycle: register, assess, verify, and issue reports.",
                accent: "bg-[var(--g-green-dark)]",
              },
            ].map(({ icon: Icon, title, body, accent }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent} text-white`}>
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-[16px] font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-black/5 bg-[var(--sand)] py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="text-center max-w-xl mx-auto">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--g-green)]">
              Term workflow
            </div>
            <h2 className="font-display mt-3 text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
              Four steps. One clean report.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "01", title: "Register learners", desc: "Add students by class with photos and guardian details." },
              { n: "02", title: "Enter assessment", desc: "Record SBA and examination marks subject by subject." },
              { n: "03", title: "Verify totals", desc: "System grades, ranks and flags incomplete records." },
              { n: "04", title: "Issue reports", desc: "Generate consistent PDF terminal reports for the class." },
            ].map((step, i) => (
              <div key={step.n} className="relative">
                {i < 3 && (
                  <div className="absolute top-8 left-[calc(50%+40px)] hidden h-px w-[calc(100%-20px)] bg-[var(--g-green)]/20 lg:block" />
                )}
                <div className="rounded-2xl bg-white border border-black/5 p-6 h-full transition-transform duration-300 hover:-translate-y-1">
                  <div className="font-display text-3xl font-medium text-[var(--g-green)]">{step.n}</div>
                  <h3 className="mt-3 font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--g-green)]">
                Designed for Ghana
              </div>
              <h2 className="font-display mt-3 text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
                Aligned with how basic schools actually assess.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[var(--muted)]">
                Not a generic foreign template. EduReport follows Ghana Education
                Service practice — continuous assessment, terminal examinations,
                attendance, conduct and dual remarks.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  "Configurable SBA and exam weighting (default 50:50)",
                  "Letter grades with clear descriptors",
                  "Attendance and affective domain on every report",
                  "Class teacher and headteacher remarks",
                  "Class position and on-roll totals",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--g-green)]" strokeWidth={2} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[var(--g-green)]/10 via-[var(--g-gold)]/10 to-[var(--g-red)]/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-3xl border border-black/5 shadow-2xl shadow-black/10">
                <img
                  src="/hero-students.jpg"
                  alt="Students at a Ghanaian basic school"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-16">
                  <div className="text-white font-semibold">Every learner deserves a clear report</div>
                  <div className="text-sm text-white/70 mt-1">Proudly built for Ghanaian classrooms</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[var(--g-green)] py-16 lg:py-20">
        <div className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-medium text-white sm:text-3xl">
              Walk stakeholders through a live term.
            </h2>
            <p className="mt-2 text-sm text-white/70">
              Browser-based demonstration · no install · ready in seconds
            </p>
          </div>
          <Link href="/login" className="btn-gold shrink-0 shadow-lg shadow-black/20">
            Enter demonstration
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-black/5 bg-[var(--cream)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--g-green)] text-white">
              <GraduationCap size={18} />
            </div>
            <div>
              <div className="text-sm font-bold">EduReport</div>
              <div className="text-[11px] text-[var(--muted)]">Terminal Report System · Ghana</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--g-red)]" />
            <span className="h-2 w-2 rounded-full bg-[var(--g-gold)]" />
            <span className="h-2 w-2 rounded-full bg-[var(--g-green)]" />
            <span className="ml-2 text-xs text-[var(--muted)]">For Ghanaian basic schools</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
