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
  Users,
} from "lucide-react";

const HERO_IMG = "/hero-students.jpg";

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!target) {
      setValue(0);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
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
    <main className="min-h-screen overflow-x-hidden bg-white text-[var(--ink)]">
      <div className="kente-bar" />

      <section className="relative isolate overflow-hidden bg-[#071a14]">
        <div className="absolute inset-0 -z-20">
          <Image
            src={HERO_IMG}
            fill
            priority
            sizes="100vw"
            alt="Ghanaian basic school students"
            className="object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(3,20,14,.84)_0%,rgba(3,20,14,.70)_42%,rgba(3,20,14,.42)_68%,rgba(3,20,14,.20)_100%)]" />

        <header className="border-b border-white/10">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
            <Link href="/" className="flex items-center gap-3 text-white">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <GraduationCap size={21} strokeWidth={1.9} />
              </span>
              <span>
                <span className="block text-[15px] font-bold leading-none">EduReport</span>
                <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">
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

        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[1fr_.95fr] lg:items-center lg:px-8 lg:py-20 xl:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">
              Built for Ghanaian basic schools
            </div>

            <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.7rem]">
              One professional system for
              <span className="block text-[var(--g-gold)]">student records and terminal reports.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
              Manage learner profiles, scores, attendance, remarks and school-branded report cards in one secure workspace built around the way basic schools work.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-gold">
                Open school workspace <ArrowRight size={16} />
              </Link>
              <Link href="/request-access" className="btn-outline-light">
                Request school access
              </Link>
            </div>

            <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-3">
              {[
                [ShieldCheck, "School-isolated records"],
                [FileCheck2, "Print-ready reports"],
                [LockKeyhole, "Role-based access"],
              ].map(([Icon, label]) => {
                const C = Icon as typeof ShieldCheck;
                return (
                  <div key={String(label)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-semibold text-white/75">
                    <C size={15} className="shrink-0 text-[var(--g-gold)]" />
                    {String(label)}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="mx-auto max-w-[560px] rounded-[30px] border border-white/15 bg-white p-6 shadow-2xl shadow-black/35">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">School-branded output</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">TERMINAL REPORT CARD</h2>
                  <p className="mt-1 text-xs text-slate-500">Profile → verified results → final PDF</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <School size={24} strokeWidth={1.8} />
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
                    <p className="mt-1 font-sans text-sm font-bold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>

              <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-7xl font-black text-emerald-800/[0.04]">
                  ER
                </div>
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
                    <span className="font-semibold text-slate-800">{row[0]}</span>
                    <span>{row[1]}</span>
                    <span>{row[2]}</span>
                    <span className="font-bold text-red-600">{row[3]}</span>
                    <span className="font-semibold text-slate-700">{row[4]}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                <span className="text-xs font-semibold text-emerald-900">
                  Automatic performance remarks + teacher remarks
                </span>
                <CheckCircle2 size={17} className="text-emerald-700" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-0 px-5 sm:grid-cols-3 lg:px-8">
          {[
            [learners, "Learners managed"],
            [classes, "Classes configured"],
            [schools, "Schools on platform"],
          ].map(([value, label], index) => (
            <div
              key={String(label)}
              className={`py-7 text-center sm:py-8 ${index ? "sm:border-l sm:border-slate-200" : ""}`}
            >
              <div className="font-sans text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {stats ? value : "—"}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="platform" className="bg-[#fbfcfa] py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Complete school reporting workflow</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Everything connected to the learner record.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted)]">
              The student profile, term results, attendance, development records, teacher observations and archived reports all use the same school data.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              [Users, "Professional learner profiles", "Photos, personal details, guardian information, results, attendance, development records and archived reports."],
              [ClipboardCheck, "Structured assessment entry", "Enter SBA and examination marks with school-defined weights, automatic totals, grades and positions."],
              [Award, "Automatic performance remarks", "Subject totals automatically map to HIGHEST, HIGHER, HIGH and the complete approved performance scale."],
              [FileText, "School-branded report cards", "School logo, watermark, learner photo, results, attendance, remarks, promotion and signature areas."],
              [ShieldCheck, "Role-based access", "Administrators, headteachers, class teachers and subject teachers receive controlled access."],
              [BookOpen, "Permanent term history", "Closed-term reports remain available even after the school moves into a new reporting period."],
            ].map(([Icon, title, body]) => {
              const C = Icon as typeof Users;
              return (
                <article key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <C size={20} strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-5 text-base font-bold tracking-tight text-slate-950">{String(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{String(body)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-slate-200 bg-white py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:items-start">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                One term. Four clear stages.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                The platform is organized around the real reporting cycle instead of forcing schools into a generic dashboard.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["01", "Set up the school", "Configure classes, subjects, staff access and school branding."],
                ["02", "Capture the term", "Enter scores, attendance and learner-development records."],
                ["03", "Review readiness", "Identify incomplete reports before final generation."],
                ["04", "Issue & archive", "Generate report PDFs and preserve closed-term history."],
              ].map(([number, title, body]) => (
                <div key={number} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <div className="font-sans text-sm font-bold text-emerald-700">{number}</div>
                  <h3 className="mt-3 font-bold text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="reports" className="bg-[#fbfcfa] py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <p className="eyebrow">Professional report output</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              The report should look like it belongs to the school.
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-[var(--muted)]">
              School branding flows from Settings into the learner profile and terminal report. The same logo appears in the report header and as a restrained watermark alongside the learner photo and verified results.
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
                <div key={item} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-700" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-[#102033] p-7 text-white shadow-xl sm:p-9">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--g-gold)]">
              Built for everyday school administration
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight">
              Clear enough for staff. Professional enough for parents and school leadership.
            </h3>
            <div className="mt-7 space-y-4">
              {[
                [School, "School-controlled branding", "Each school manages its own identity and report output."],
                [LockKeyhole, "Private school data", "School records and uploaded assets stay isolated by school and role."],
                [FileCheck2, "Consistent generation", "Profiles, previews and PDFs use the same reporting data."],
              ].map(([Icon, title, body]) => {
                const C = Icon as typeof School;
                return (
                  <div key={String(title)} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[var(--g-gold)]">
                      <C size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">{String(title)}</h4>
                      <p className="mt-1 text-sm leading-6 text-white/70">{String(body)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--g-green)] py-14 lg:py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 px-5 md:flex-row md:items-center lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--g-gold)]">
              Ready for the next reporting term?
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Open your school workspace or request access.
            </h2>
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
