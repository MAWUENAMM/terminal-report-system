"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  School,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { Empty } from "@/components/ui";
import { isLeader, roleNames } from "@/lib/models";

const termName = (term: number) =>
  term === 1 ? "First Term" : term === 2 ? "Second Term" : "Third Term";

export default function Dashboard() {
  const { data: w } = useWorkspace();

  const term = w.terms.find(
    (item) =>
      item.academic_year === w.school.academic_year &&
      item.term === w.school.current_term,
  );

  const activeStudents = w.students.filter((student) => student.status === "ACTIVE");
  const scores = w.scores.filter(
    (score) =>
      score.academic_year === w.school.academic_year &&
      score.term === w.school.current_term,
  );

  const expectedSubjects = new Map<string, number>();
  for (const cls of w.classes) {
    const assigned = new Set(
      w.assignments
        .filter((assignment) => assignment.class_id === cls.id)
        .map((assignment) => assignment.subject_id),
    );
    const fallback = w.subjects.filter(
      (subject) =>
        subject.active &&
        (subject.level === "ALL" || subject.level === cls.level),
    );
    expectedSubjects.set(cls.id, assigned.size || fallback.length);
  }

  const expectedScoreRecords = w.classes.reduce((total, cls) => {
    const learners = activeStudents.filter((student) => student.class_id === cls.id).length;
    return total + learners * (expectedSubjects.get(cls.id) || 0);
  }, 0);

  const assessmentCompletion = expectedScoreRecords
    ? Math.min(100, Math.round((scores.length / expectedScoreRecords) * 100))
    : 0;

  const readyReports = activeStudents.filter((student) => {
    const expected = expectedSubjects.get(student.class_id) || 0;
    const studentScores = scores.filter((score) => score.student_id === student.id);
    const scoredSubjects = new Set(studentScores.map((score) => score.subject_id)).size;
    const attendance = w.attendance.find(
      (item) =>
        item.student_id === student.id &&
        item.academic_year === w.school.academic_year &&
        item.term === w.school.current_term,
    );
    const affective = w.affective.find(
      (item) =>
        item.student_id === student.id &&
        item.academic_year === w.school.academic_year &&
        item.term === w.school.current_term,
    );
    const remark = w.remarks.find(
      (item) =>
        item.student_id === student.id &&
        item.academic_year === w.school.academic_year &&
        item.term === w.school.current_term,
    );

    return (
      expected > 0 &&
      scoredSubjects >= expected &&
      Boolean(attendance) &&
      Boolean(affective) &&
      Boolean(remark?.class_teacher_remark?.trim()) &&
      Boolean(remark?.headteacher_remark?.trim())
    );
  }).length;

  const reportReadiness = activeStudents.length
    ? Math.round((readyReports / activeStudents.length) * 100)
    : 0;

  const classStats = w.classes
    .map((cls) => {
      const learners = activeStudents.filter((student) => student.class_id === cls.id);
      const classScores = scores.filter((score) => score.class_id === cls.id);
      const average = classScores.length
        ? classScores.reduce((sum, score) => sum + Number(score.total), 0) /
          classScores.length
        : 0;
      return {
        id: cls.id,
        name: cls.name,
        learners: learners.length,
        average,
        scoreCount: classScores.length,
        subjectCount: new Set(classScores.map((score) => score.subject_id)).size,
      };
    })
    .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));

  const schoolAverage = scores.length
    ? scores.reduce((sum, score) => sum + Number(score.total), 0) / scores.length
    : 0;

  const stats = [
    {
      label: "Active learners",
      value: activeStudents.length,
      helper: String(w.classes.length) + " classes in your view",
      icon: Users,
    },
    {
      label: "Assessment completion",
      value: String(assessmentCompletion) + "%",
      helper: String(scores.length) + " of " + String(expectedScoreRecords || 0) + " expected score records",
      icon: ClipboardCheck,
    },
    {
      label: "Reports ready",
      value: readyReports,
      helper: String(reportReadiness) + "% of active learners",
      icon: FileText,
    },
    {
      label: "School average",
      value: scores.length ? schoolAverage.toFixed(1) + "%" : "—",
      helper: scores.length ? "Across recorded current-term scores" : "No scores recorded yet",
      icon: TrendingUp,
    },
  ];

  const quickActions =
    w.profile.role === "ADMIN"
      ? [
          ["/dashboard/students", "Manage learners", Users],
          ["/dashboard/classes", "Manage classes", School],
          ["/dashboard/staff", "Staff accounts", UserRound],
          ["/dashboard/settings", "School settings", Settings],
        ]
      : w.profile.role === "HEADTEACHER"
        ? [
            ["/dashboard/reports", "Review reports", FileText],
            ["/dashboard/terms", "Academic terms", CalendarDays],
            ["/dashboard/students", "Learner records", Users],
            ["/dashboard/classes", "Class overview", School],
          ]
        : w.profile.role === "CLASS_TEACHER"
          ? [
              ["/dashboard/reports", "Class reports", FileText],
              ["/dashboard/scores", "Assessment entry", ClipboardCheck],
              ["/dashboard/students", "Learner records", Users],
              ["/dashboard/classes", "My class", School],
            ]
          : [
              ["/dashboard/scores", "Assessment entry", ClipboardCheck],
              ["/dashboard/students", "Learner records", Users],
              ["/dashboard/classes", "Assigned classes", School],
              ["/dashboard/profile", "My profile", UserRound],
            ];

  const recentEvents = [...w.termEvents]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="dashboard-reveal overflow-hidden rounded-[28px] border border-emerald-950/10 bg-[linear-gradient(135deg,#0b2e22_0%,#0f5a45_58%,#087a55_100%)] p-6 text-white shadow-[0_24px_60px_rgba(0,56,35,0.18)] sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                {roleNames[w.profile.role]}
              </span>
              <span className={"rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] " + (term?.status === "OPEN" ? "bg-emerald-300/15 text-emerald-100" : "bg-amber-300/15 text-amber-100")}>
                {term?.status === "OPEN" ? "Term open" : "Term closed"}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              Welcome back, {w.profile.full_name.split(" ")[0]}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
              {w.school.name} · {w.school.academic_year} · {termName(w.school.current_term)}.
              Here is the current reporting picture for the records available to your role.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {w.profile.role !== "HEADTEACHER" && (
              <Link
                href="/dashboard/scores"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--g-gold)] px-5 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5"
              >
                Open assessment <ArrowRight size={16} />
              </Link>
            )}
            {(isLeader(w.profile.role) ||
              w.classes.some((cls) => cls.class_teacher_id === w.profile.id)) && (
              <Link
                href="/dashboard/reports"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Review reports
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <article
            key={stat.label}
            className="dashboard-reveal surface group rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            style={{ animationDelay: String(70 + index * 70) + "ms" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-3 text-3xl font-bold tracking-[-0.035em] text-slate-950 tabular-nums">
                  {stat.value}
                </p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:scale-105">
                <stat.icon size={20} strokeWidth={1.9} />
              </span>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">{stat.helper}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
        <article
          className="dashboard-reveal surface rounded-2xl p-5 sm:p-6"
          style={{ animationDelay: "340ms" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Class performance</p>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                Current-term overview
              </h2>
              <p className="mt-1 text-sm text-muted">
                Average of the score records currently entered for each class.
              </p>
            </div>
            <Link
              href="/dashboard/reports"
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              Open reports →
            </Link>
          </div>

          {classStats.length ? (
            <div className="mt-6 space-y-5">
              {classStats.slice(0, 7).map((cls, index) => (
                <div key={cls.id} className="group">
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{cls.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {cls.learners} learners · {cls.subjectCount} subjects scored
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-slate-950">
                      {cls.scoreCount ? cls.average.toFixed(1) + "%" : "—"}
                    </p>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="dashboard-bar h-full rounded-full bg-[linear-gradient(90deg,#0f5a45,#29a56f)]"
                      style={{
                        width: String(Math.max(0, Math.min(100, cls.average))) + "%",
                        animationDelay: String(420 + index * 70) + "ms",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">No classes are available in your view yet.</p>
          )}
        </article>

        <article
          className="dashboard-reveal surface rounded-2xl p-5 sm:p-6"
          style={{ animationDelay: "410ms" }}
        >
          <p className="eyebrow">Reporting progress</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
            Term readiness
          </h2>

          <div className="mt-6 flex items-center gap-5">
            <div
              className="grid h-32 w-32 shrink-0 place-items-center rounded-full"
              style={{
                background:
                  "conic-gradient(var(--g-green) " +
                  String(reportReadiness * 3.6) +
                  "deg, #e8eee9 0deg)",
              }}
            >
              <div className="grid h-[98px] w-[98px] place-items-center rounded-full bg-white text-center shadow-inner">
                <div>
                  <div className="text-2xl font-bold tabular-nums text-slate-950">
                    {reportReadiness}%
                  </div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    report ready
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-5">
                <span className="text-muted">Reports ready</span>
                <strong className="tabular-nums">{readyReports}/{activeStudents.length}</strong>
              </div>
              <div className="flex items-center justify-between gap-5">
                <span className="text-muted">Assessment</span>
                <strong className="tabular-nums">{assessmentCompletion}%</strong>
              </div>
              <div className="flex items-center justify-between gap-5">
                <span className="text-muted">Term status</span>
                <strong>{term?.status || "—"}</strong>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <p className="text-xs leading-6 text-slate-600">
                A report counts as ready when its expected subjects, attendance,
                learner development, class-teacher remark and headteacher remark are complete.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article
          className="dashboard-reveal surface rounded-2xl p-5 sm:p-6"
          style={{ animationDelay: "480ms" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Quick actions</p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">Continue your work</h2>
            </div>
            <BookOpen className="h-5 w-5 text-slate-300" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickActions.map(([href, label, Icon]) => {
              const C = Icon as typeof Users;
              return (
                <Link
                  key={String(href)}
                  href={String(href)}
                  className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-200 hover:bg-emerald-50/40"
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-emerald-100 group-hover:text-emerald-700">
                      <C size={17} />
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{String(label)}</span>
                  </span>
                  <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
                </Link>
              );
            })}
          </div>
        </article>

        <article
          className="dashboard-reveal surface rounded-2xl p-5 sm:p-6"
          style={{ animationDelay: "550ms" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Term activity</p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">Latest workflow events</h2>
            </div>
            <CalendarDays className="h-5 w-5 text-slate-300" />
          </div>

          {recentEvents.length ? (
            <div className="mt-5 space-y-1">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
                  <span className={"mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full " + (event.action === "CLOSED" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                    <CheckCircle2 size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      Term {event.action === "CLOSED" ? "closed" : "reopened"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {event.actor_name}
                      {event.reason ? " · " + event.reason : ""}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(event.created_at).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-muted">
              No term close/reopen activity has been recorded yet.
            </p>
          )}
        </article>
      </section>

      {w.profile.role === "ADMIN" && !w.classes.length && (
        <Empty>
          Start with{" "}
          <Link className="font-semibold underline" href="/dashboard/staff">
            staff accounts
          </Link>
          , then{" "}
          <Link className="font-semibold underline" href="/dashboard/classes">
            classes
          </Link>
          ,{" "}
          <Link className="font-semibold underline" href="/dashboard/subjects">
            subjects
          </Link>{" "}
          and{" "}
          <Link className="font-semibold underline" href="/dashboard/students">
            learners
          </Link>
          .
        </Empty>
      )}
    </div>
  );
}
