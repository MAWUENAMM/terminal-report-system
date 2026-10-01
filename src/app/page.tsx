"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/public-layout";
import { browserClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  GraduationCap,
  LockKeyhole,
  School,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const HERO_IMG = "/hero-students.jpg";

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) {
      setValue(0);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export default function HomePage() {
  const [stats, setStats] = useState<{
    learners: number;
    classes: number;
    schools: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error } = await browserClient()
        .from("public_statistics")
        .select("learners,classes,schools")
        .eq("id", true)
        .single();
      if (active && !error) setStats(data);
    };
    void refresh();
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, []);

  const learners = useCountUp(stats?.learners || 0);
  const classes = useCountUp(stats?.classes || 0);
  const schools = useCountUp(stats?.schools || 0);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--cream)] text-[var(--ink)]">
      <div className="kente-bar" />

      <header className="absolute inset-x-0 top-1 z-50">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md">
              <GraduationCap size={23} strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-[15px] font-bold leading-none">EduReport</span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/65">
                Ghana Basic Schools
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-white/75 md:flex">
            <a href="#platform" className="transition hover:text-white">Platform</a>
            <a href="#workflow" className="transition hover:text-white">How it works</a>
            <a href="#reports" className="transition hover:text-white">Reports</a>
          </nav>

          <Link href="/login" className="btn-gold !px-5 !py-2.5 text-[13px]">
            Sign in <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="relative flex min-h-[760px] items-center overflow-hidden py-28 lg:min-h-[800px]">
        <div className="absolute inset-0">
          <Image
            src={HERO_IMG}
            fill
            priority
            sizes="100vw"
            alt="Ghanaian basic school students"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,22,18,.94)_0%,rgba(8,22,18,.82)_42%,rgba(8,22,18,.45)_72%,rgba(8,22,18,.32)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/25" />
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 pt-10 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-8">
          <div className="max-w-2xl">
            <div className="animate-slide-right inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/85 backdrop-blur-md">
              <Sparkles size={13} className="text-[var(--g-gold)]" />
              Built for Ghanaian basic schools
            </div>

            <h1 className="animate-fade-up delay-1 font-display mt-6 max-w-xl text-[2.8rem] font-medium leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.15rem]">
              Better school records.
              <span className="mt-1 block text-[var(--g-gold)]">Better terminal reports.</span>
            </h1>

            <p className="animate-fade-up delay-2 mt-6 max-w-xl text-[15px] leading-7 text-white/72 sm:text-lg sm:leading-8">
              Manage learners, scores, attendance, remarks and branded report cards from one secure school workspace—without rebuilding the same term records in separate files.
            </p>

            <div className="animate-fade-up delay-3 mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-gold">
                Open school workspace <ArrowRight size={16} />
              </Link>
              <Link href="/request-access" className="btn-outline-light">
                Request school access
              </Link>
            </div>

            <div className="animate-fade-up delay-4 mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-white/70">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[var(--g-gold)]" /> School-isolated records</span>
              <span className="inline-flex items-center gap-2"><FileCheck2 size={15} className="text-[var(--g-gold)]" /> Print-ready reports</span>
              <span className="inline-flex items-center gap-2"><LockKeyhole size={15} className="text-[var(--g-gold)]" /> Role-based access</span>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="relative mx-auto max-w-[520px]">
              <div className="absolute -inset-8 rounded-[40px] bg-[var(--g-gold)]/10 blur-3xl" />
              <div className="relative rotate-[1.2deg] overflow-hidden rounded-[28px] border border-white/20 bg-white/95 p-5 shadow-2xl shadow-black/35 backdrop-blur-xl">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[var(--g-green)]">
                    <School size={27} strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0 flex-1 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--g-green)]">School-branded output</p>
                    <p className="mt-1 text-xl font-black tracking-tight text-slate-900">TERMINAL REPORT CARD</p>
                    <p className="mt-1 text-xs text-slate-500">Learner profile → verified results → report PDF</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    ["Average", "82.0%"],
                    ["Grade", "A"],
                    ["Position", "3 / 28"],
                    ["Attendance", "58 / 60"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-[72px] font-black tracking-tighter text-[var(--g-green)]/[0.035]">ER</div>
                  <div className="grid grid-cols-[1.6fr_.65fr_.65fr_.65fr_1fr] bg-slate-900 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white">
                    <span>Subject</span><span>SBA</span><span>Exam</span><span>Total</span><span>Remark</span>
                  </div>
                  {[
                    ["English Language", "39", "43", "82", "HIGHEST"],
                    ["Mathematics", "35", "38", "73", "HIGHER"],
                    ["Science", "31", "31", "62", "HIGH AVERAGE"],
                    ["Social Studies", "42", "44", "86", "HIGHEST"],
                  ].map((row) => (
                    <div key={row[0]} className="grid grid-cols-[1.6fr_.65fr_.65fr_.65fr_1fr] border-t border-slate-100 px-3 py-2.5 text-[10px] text-slate-600">
                      <span className="font-semibold text-slate-800">{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span><span className="font-black text-red-600">{row[3]}</span><span className="font-bold text-slate-700">{row[4]}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                  <span className="text-xs font-semibold text-emerald-900">Automatic performance remarks + teacher remarks</span>
                  <CheckCircle2 size={17} className="text-emerald-700" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/20 backdrop-blur-md">
          <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-white/10 px-5 lg:px-8">
            {[
              [learners, "Learners"],
              [classes, "Classes"],
              [schools, "Schools"],
            ].map(([value, label]) => (
              <div key={String(label)} className="py-4 text-center lg:text-left">
                <span className="text-xl font-black tabular-nums text-white">{stats ? value : "—"}</span>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div>
              <p className="eyebrow">One reporting workspace</p>
              <h2 className="font-display mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-5xl">The complete learner record, not just a marks sheet.</h2>
            </div>
            <p className="max-w-2xl text-[15px] leading-7 text-[var(--muted)] lg:justify-self-end">
              EduReport keeps the student profile, class results, attendance, development records, teacher observations and permanent report history connected—so the terminal report is generated from the same verified record.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              [Users, "Professional learner profiles", "Photos, personal details, guardian information, results, attendance, development records and archived reports in one profile."],
              [ClipboardCheck, "Structured assessment entry", "Enter SBA and examination marks with school-defined weights, automatic totals, grades and positions."],
              [Award, "Automatic performance remarks", "Subject totals automatically map to the school performance language used on the final report."],
              [FileText, "School-branded report cards", "School logo, watermark, learner photo, results, attendance, remarks, promotion and signature areas."],
              [ShieldCheck, "Role-based access", "Administrators, headteachers, class teachers and subject teachers see only the tools appropriate to their role."],
              [BookOpen, "Permanent term history", "Close a term with archived reports that remain available even after the school moves into a new reporting period."],
            ].map(([Icon, title, body], index) => {
              const C = Icon as typeof Users;
              return (
                <article key={String(title)} className="surface group rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div className={`grid h-11 w-11 place-items-center rounded-2xl ${index % 3 === 1 ? "bg-amber-50 text-amber-700" : index % 3 === 2 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    <C size={20} strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-5 text-base font-bold tracking-tight">{String(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{String(body)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-black/5 bg-[var(--sand)] py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Term workflow</p>
            <h2 className="font-display mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">From first score to parent-ready report.</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              ["01", "Set up the school", "Configure classes, subjects, staff roles and school branding."],
              ["02", "Capture the term", "Enter scores, attendance and learner-development records."],
              ["03", "Review readiness", "See incomplete reports before the term is closed or PDFs are issued."],
              ["04", "Issue & archive", "Generate consistent reports and preserve closed-term history."],
            ].map(([number, title, body]) => (
              <div key={number} className="rounded-3xl border border-black/5 bg-white p-6">
                <div className="font-display text-3xl font-medium text-[var(--g-green)]">{number}</div>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="reports" className="py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[1fr_.9fr] lg:items-center lg:px-8">
          <div className="relative overflow-hidden rounded-[32px] bg-[#102033] p-7 text-white shadow-2xl shadow-black/10 sm:p-9">
            <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-[var(--g-green)]/30 blur-3xl" />
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--g-gold)]">Report quality</p>
              <h2 className="font-display mt-3 text-3xl font-medium sm:text-4xl">A report card that looks like it came from the school.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/65">
                School identity is carried from Settings into every learner profile and generated report. The same logo appears in the header and as a restrained watermark, while the report keeps a compact institutional layout suitable for printing.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  "School logo & watermark",
                  "Learner photograph",
                  "SBA, exam, total & grade",
                  "Automatic subject remarks",
                  "Attendance & development",
                  "Teacher/headteacher remarks",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-semibold text-white/80">
                    <CheckCircle2 size={15} className="shrink-0 text-[var(--g-gold)]" /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="eyebrow">Designed for real school work</p>
            <h2 className="font-display mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">Professional enough for presentation. Practical enough for every term.</h2>
            <p className="mt-5 text-[15px] leading-7 text-[var(--muted)]">
              The platform is designed around the repetitive work schools actually do: keeping learner records accurate, preventing incomplete reports, preserving previous terms and making final report cards easier to verify before they are printed.
            </p>
            <div className="mt-7 space-y-4">
              {[
                [School, "School-controlled branding", "Each school manages its own identity and report output."],
                [LockKeyhole, "Private school data", "School records and uploaded assets stay isolated by role and school."],
                [FileCheck2, "Consistent report generation", "Profiles, previews and PDFs are generated from the same reporting data."],
              ].map(([Icon, title, body]) => {
                const C = Icon as typeof School;
                return (
                  <div key={String(title)} className="flex gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><C size={18} /></div>
                    <div><h3 className="text-sm font-bold">{String(title)}</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{String(body)}</p></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--g-green)] py-16 lg:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 md:flex-row md:items-center lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--g-gold)]">Ready for the next reporting term?</p>
            <h2 className="font-display mt-2 text-3xl font-medium text-white">Open your school workspace or request access.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="btn-gold">Sign in <ArrowRight size={16} /></Link>
            <Link href="/request-access" className="btn-outline-light">Request school access</Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
