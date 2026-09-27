"use client";
import Link from "next/link";
import { Users, School, ClipboardCheck, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Empty } from "@/components/ui";
import { roleNames, isLeader } from "@/lib/models";
export default function Dashboard() {
  const { data: w } = useWorkspace();
  const term = w.terms.find(
      (t) =>
        t.academic_year === w.school.academic_year &&
        t.term === w.school.current_term,
    ),
    scores = w.scores.filter(
      (s) =>
        s.academic_year === w.school.academic_year &&
        s.term === w.school.current_term,
    );
  const stats = [
    {
      label: "Active learners",
      value: w.students.filter((s) => s.status === "ACTIVE").length,
      icon: Users,
    },
    { label: "Classes in your view", value: w.classes.length, icon: School },
    {
      label: "Assessments recorded",
      value: scores.length,
      icon: ClipboardCheck,
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow={roleNames[w.profile.role]}
        title={`Welcome, ${w.profile.full_name.split(" ")[0]}`}
        description={`${w.school.name} · ${w.school.academic_year} · Term ${w.school.current_term}. Your view includes records permitted by your school assignments.`}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="surface rounded-2xl p-6">
            <s.icon size={22} className="text-[var(--g-green)]" />
            <div className="mt-5 text-4xl font-semibold tabular-nums">
              {s.value}
            </div>
            <div className="mt-2 text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="surface rounded-2xl p-6">
          <div className="eyebrow">This term</div>
          <h2 className="mt-3 text-xl font-semibold">
            {term?.status === "OPEN" ? "Ready for assessment" : "Term closed"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {term?.status === "OPEN"
              ? "Assessment records are shared across authorised staff accounts. Save marks as you work; your headmaster can review them from their own device."
              : "This term is locked. Its saved reports remain available in the report archive."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {w.profile.role !== "HEADTEACHER" && (
              <Link href="/dashboard/scores" className="btn-primary">
                Open assessment <ArrowRight size={16} />
              </Link>
            )}
            {(isLeader(w.profile.role) ||
              w.classes.some((c) => c.class_teacher_id === w.profile.id)) && (
              <Link href="/dashboard/reports" className="btn-secondary">
                Review reports
              </Link>
            )}
          </div>
        </section>
        <section className="surface rounded-2xl p-6">
          <div className="eyebrow">Your classes</div>
          {w.classes.length ? (
            <ul className="mt-3 divide-y divide-line">
              {w.classes.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted">
                    {
                      w.students.filter(
                        (s) => s.class_id === c.id && s.status === "ACTIVE",
                      ).length
                    }{" "}
                    learners
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted">
              No class has been assigned yet.{" "}
              {w.profile.role === "ADMIN"
                ? "Add your classes and assign staff to get started."
                : "Your administrator will assign your classes and subjects."}
            </p>
          )}
        </section>
      </div>
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
    </>
  );
}
