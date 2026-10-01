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
  ImagePlus,
  MessageSquareText,
  PencilLine,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Field, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { browserClient } from "@/lib/supabase/client";
import { currentSnapshot, downloadReport } from "@/lib/reporting";
import { fullName, isLeader, type Student } from "@/lib/models";
import { computePositions, getGrade, getPerformanceRemark } from "@/lib/grading";
import {
  removeStudentPhoto,
  resolveSchoolAssetUrl,
  resolveSchoolLogoUrl,
  uploadStudentPhoto,
} from "@/lib/school-branding";

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
  const currentStudent = w.students.find((item) => item.id === student.id) || student;
  const snapshot = useMemo(() => currentSnapshot(w, currentStudent), [w, currentStudent]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [section, setSection] = useState<"overview" | "results" | "development" | "history">("overview");
  const [editing, setEditing] = useState(false);
  const [photoEditing, setPhotoEditing] = useState(false);
  const [notes, setNotes] = useState<Record<string, string | number>>({});
  const [downloading, setDownloading] = useState(false);

  const cls = w.classes.find((c) => c.id === currentStudent.class_id);
  const leader = isLeader(w.profile.role);
  const ownClass = w.profile.role === "ADMIN" || cls?.class_teacher_id === w.profile.id;
  const termOpen = w.terms.some(
    (t) =>
      t.academic_year === w.school.academic_year &&
      t.term === w.school.current_term &&
      t.status === "OPEN",
  );
  const canEditNotes = ownClass || leader;
  const archives = w.archives
    .filter((a) => a.student_id === currentStudent.id)
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

  useEffect(() => {
    let active = true;
    void resolveSchoolAssetUrl(currentStudent.photo_url).then((url) => {
      if (active) setPhotoUrl(url);
    });
    return () => {
      active = false;
    };
  }, [currentStudent.photo_url]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

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
        learner_id: currentStudent.id,
        notes: payload,
      });
      if (error) throw new Error(error.message);
    }, "Student development records saved.");
    if (ok) setEditing(false);
  }

  async function savePhoto() {
    if (!photoFile) return;
    const ok = await run(async () => {
      const signed = await uploadStudentPhoto(w.school.id, currentStudent.id, photoFile);
      setPhotoUrl(signed);
      setPhotoFile(null);
    }, "Learner photo saved. It will appear in the profile and terminal report.");
    if (ok) setPhotoEditing(false);
  }

  async function deletePhoto() {
    if (!confirm(`Remove ${fullName(currentStudent)}’s photo?`)) return;
    const ok = await run(async () => {
      await removeStudentPhoto(w.school.id, currentStudent.id);
      setPhotoUrl(null);
      setPhotoFile(null);
    }, "Learner photo removed.");
    if (ok) setPhotoEditing(false);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await run(() => downloadReport(snapshot), "Professional terminal report downloaded.");
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
  const classAverages = useMemo(
    () =>
      snapshot.class_students.map((classStudent) => {
        const scores = snapshot.class_scores.filter((score) => score.student_id === classStudent.id);
        return {
          studentId: classStudent.id,
          total: scores.length
            ? scores.reduce((sum, score) => sum + Number(score.total), 0) / scores.length
            : 0,
        };
      }),
    [snapshot.class_scores, snapshot.class_students],
  );
  const overallPosition = useMemo(
    () => computePositions(classAverages).get(currentStudent.id),
    [classAverages, currentStudent.id],
  );
  const totalStudents = snapshot.class_students.length;
  const overallGrade = snapshot.scores.length ? getGrade(average).grade : "—";
  const subjectPositions = useMemo(() => {
    const positions = new Map<string, number>();
    for (const subject of w.subjects) {
      const rows = w.scores.filter(
        (s) =>
          s.class_id === currentStudent.class_id &&
          s.subject_id === subject.id &&
          s.academic_year === w.school.academic_year &&
          s.term === w.school.current_term,
      );
      const rank = computePositions(
        rows.map((s) => ({ studentId: s.student_id, total: Number(s.total) })),
      ).get(currentStudent.id);
      if (rank) positions.set(subject.id, rank);
    }
    return positions;
  }, [currentStudent.class_id, currentStudent.id, w.school.academic_year, w.school.current_term, w.scores, w.subjects]);

  return (
    <Modal title={`Student profile · ${fullName(currentStudent)}`} onClose={onClose} size="wide">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white">
        {logoUrl && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.045]">
            <Image src={logoUrl} alt="" width={760} height={760} unoptimized className="h-[70%] w-[70%] object-contain grayscale" />
          </div>
        )}

        <div className="relative z-10">
          <header className="relative overflow-hidden border-b border-slate-200 bg-white px-5 py-6 sm:px-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ce1126_0_33%,#fcd116_33%_66%,#006b3f_66%_100%)]" />
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 p-2.5 shadow-sm">
                  {logoUrl ? (
                    <Image src={logoUrl} alt={w.school.name} width={80} height={80} unoptimized className="h-full w-full object-contain" />
                  ) : (
                    <GraduationCap className="h-9 w-9 text-emerald-700" />
                  )}
                </div>
                <div className="min-w-0 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Learner academic profile</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {termLabel(w.school.current_term)}
                    </span>
                  </div>
                  <h2 className="mt-2 max-w-2xl break-words text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-3xl">
                    {w.school.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {[w.school.address, w.school.district, w.school.region].filter(Boolean).join(" · ") || "School workspace"}
                  </p>
                  <p className="text-xs font-semibold text-slate-400">{w.school.academic_year} academic year</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 xl:max-w-[440px] xl:justify-end">
                {leader && (
                  <button className="btn-secondary !py-2.5" onClick={() => setPhotoEditing(true)}>
                    <ImagePlus className="h-4 w-4" /> Learner photo
                  </button>
                )}
                {canEditNotes && termOpen && (
                  <button className="btn-secondary !py-2.5" onClick={startEditing}>
                    <PencilLine className="h-4 w-4" /> Edit records
                  </button>
                )}
                <button
                  className="btn-primary !py-2.5"
                  disabled={!snapshot.scores.length || busy || downloading}
                  onClick={() => void handleDownload()}
                >
                  <Download className="h-4 w-4" />
                  {downloading ? "Preparing…" : "Download report"}
                </button>
              </div>
            </div>
          </header>

          <div className="grid gap-6 bg-slate-50/70 p-5 sm:p-8 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-white">
                  {photoUrl ? (
                    <img src={photoUrl} alt={fullName(currentStudent)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-slate-400"><UserRound className="h-16 w-16" /></div>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-slate-900">{fullName(currentStudent)}</h3>
                  <p className="mt-1 text-sm text-slate-500">{currentStudent.admission_number}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{cls?.name || "Class not assigned"}</p>
                  <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{currentStudent.status}</span>
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
                  <button key={key} onClick={() => setSection(key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${section === key ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}>
                    <Icon className="h-4 w-4" /> {label}
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
                      ["Grade", overallGrade, BookOpen],
                      ["Attendance", snapshot.attendance?.total_days ? `${snapshot.attendance.days_present}/${snapshot.attendance.total_days}` : "—", CalendarDays],
                    ] as const).map(([label, value, Icon]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-4 w-4" /></span></div>
                        <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
                      </div>
                    ))}
                  </div>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h3 className="font-bold">Learner information</h3></div>
                    <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                      {[
                        ["Full name", fullName(currentStudent)],
                        ["Admission number", currentStudent.admission_number],
                        ["Class", cls?.name || "—"],
                        ["Gender", currentStudent.gender === "F" ? "Female" : "Male"],
                        ["Date of birth", currentStudent.date_of_birth || "Not recorded"],
                        ["Academic year", w.school.academic_year],
                        ["Current term", termLabel(w.school.current_term)],
                        ["Guardian", currentStudent.guardian_name || "Not recorded"],
                        ["Guardian phone", currentStudent.guardian_phone || "Not recorded"],
                        ["School status", currentStudent.status],
                      ].map(([label, value]) => (
                        <div key={label} className="border-b border-slate-100 pb-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-emerald-700" /><h3 className="font-bold">Teacher observations</h3></div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Class teacher</p><p className="mt-2 text-sm leading-6 text-slate-700">{snapshot.remarks?.class_teacher_remark || "No class teacher remark recorded yet."}</p></div>
                      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Headteacher</p><p className="mt-2 text-sm leading-6 text-slate-700">{snapshot.remarks?.headteacher_remark || "No headteacher remark recorded yet."}</p></div>
                    </div>
                  </section>
                </div>
              )}

              {section === "results" && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Current term</p><h3 className="mt-1 text-lg font-bold">{termLabel(w.school.current_term)} results</h3></div><div className="text-right"><p className="text-xs text-slate-400">Overall grade</p><p className="text-2xl font-black text-slate-900">{overallGrade}</p></div></div>
                    <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full min-w-[680px] text-sm">
                        <thead className="bg-slate-900 text-left text-[10px] uppercase tracking-[0.12em] text-white"><tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3 text-center">SBA {w.school.sba_weight}%</th><th className="px-4 py-3 text-center">Exam {w.school.exam_weight}%</th><th className="px-4 py-3 text-center">Total</th><th className="px-4 py-3 text-center">Grade</th><th className="px-4 py-3 text-center">Pos.</th><th className="px-4 py-3">Remark</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {scoreRows.length ? scoreRows.map((score) => {
                            const subject = w.subjects.find((s) => s.id === score.subject_id);
                            const total = Number(score.total);
                            const remark = score.subject_remark || getPerformanceRemark(total);
                            return <tr key={score.id}><td className="px-4 py-3 font-semibold text-slate-800">{subject?.name || "Subject"}</td><td className="px-4 py-3 text-center">{Number(score.sba_scaled).toFixed(1)}</td><td className="px-4 py-3 text-center">{Number(score.exam_scaled).toFixed(1)}</td><td className="px-4 py-3 text-center font-black text-red-600">{total.toFixed(1)}</td><td className="px-4 py-3 text-center font-bold">{score.grade}</td><td className="px-4 py-3 text-center">{subjectPositions.get(score.subject_id) || "—"}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${scoreTone(total)}`}>{remark}</span></td></tr>;
                          }) : <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No scores have been entered for this term.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[["Total score", snapshot.scores.reduce((n, s) => n + Number(s.total), 0).toFixed(1)], ["Average", snapshot.scores.length ? `${average.toFixed(1)}%` : "—"], ["Class position", overallPosition ? `${overallPosition} of ${totalStudents}` : "—"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p></div>)}
                  </div>
                </div>
              )}

              {section === "development" && (
                <div className="space-y-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-emerald-700" /><h3 className="font-bold">Attendance</h3></div>{snapshot.attendance ? <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Days present</p><p className="mt-1 text-2xl font-black text-emerald-900">{snapshot.attendance.days_present}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Total school days</p><p className="mt-1 text-2xl font-black text-slate-900">{snapshot.attendance.total_days}</p></div><div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs text-blue-700">Attendance rate</p><p className="mt-1 text-2xl font-black text-blue-900">{snapshot.attendance.total_days ? ((snapshot.attendance.days_present / snapshot.attendance.total_days) * 100).toFixed(1) : "0.0"}%</p></div></div> : <p className="mt-4 text-sm text-slate-500">No attendance record has been entered for this term.</p>}</section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-emerald-700" /><h3 className="font-bold">Affective & learner development</h3></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{[["Conduct", snapshot.affective?.conduct], ["Interest", snapshot.affective?.interest], ["Attitude", snapshot.affective?.attitude], ["Talents", snapshot.affective?.talents]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-sm leading-6 text-slate-700">{value || "Not recorded"}</p></div>)}</div></section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-emerald-700" /><h3 className="font-bold">Manual remarks</h3></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Class teacher</p><p className="mt-2 text-sm leading-6 text-slate-700">{snapshot.remarks?.class_teacher_remark || "No remark yet."}</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Headteacher</p><p className="mt-2 text-sm leading-6 text-slate-700">{snapshot.remarks?.headteacher_remark || "No remark yet."}</p></div></div></section>
                </div>
              )}

              {section === "history" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Permanent report history</p><h3 className="mt-1 text-lg font-bold">Closed-term reports</h3>
                  {archives.length ? <div className="mt-5 space-y-3">{archives.map((archive) => <div key={archive.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{archive.academic_year} · {termLabel(archive.term)} · Version {archive.revision}</p><p className="mt-1 text-xs text-slate-500">Archived {new Date(archive.created_at).toLocaleDateString("en-GB")}</p></div><button className="btn-secondary" onClick={() => void run(async () => { const { data, error } = await browserClient().from("report_archives").select("snapshot").eq("id", archive.id).single(); if (error) throw new Error(error.message); await downloadReport(data.snapshot, archive.revision); }, "Archived report downloaded.")}><Download className="mr-2 inline h-4 w-4" /> Download</button></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No closed-term report has been archived for this learner yet.</p>}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {photoEditing && leader && (
        <Modal title={`Learner photo · ${fullName(currentStudent)}`} onClose={() => setPhotoEditing(false)}>
          <div className="space-y-5">
            <div className="mx-auto aspect-[4/5] max-w-52 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {(photoPreview || photoUrl) ? <img src={photoPreview || photoUrl || ""} alt="Learner photo preview" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-400"><UserRound className="h-16 w-16" /></div>}
            </div>
            <Field label="Choose learner photo">
              <input className="field" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
            </Field>
            <p className="text-xs leading-5 text-muted">PNG, JPG or WEBP, maximum 2 MB. A clear portrait works best on the learner profile and terminal report.</p>
            <button type="button" className="btn-primary w-full" disabled={!photoFile || busy} onClick={() => void savePhoto()}><ImagePlus className="mr-2 inline h-4 w-4" />{currentStudent.photo_url ? "Replace learner photo" : "Upload learner photo"}</button>
            {currentStudent.photo_url && <button type="button" className="btn-secondary w-full !text-red-700" disabled={busy} onClick={() => void deletePhoto()}><Trash2 className="mr-2 inline h-4 w-4" /> Remove learner photo</button>}
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit learner records · ${fullName(currentStudent)}`} onClose={() => setEditing(false)}>
          <form className="space-y-5" onSubmit={(e) => void saveNotes(e)}>
            {ownClass && <><div className="grid gap-4 sm:grid-cols-2"><Field label="Days present"><input className="field" type="number" min={0} max={366} value={notes.days_present} onChange={(e) => setNotes({ ...notes, days_present: Number(e.target.value) })} /></Field><Field label="Total school days"><input className="field" type="number" min={0} max={366} value={notes.total_days} onChange={(e) => setNotes({ ...notes, total_days: Number(e.target.value) })} /></Field></div><div className="grid gap-4 sm:grid-cols-2">{["conduct", "interest", "attitude", "talents"].map((key) => <Field key={key} label={key[0].toUpperCase() + key.slice(1)}><input className="field" maxLength={150} value={notes[key]} onChange={(e) => setNotes({ ...notes, [key]: e.target.value })} /></Field>)}</div><Field label="Class teacher’s remark"><textarea className="field" rows={4} maxLength={500} value={notes.class_teacher_remark} onChange={(e) => setNotes({ ...notes, class_teacher_remark: e.target.value })} /></Field></>}
            {leader && <Field label="Headteacher’s remark"><textarea className="field" rows={4} maxLength={500} value={notes.headteacher_remark} onChange={(e) => setNotes({ ...notes, headteacher_remark: e.target.value })} /></Field>}
            {termOpen && <button disabled={busy} className="btn-primary">Save records</button>}
          </form>
        </Modal>
      )}
    </Modal>
  );
}
