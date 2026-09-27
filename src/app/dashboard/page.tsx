"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileOutput,
  TrendingUp,
  Users,
} from "lucide-react";
import { store } from "@/lib/store";
import { School, Student, Class, Score } from "@/types";

export default function DashboardPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [scores, setScores] = useState<Score[]>([]);

  useEffect(() => {
    store.seed();
    setSchool(store.getSchool());
    setStudents(store.getStudents());
    setClasses(store.getClasses());
    setScores(store.getScores());
  }, []);

  const active = students.filter((s) => s.status === "ACTIVE");
  const completion = active.length
    ? Math.min(100, Math.round((scores.length / Math.max(1, active.length * 5)) * 100))
    : 0;
  const average = scores.length
    ? (scores.reduce((a, s) => a + s.total, 0) / scores.length).toFixed(1)
    : "0.0";

  const classRows = useMemo(
    () =>
      classes.map((c) => {
        const count = active.filter((s) => s.classId === c.id).length;
        const xs = scores.filter((s) => s.classId === c.id);
        const avg = xs.length
          ? (xs.reduce((a, s) => a + s.total, 0) / xs.length).toFixed(1)
          : "—";
        return { ...c, count, avg };
      }),
    [classes, active, scores]
  );

  const stats = [
    { label: "Active students", value: active.length, icon: Users, sub: "Learner records", color: "bg-[var(--g-green)]" },
    { label: "Classes", value: classes.length, icon: ClipboardList, sub: "Configured", color: "bg-[var(--g-gold)]" },
    { label: "Scores entered", value: scores.length, icon: FileOutput, sub: "Assessment rows", color: "bg-[var(--g-red)]" },
    { label: "Class average", value: `${average}%`, icon: TrendingUp, sub: "Across entered scores", color: "bg-ink" },
  ];

  return (
    <div className="space-y-7 animate-fade-up">
      <header className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">School overview</div>
          <h1 className="font-display mt-2 text-3xl font-medium tracking-[-0.02em] text-ink md:text-[2rem]">
            {school?.name || "School dashboard"}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {school?.academicYear} · Term {school?.currentTerm} · {school?.district || "Administration"}
          </p>
        </div>
        <Link href="/dashboard/reports" className="btn-primary !py-2.5 w-fit">
          Open report centre
          <ArrowRight size={15} />
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="surface rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color} text-white`}>
                <s.icon size={18} strokeWidth={1.75} />
              </div>
              <span className="rounded-full bg-[var(--g-green)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--g-green)]">
                Live
              </span>
            </div>
            <div className="font-display mt-5 text-3xl font-medium tracking-tight text-ink">
              {s.value}
            </div>
            <div className="mt-1 text-sm font-semibold text-ink">{s.label}</div>
            <div className="mt-0.5 text-xs text-muted">{s.sub}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.85fr]">
        <div className="surface rounded-2xl p-6">
          <div className="eyebrow">Progress</div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Assessment completion</h2>
          <div className="mt-8 flex items-end justify-between">
            <div className="font-display text-4xl font-medium tracking-tight text-[var(--g-green)]">
              {completion}%
            </div>
            <div className="text-xs text-muted">{scores.length} records captured</div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-[var(--g-green)] transition-all duration-700"
              style={{ width: `${completion}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted">
            <span>Data entry progress</span>
            <span>Target: complete term records</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-[var(--g-green)] p-6 text-white">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--g-gold)]/20" />
          <div className="absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/5" />
          <div className="relative">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--g-gold)]">
              Next step
            </div>
            <div className="font-display mt-3 text-xl font-medium leading-snug">
              Ready to issue terminal reports?
            </div>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Review scores and remarks, then generate branded PDFs for the class.
            </p>
            <Link
              href="/dashboard/reports"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--g-gold)] px-5 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-black/15 transition hover:brightness-105"
            >
              Go to reports
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="eyebrow">Structure</div>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight">Classes</h2>
          </div>
          <Link
            href="/dashboard/classes"
            className="text-xs font-semibold text-[var(--g-green)] underline-offset-2 hover:underline"
          >
            Manage
          </Link>
        </div>
        <div className="divide-y divide-line">
          {classRows.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 px-6 py-3.5 transition hover:bg-paper/80"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--g-green)]/10 text-xs font-bold text-[var(--g-green)]">
                {c.name.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{c.name}</div>
                <div className="text-xs text-muted">
                  {c.level} · {c.count} students
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-ink">
                  {c.avg}
                  {c.avg !== "—" ? "%" : ""}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">Average</div>
              </div>
            </div>
          ))}
          {classRows.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-muted">
              No classes configured yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
