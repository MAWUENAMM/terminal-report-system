"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CalendarDays,
  Download,
  FileText,
  GraduationCap,
  HeartPulse,
  MessageSquareText,
  PencilLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Modal, Field } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { browserClient } from "@/lib/supabase/client";
import { currentSnapshot, downloadReport } from "@/lib/reporting";
import { fullName, isLeader, type Student } from "@/lib/models";
import { computePositions, getGrade, getPerformanceRemark } from "@/lib/grading";
import { resolveSchoolLogoUrl } from "@/lib/school-branding";

type Props = {
  student: Student;
  onClose: () => void;
};

const termLabel = (term: number) =>
  term === 1 ? "First Term" : term === 2 ? "Second Term" : "Third Term";

function scoreTone(score: number) {
  if (score >= 80) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (score >= 70) return "border-blue-200 bg-blue-50 text-blue-800";
  if (score >= 60) return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (score >= 50) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function StudentProfile({ student, onClose }: Props) {
  const { data: w, run, busy } = useWorkspace();
  const snapshot = useMemo(() => currentSnapshot(w, student), [w, student]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [section, setSection] = useState<"overview" | "results" | "development" | "history">("overview");
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<Record<string, string | number>>({});
  const [downloading, setDownloading] = useState(false);

  const cls = w.classes.find((c) => c.id === student.class_id);
  const leader = isLeader(w.profile.role);
  const ownClass =
    w.profile.role === "ADMIN" || cls?.class_teacher_id === w.profile.id;
  const termOpen = w.terms.some(
    (t) =>
      t.academic_year === w.school.academic_year &&
      t.term === w.school.current_term &&
      t.status === "OPEN",
  );
  const canEditNotes = ownClass || leader;
  const archives = w.archives
    .filter((a) => a.student_id === student.id)
    .sort(
      (a, b) =>
        b.academic_year.localeCompare(a.academic_year) ||
        b.term - a.term ||
        b.revision - a.revision,
    );

  useEffect(() => {
    let active = true;
    void resolveSchoolLogoUrl(w.school.logo_url).then((url) => {
      if (active) setLogoUrl(url);
    });
    return () => {
      active = false;
    };
  }, [w.school.logo_url]);

  function startEditing() {
    setNotes({
      days_present: snapshot.attendance?.days_present || 0,
      total_days: snapshot.attendance?.total_days || 0,
      conduct: snapshot.affective?.conduct || "",
      interest: snapshot.affective?.interest || "",
      attitude: snapshot.affective?.attitude || "",
      talents: snapshot.affective?.talents || "",
      class_teacher_remark: snapshot.remarks?.class_teacher_remark || "",
      headteacher_remark: snapshot.remarks?.headteacher_remark || "",
    });
    setEditing(true);
  }

  async function saveNotes(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload: Record<string, string | number> = {};
    if (ownClass)
      for (const key of [
        "days_present",
        "total_days",
        "conduct",
        "interest",
        "attitude",
        "talents",
        "class_teacher_remark",
      ])
        payload[key] = notes[key];
    if (leader) payload.headteacher_remark = notes.headteacher_remark;

    const ok = await run(async () => {
      const { error } = await browserClient().rpc("save_report_notes", {
        learner_id: student.id,
        notes: payload,
      });
      if (error) throw new Error(error.message);
    }, "Student development records saved.");
    if (ok) setEditing(false);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await run(
        () => downloadReport(snapshot),
        "Professional terminal report downloaded.",
      );
    } finally {
      setDownloading(false);
    }
  }

  const scoreRows = [...snapshot.scores].sort((a, b) => {
    const ao = w.subjects.find((s) => s.id === a.subject_id)?.display_order ?? 999;
    const bo = w.subjects.find((s) => s.id === b.subject_id)?.display_order ?? 999;
    return ao - bo;
  });
  const average = snapshot.scores.length
    ? snapshot.scores.reduce((sum, s) => sum + Number(s.total), 0) / snapshot.scores.length
    : 0;
  const classAverages = useMemo(() => {
    return snapshot.class_students.map((classStudent) => {
      const scores = snapshot.class_scores.filter((score) => score.student_id === classStudent.id);
      return {
        studentId: classStudent.id,
        total: scores.length
          ? scores.reduce((sum, score) => sum + Number(score.total), 0) / scores.length
          : 0,
      };
    });
  }, [snapshot.class_scores, snapshot.class_students]);
  const overallPosition = useMemo(
    () => computePositions(classAverages).get(student.id),
    [classAverages, student.id],
  );
  const totalStudents = snapshot.class_students.length;
  const overallGrade = snapshot.scores.length ? getGrade(average).grade : "—";
  const subjectPositions = useMemo(() => {
    const positions = new Map<string, number>();
    for (const subject of w.subjects) {
      const rows = w.scores.filter(
        (s) =>
          s.class_id === student.class_id &&
          s.subject_id === subject.id &&
          s.academic_year === w.school.academic_year &&
          s.term === w.school.current_term,
      );
      const rank = computePositions(
        rows.map((s) => ({ studentId: s.student_id, total: Number(s.total) })),
      ).get(student.id);
      if (rank) positions.set(subject.id, rank);
    }
    return positions;
  }, [student.class_id, student.id, w.school.academic_year, w.school.current_term, w.scores, w.subjects]);

  return (
    <Modal title={`Student profile · ${fullName(student)}`} onClose={onClose} size="wide">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white">
        {logoUrl && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.035]">
            <Image src={logoUrl} alt="" width={700} height={700} unoptimized className="h-[62%] w-[62%] object-contain grayscale" />
          </div>
        )}

        <div className="relative z-10">
          <header className="bg-[linear-gradient(135deg,#102033_0%,#173d3a_55%,#0f5a45_100%)] px-5 py-6 text-white sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/25 bg-white/10 p-2">
                  {logoUrl ? (
                    <Image src={logoUrl} alt={w.school.name} width={64} height={64} unoptimized className="h-full w-full object-contain" />
                  ) : (
                    <GraduationCap className="h-8 w-8 text-white/80" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Learner profile</p>
                  <h2 className="mt-1 truncate text-xl font-bold sm:text-2xl">{w.school.name}</h2>
                  <p className="mt-1 text-sm text-white/75">
                    {w.school.district || w.school.region || "School workspace"} · {termLabel(w.school.current_term)} · {w.school.academic_year}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEditNotes && termOpen && (
                  <button className="btn-secondary !border-white/20 !bg-white/10 !text-white hover:!bg-white/15" onClick={startEditing}>
                    <PencilLine className="mr-2 inline h-4 w-4" /> Edit records
                  </button>
                )}
                <button
                  className="btn-primary !bg-white !text-slate-900"
                  disabled={!snapshot.scores.length || busy || downloading}
                  onClick={() => void handleDownload()}
                >
                  <Download className="mr-2 inline h-4 w-4" />
                  {downloading ? "Preparing…" : "Download report"}
                </button>
              </div>
            </div>
          </header>

          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[220px_1fr]">
            <aside className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-white">
                  {student.photo_url ? (
                    <img src={student.photo_url} alt={fullName(student)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-slate-400">
                      <UserRound className="h-16 w-16" />
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-slate-900">{fullName(student)}</h3>
                  <p className="mt-1 text-sm text-slate-500">{student.admission_number}</p>
                  <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {student.status}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Profile sections</p>
                {([
                  ["overview", "Overview", UserRound],
                  ["results", "Academic results", BookOpen],
                  ["development", "Attendance & development", HeartPulse],
                  ["history", "Report history", FileText],
                ] as const).map(([key, label, Icon]) => (
                  <button
                    key={key as string}
                    onClick={() => setSection(key as typeof section)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${section === key ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label as string}
                  </button>
                ))}
              </div>
            </aside>

            <main className="min-w-0">
              {section === "overview" && (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {([
                      ["Average", snapshot.scores.length ? `${average.toFixed(1)}%` : "—", Award],
                      ["Position", overallPosition ? `${overallPosition} / ${totalStudents}` : "—", GraduationCap],
                      ["Subjects", String(snapshot.scores.length), BookOpen],
                      ["Attendance", snapshot.attendance?.total_days ? `${snapshot.attendance.days_present}/${snapshot.attendance.total_days}` : "—", CalendarDays],
                    ] as const).map(([label, value, Icon]) => (
                      <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label as string}</span>
                          <Icon className="h-4 w-4 text-slate-400" />
                        </div>
                        <p className="mt-3 text-2xl font-bold text-slate-900">{value as string}</p>
                      </div>
                    ))}
                  </div>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold">Learner information</h3>
                    </div>
                    <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                      {[
                        ["Full name", fullName(student)],
                        ["Admission number", student.admission_number],
                        ["Class", cls?.name || "—"],
                        ["Gender", student.gender === "F" ? "Female" : "Male"],
                        ["Date of birth", student.date_of_birth || "Not recorded"],
                        ["Academic year", w.school.academic_year],
                        ["Current term", termLabel(w.school.current_term)],
                        ["Guardian", student.guardian_name || "Not recorded"],
                        ["Guardian phone", student.guardian_phone || "Not recorded"],
                        ["School status", student.status],
                      ].map(([label, value]) => (
                        <div key={label} className="border-b border-slate-100 pb-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold">Teacher observations</h3>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Class teacher</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{snapshot.remarks?.class_teacher_remark || "No class teacher remark recorded yet."}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Headteacher</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{snapshot.remarks?.headteacher_remark || "No headteacher remark recorded yet."}</p>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {section === "results" && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Current term</p>
                        <h3 className="mt-1 text-lg font-bold">{termLabel(w.school.current_term)} results</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Overall grade</p>
                        <p className="text-2xl font-black text-slate-900">{snapshot.scores.length ? overallGrade}</p>
                      </div>
                    </div>
                    <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full min-w-[680px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3 text-center">SBA</th>
                            <th className="px-4 py-3 text-center">Exam</th>
                            <th className="px-4 py-3 text-center">Total</th>
                            <th className="px-4 py-3 text-center">Grade</th>
                            <th className="px-4 py-3 text-center">Pos.</th>
                            <th className="px-4 py-3">Remark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {scoreRows.length ? scoreRows.map((score) => {
                            const subject = w.subjects.find((s) => s.id === score.subject_id);
                            const total = Number(score.total);
                            const remark = score.subject_remark || getPerformanceRemark(total);
                            return (
                              <tr key={score.id}>
                                <td className="px-4 py-3 font-semibold text-slate-800">{subject?.name || "Subject"}</td>
                                <td className="px-4 py-3 text-center">{Number(score.sba_scaled).toFixed(1)}</td>
                                <td className="px-4 py-3 text-center">{Number(score.exam_scaled).toFixed(1)}</td>
                                <td className="px-4 py-3 text-center font-bold">{total.toFixed(1)}</td>
                                <td className="px-4 py-3 text-center font-bold">{score.grade}</td>
                                <td className="px-4 py-3 text-center">{subjectPositions.get(score.subject_id) || "—"}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${scoreTone(total)}`}>{remark}</span>
                                </td>
                              </tr>
                            );
                          }) : (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No scores have been entered for this term.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      ["Total score", snapshot.scores.reduce((n, s) => n + Number(s.total), 0).toFixed(1)],
                      ["Average", snapshot.scores.length ? `${average.toFixed(1)}%` : "—"],
                      ["Class position", overallPosition ? `${overallPosition} of ${totalStudents}` : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                        <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {section === "development" && (
                <div className="space-y-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold">Attendance</h3>
                    </div>
                    {snapshot.attendance ? (
                      <div className="mt-5 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Days present</p><p className="mt-1 text-2xl font-black text-emerald-900">{snapshot.attendance.days_present}</p></div>
                        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Total school days</p><p className="mt-1 text-2xl font-black text-slate-900">{snapshot.attendance.total_days}</p></div>
                        <div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs text-blue-700">Attendance rate</p><p className="mt-1 text-2xl font-black text-blue-900">{snapshot.attendance.total_days ? ((snapshot.attendance.days_present / snapshot.attendance.total_days) * 100).toFixed(1) : "0.0"}%</p></div>
                      </div>
                    ) : <p className="mt-4 text-sm text-slate-500">No attendance record has been entered for this term.</p>}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold">Affective & learner development</h3>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {[
                        ["Conduct", snapshot.affective?.conduct],
                        ["Interest", snapshot.affective?.interest],
                        ["Attitude", snapshot.affective?.attitude],
                        ["Talents", snapshot.affective?.talents],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{value || "Not recorded"}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold">Manual remarks</h3>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Class teacher</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{snapshot.remarks?.class_teacher_remark || "No remark yet."}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Headteacher</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{snapshot.remarks?.headteacher_remark || "No remark yet."}</p>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {section === "history" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Permanent report history</p>
                    <h3 className="mt-1 text-lg font-bold">Closed-term reports</h3>
                    {archives.length ? (
                      <div className="mt-5 space-y-3">
                        {archives.map((archive) => (
                          <div key={archive.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-semibold">{archive.academic_year} · {termLabel(archive.term)} · Version {archive.revision}</p>
                              <p className="mt-1 text-xs text-slate-500">Archived {new Date(archive.created_at).toLocaleDateString("en-GB")}</p>
                            </div>
                            <button
                              className="btn-secondary"
                              onClick={() => void run(async () => {
                                const { data, error } = await browserClient().from("report_archives").select("snapshot").eq("id", archive.id).single();
                                if (error) throw new Error(error.message);
                                await downloadReport(data.snapshot, archive.revision);
                              }, "Archived report downloaded.")}
                            >
                              <Download className="mr-2 inline h-4 w-4" /> Download
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-4 text-sm text-slate-500">No closed-term report has been archived for this learner yet.</p>}
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {editing && (
        <Modal title={`Edit learner records · ${fullName(student)}`} onClose={() => setEditing(false)}>
          <form className="space-y-5" onSubmit={(e) => void saveNotes(e)}>
            {ownClass && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Days present"><input className="field" type="number" min={0} max={366} value={notes.days_present} onChange={(e) => setNotes({...notes, days_present: Number(e.target.value)})} /></Field>
                  <Field label="Total school days"><input className="field" type="number" min={0} max={366} value={notes.total_days} onChange={(e) => setNotes({...notes, total_days: Number(e.target.value)})} /></Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {["conduct","interest","attitude","talents"].map((key) => (
                    <Field key={key} label={key[0].toUpperCase()+key.slice(1)}>
                      <input className="field" maxLength={150} value={notes[key]} onChange={(e) => setNotes({...notes,[key]:e.target.value})} />
                    </Field>
                  ))}
                </div>
                <Field label="Class teacher’s remark">
                  <textarea className="field" rows={4} maxLength={500} value={notes.class_teacher_remark} onChange={(e) => setNotes({...notes,class_teacher_remark:e.target.value})} />
                </Field>
              </>
            )}
            {leader && (
              <Field label="Headteacher’s remark">
                <textarea className="field" rows={4} maxLength={500} value={notes.headteacher_remark} onChange={(e) => setNotes({...notes,headteacher_remark:e.target.value})} />
              </Field>
            )}
            {termOpen && <button disabled={busy} className="btn-primary">Save records</button>}
          </form>
        </Modal>
      )}
    </Modal>
  );
}
