"use client";

import { useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CalendarDays,
  Download,
  FileText,
  GraduationCap,
  MessageSquareText,
  PencilLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import StudentProfile from "@/components/StudentProfile";
import { useWorkspace } from "@/components/workspace";
import { Empty, Field, Modal, PageHeader, Restricted } from "@/components/ui";
import { browserClient } from "@/lib/supabase/client";
import {
  fullName,
  isLeader,
  type ReportSnapshot,
  type Student,
} from "@/lib/models";
import { currentSnapshot, downloadReport, reportData } from "@/lib/reporting";

type ReportStatus = {
  key: "ready" | "attention" | "empty";
  label: string;
  missing: string[];
};

type PreviewState = {
  snapshot: ReportSnapshot;
  revision?: number;
};

const termLabel = (term: number) =>
  term === 1 ? "First Term" : term === 2 ? "Second Term" : "Third Term";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB") : "—";

function reportStatus(snapshot: ReportSnapshot, expectedSubjects: number): ReportStatus {
  const scoredSubjects = new Set(snapshot.scores.map((score) => score.subject_id)).size;
  const missing: string[] = [];

  if (!expectedSubjects) missing.push("class subjects");
  else if (scoredSubjects < expectedSubjects)
    missing.push(`${expectedSubjects - scoredSubjects} subject score${expectedSubjects - scoredSubjects === 1 ? "" : "s"}`);

  if (!snapshot.attendance || snapshot.attendance.total_days <= 0)
    missing.push("attendance");
  if (!snapshot.affective) missing.push("development record");
  if (!snapshot.remarks?.class_teacher_remark?.trim())
    missing.push("class teacher remark");
  if (!snapshot.remarks?.headteacher_remark?.trim())
    missing.push("headteacher remark");

  if (!snapshot.scores.length)
    return { key: "empty", label: "No scores", missing };
  if (!missing.length) return { key: "ready", label: "Ready", missing };
  return { key: "attention", label: "Needs attention", missing };
}

function statusClass(key: ReportStatus["key"]) {
  if (key === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (key === "empty") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function initials(student: Student) {
  return `${student.first_name?.[0] || ""}${student.last_name?.[0] || ""}`.toUpperCase();
}

export default function Reports() {
  const { data: w, run, busy } = useWorkspace();
  const [classId, setClassId] = useState("");
  const [archive, setArchive] = useState(false);
  const [archiveTerm, setArchiveTerm] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ReportStatus["key"]>("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [notes, setNotes] = useState<Record<string, string | number>>({});

  const leader = isLeader(w.profile.role);
  const classes = w.classes.filter(
    (c) => leader || c.class_teacher_id === w.profile.id,
  );
  const selected = classes.some((c) => c.id === classId)
    ? classId
    : classes[0]?.id || "";
  const selectedClass = classes.find((c) => c.id === selected);

  const open = w.terms.some(
    (t) =>
      t.academic_year === w.school.academic_year &&
      t.term === w.school.current_term &&
      t.status === "OPEN",
  );

  const expectedSubjectIds = useMemo(() => {
    if (!selectedClass) return [];
    const assigned = w.assignments
      .filter((a) => a.class_id === selectedClass.id)
      .map((a) => a.subject_id)
      .filter((id) => w.subjects.some((s) => s.id === id && s.active));
    if (assigned.length) return [...new Set(assigned)];
    return w.subjects
      .filter(
        (subject) =>
          subject.active &&
          (subject.level === "ALL" || subject.level === selectedClass.level),
      )
      .map((subject) => subject.id);
  }, [selectedClass, w.assignments, w.subjects]);

  const currentRows = useMemo(() => {
    const students = w.students.filter(
      (student) => student.class_id === selected && student.status === "ACTIVE",
    );

    return students.map((student) => {
      const snapshot = currentSnapshot(w, student);
      const report = reportData(snapshot).data;
      const status = reportStatus(snapshot, expectedSubjectIds.length);
      const lastArchive = w.archives
        .filter(
          (item) =>
            item.student_id === student.id &&
            item.academic_year === w.school.academic_year &&
            item.term === w.school.current_term,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

      return { student, snapshot, report, status, lastArchive };
    });
  }, [expectedSubjectIds.length, selected, w]);

  const visibleRows = currentRows.filter((row) => {
    const search = query.trim().toLowerCase();
    const matchesQuery =
      !search ||
      `${fullName(row.student)} ${row.student.admission_number}`
        .toLowerCase()
        .includes(search);
    const matchesStatus = !statusFilter || row.status.key === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const classAverageRows = currentRows.filter((row) => row.snapshot.scores.length);
  const classAverage = classAverageRows.length
    ? classAverageRows.reduce((sum, row) => sum + row.report.overallAverage, 0) /
      classAverageRows.length
    : null;
  const attendanceRows = currentRows.filter(
    (row) => row.snapshot.attendance && row.snapshot.attendance.total_days > 0,
  );
  const attendanceAverage = attendanceRows.length
    ? attendanceRows.reduce((sum, row) => {
        const attendance = row.snapshot.attendance!;
        return sum + (attendance.days_present / attendance.total_days) * 100;
      }, 0) / attendanceRows.length
    : null;
  const readyCount = currentRows.filter((row) => row.status.key === "ready").length;
  const incompleteCount = currentRows.length - readyCount;

  const archiveTermOptions = useMemo(() => {
    const keys = new Map<string, string>();
    for (const item of w.archives) {
      const key = `${item.academic_year}:${item.term}`;
      keys.set(key, `${item.academic_year} · ${termLabel(item.term)}`);
    }
    return [...keys.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [w.archives]);

  if (!leader && !classes.length) return <Restricted />;

  const archives = w.archives
    .filter(
      (item) =>
        (!selected || item.class_id === selected) &&
        (!archiveTerm || `${item.academic_year}:${item.term}` === archiveTerm) &&
        (!query.trim() ||
          `${fullName(item.snapshot.student)} ${item.snapshot.student.admission_number}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())),
    )
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.revision - a.revision,
    );

  const previewBundle = preview ? reportData(preview.snapshot) : null;
  const previewSubjectMap = previewBundle
    ? new Map(previewBundle.subjects.map((subject) => [subject.id, subject.name]))
    : new Map<string, string>();

  function edit(student: Student) {
    const snapshot = currentSnapshot(w, student);
    setEditingStudent(student);
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
  }

  async function loadArchiveSnapshot(id: string): Promise<ReportSnapshot> {
    const { data, error } = await browserClient()
      .from("report_archives")
      .select("snapshot")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data.snapshot as ReportSnapshot;
  }

  async function previewArchive(id: string, revision: number) {
    await run(async () => {
      const snapshot = await loadArchiveSnapshot(id);
      setPreview({ snapshot, revision });
    }, "Archived report loaded.");
  }

  async function downloadArchive(id: string, revision: number) {
    await run(async () => {
      const snapshot = await loadArchiveSnapshot(id);
      await downloadReport(snapshot, revision);
    }, "Archived PDF downloaded.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Report management"
        description="Review report readiness, complete learner records, preview professional terminal reports and manage permanent term archives from one workspace."
      >
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Active reporting term
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {termLabel(w.school.current_term)} · {w.school.academic_year}
          </p>
          <p className={`mt-1 text-xs font-semibold ${open ? "text-emerald-700" : "text-slate-500"}`}>
            {open ? "Open for updates" : "Closed"}
          </p>
        </div>
      </PageHeader>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5">
            <button
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                archive
                  ? "text-slate-600 hover:bg-white/70"
                  : "bg-white text-slate-950 shadow-sm"
              }`}
              onClick={() => {
                setArchive(false);
                setStatusFilter("");
              }}
            >
              Current reports
            </button>
            <button
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                archive
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:bg-white/70"
              }`}
              onClick={() => {
                setArchive(true);
                setStatusFilter("");
              }}
            >
              Report archive
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:min-w-[760px]">
            <Field label="Class">
              <select
                className="field"
                value={selected}
                onChange={(e) => setClassId(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            {archive ? (
              <Field label="Archived term">
                <select
                  className="field"
                  value={archiveTerm}
                  onChange={(e) => setArchiveTerm(e.target.value)}
                >
                  <option value="">All archived terms</option>
                  {archiveTermOptions.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Report status">
                <select
                  className="field"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "" | ReportStatus["key"])
                  }
                >
                  <option value="">All statuses</option>
                  <option value="ready">Ready</option>
                  <option value="attention">Needs attention</option>
                  <option value="empty">No scores</option>
                </select>
              </Field>
            )}

            <Field label="Search learners">
              <input
                aria-label="Search learner name or admission number"
                className="field"
                placeholder="Name or admission no."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Class subjects
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {expectedSubjectIds.length || "Not configured"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {!archive && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Total learners", String(currentRows.length), UserRound],
            ["Reports ready", String(readyCount), ShieldCheck],
            ["Need attention", String(incompleteCount), MessageSquareText],
            ["Class average", classAverage === null ? "—" : `${classAverage.toFixed(1)}%`, Award],
            [
              "Average attendance",
              attendanceAverage === null ? "—" : `${attendanceAverage.toFixed(1)}%`,
              CalendarDays,
            ],
          ].map(([label, value, Icon]) => {
            const MetricIcon = Icon as typeof UserRound;
            return (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    {String(label)}
                  </p>
                  <MetricIcon className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-950">{String(value)}</p>
              </div>
            );
          })}
        </section>
      )}

      {archive ? (
        archives.length ? (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th>Academic year</th>
                      <th>Term</th>
                      <th>Archive version</th>
                      <th>Generated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archives.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {fullName(item.snapshot.student)}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {item.snapshot.student.admission_number}
                            </p>
                          </div>
                        </td>
                        <td>{item.academic_year}</td>
                        <td>{termLabel(item.term)}</td>
                        <td>
                          <p className="font-semibold">Version {item.revision}</p>
                          <p className="mt-1 text-xs text-muted">
                            {w.terms.some(
                              (t) =>
                                t.academic_year === item.academic_year &&
                                t.term === item.term &&
                                t.status === "OPEN",
                            )
                              ? "Term reopened · preserved copy"
                              : w.terms.some(
                                    (t) =>
                                      t.academic_year === item.academic_year &&
                                      t.term === item.term &&
                                      t.archive_revision === item.revision,
                                  )
                                ? "Latest closure"
                                : "Earlier copy"}
                          </p>
                        </td>
                        <td>{formatDate(item.created_at)}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="btn-secondary !px-3 !py-2 text-xs"
                              disabled={busy}
                              onClick={() => void previewArchive(item.id, item.revision)}
                            >
                              <FileText className="mr-1.5 inline h-3.5 w-3.5" /> Preview
                            </button>
                            <button
                              className="btn-primary !px-3 !py-2 text-xs"
                              disabled={busy}
                              onClick={() => void downloadArchive(item.id, item.revision)}
                            >
                              <Download className="mr-1.5 inline h-3.5 w-3.5" /> PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 md:hidden">
              {archives.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">{fullName(item.snapshot.student)}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.snapshot.student.admission_number}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      v{item.revision}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Term</p>
                      <p className="mt-1 font-semibold">{termLabel(item.term)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Academic year</p>
                      <p className="mt-1 font-semibold">{item.academic_year}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400">Generated</p>
                      <p className="mt-1 font-semibold">{formatDate(item.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="btn-secondary !px-3 !py-2 text-xs"
                      disabled={busy}
                      onClick={() => void previewArchive(item.id, item.revision)}
                    >
                      <FileText className="mr-1.5 inline h-3.5 w-3.5" /> Preview
                    </button>
                    <button
                      className="btn-primary !px-3 !py-2 text-xs"
                      disabled={busy}
                      onClick={() => void downloadArchive(item.id, item.revision)}
                    >
                      <Download className="mr-1.5 inline h-3.5 w-3.5" /> PDF
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <Empty>
            No archived reports match this view. Closing a term creates permanent report snapshots that remain available here.
          </Empty>
        )
      ) : currentRows.length ? (
        visibleRows.length ? (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th>Average</th>
                      <th>Grade</th>
                      <th>Position</th>
                      <th>Report status</th>
                      <th>Last generated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map(({ student, snapshot, report, status, lastArchive }) => (
                      <tr key={student.id}>
                        <td>
                          <button
                            className="flex items-center gap-3 text-left"
                            onClick={() => setProfileStudent(student)}
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-xs font-bold text-slate-500">
                              {student.photo_url ? (
                                <img src={student.photo_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                initials(student)
                              )}
                            </span>
                            <span>
                              <span className="block font-semibold text-slate-900 hover:text-[var(--g-green)]">
                                {fullName(student)}
                              </span>
                              <span className="mt-1 block text-xs text-muted">
                                {student.admission_number}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td>{snapshot.scores.length ? `${report.overallAverage.toFixed(1)}%` : "—"}</td>
                        <td className="font-semibold">{report.overallGrade}</td>
                        <td>
                          {report.overallPosition
                            ? `${report.overallPosition} / ${report.totalStudents}`
                            : "—"}
                        </td>
                        <td>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status.key)}`}>
                            {status.label}
                          </span>
                          {!!status.missing.length && (
                            <p className="mt-1 max-w-[220px] text-xs leading-5 text-muted">
                              Missing: {status.missing.join(", ")}
                            </p>
                          )}
                        </td>
                        <td>{formatDate(lastArchive?.created_at)}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="btn-secondary !px-3 !py-2 text-xs"
                              onClick={() => setProfileStudent(student)}
                            >
                              <UserRound className="mr-1.5 inline h-3.5 w-3.5" /> Profile
                            </button>
                            <button
                              className="btn-secondary !px-3 !py-2 text-xs"
                              onClick={() => setPreview({ snapshot })}
                            >
                              <FileText className="mr-1.5 inline h-3.5 w-3.5" /> Preview
                            </button>
                            <button
                              className="btn-secondary !px-3 !py-2 text-xs"
                              onClick={() => edit(student)}
                            >
                              <PencilLine className="mr-1.5 inline h-3.5 w-3.5" /> Records
                            </button>
                            <button
                              className="btn-primary !px-3 !py-2 text-xs"
                              disabled={!snapshot.scores.length || busy}
                              onClick={() =>
                                void run(
                                  () => downloadReport(snapshot),
                                  "PDF downloaded.",
                                )
                              }
                            >
                              <Download className="mr-1.5 inline h-3.5 w-3.5" /> PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 md:hidden">
              {visibleRows.map(({ student, snapshot, report, status, lastArchive }) => (
                <article key={student.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(student)
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button
                            className="truncate text-left font-bold text-slate-900"
                            onClick={() => setProfileStudent(student)}
                          >
                            {fullName(student)}
                          </button>
                          <p className="mt-1 text-xs text-slate-500">{student.admission_number}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(status.key)}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Average</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {snapshot.scores.length ? `${report.overallAverage.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Grade</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{report.overallGrade}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Position</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {report.overallPosition ? `${report.overallPosition}/${report.totalStudents}` : "—"}
                      </p>
                    </div>
                  </div>

                  {!!status.missing.length && (
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Missing: {status.missing.join(", ")}
                    </p>
                  )}
                  {lastArchive && (
                    <p className="mt-2 text-xs text-slate-400">
                      Last generated {formatDate(lastArchive.created_at)}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => setProfileStudent(student)}>
                      <UserRound className="mr-1.5 inline h-3.5 w-3.5" /> Profile
                    </button>
                    <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => setPreview({ snapshot })}>
                      <FileText className="mr-1.5 inline h-3.5 w-3.5" /> Preview
                    </button>
                    <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => edit(student)}>
                      <PencilLine className="mr-1.5 inline h-3.5 w-3.5" /> Records
                    </button>
                    <button
                      className="btn-primary !px-3 !py-2 text-xs"
                      disabled={!snapshot.scores.length || busy}
                      onClick={() => void run(() => downloadReport(snapshot), "PDF downloaded.")}
                    >
                      <Download className="mr-1.5 inline h-3.5 w-3.5" /> PDF
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <p className="text-xs leading-6 text-muted">
              “Ready” means the configured class subjects have scores and the attendance, development, class-teacher and headteacher report sections are recorded. Current-term PDFs always use the latest saved entries.
            </p>
          </>
        ) : (
          <Empty>No learners match the current search or report-status filter.</Empty>
        )
      ) : (
        <Empty>No active learners are currently assigned to this class.</Empty>
      )}

      {editingStudent && (
        <Modal
          title={`Attendance & remarks — ${fullName(editingStudent)}`}
          onClose={() => setEditingStudent(null)}
        >
          <form
            method="post"
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const editingClass = w.classes.find((c) => c.id === editingStudent.class_id);
              const ownClass =
                w.profile.role === "ADMIN" ||
                editingClass?.class_teacher_id === w.profile.id;
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
                  learner_id: editingStudent.id,
                  notes: payload,
                });
                if (error) throw new Error(error.message);
              }, "Attendance and remarks saved.");
              if (ok) setEditingStudent(null);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {["days_present", "total_days"].map((key) => (
                <Field
                  key={key}
                  label={key === "days_present" ? "Days present" : "Total school days"}
                >
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={366}
                    step={1}
                    required
                    disabled={
                      !open ||
                      !(
                        w.profile.role === "ADMIN" ||
                        w.classes.find((c) => c.id === editingStudent.class_id)?.class_teacher_id === w.profile.id
                      )
                    }
                    value={notes[key]}
                    onChange={(e) =>
                      setNotes({ ...notes, [key]: Number(e.target.value) })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {["conduct", "interest", "attitude", "talents"].map((key) => (
                <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
                  <input
                    className="field"
                    disabled={
                      !open ||
                      !(
                        w.profile.role === "ADMIN" ||
                        w.classes.find((c) => c.id === editingStudent.class_id)?.class_teacher_id === w.profile.id
                      )
                    }
                    maxLength={150}
                    value={notes[key]}
                    onChange={(e) => setNotes({ ...notes, [key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            <Field label="Class teacher’s remark">
              <textarea
                className="field"
                rows={3}
                disabled={
                  !open ||
                  !(
                    w.profile.role === "ADMIN" ||
                    w.classes.find((c) => c.id === editingStudent.class_id)?.class_teacher_id === w.profile.id
                  )
                }
                maxLength={500}
                value={notes.class_teacher_remark}
                onChange={(e) =>
                  setNotes({ ...notes, class_teacher_remark: e.target.value })
                }
              />
            </Field>
            <Field label="Headmaster’s remark">
              <textarea
                className="field"
                rows={3}
                disabled={!leader || !open}
                maxLength={500}
                value={notes.headteacher_remark}
                onChange={(e) =>
                  setNotes({ ...notes, headteacher_remark: e.target.value })
                }
              />
            </Field>
            {open && (
              <button disabled={busy} className="btn-primary">
                Save attendance & remarks
              </button>
            )}
          </form>
        </Modal>
      )}

      {profileStudent && (
        <StudentProfile
          student={profileStudent}
          onClose={() => setProfileStudent(null)}
        />
      )}

      {preview && previewBundle && (
        <Modal
          title={`Report preview · ${fullName(preview.snapshot.student)}`}
          onClose={() => setPreview(null)}
          size="wide"
        >
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <header className="bg-[linear-gradient(135deg,#102033_0%,#173d3a_55%,#0f5a45_100%)] px-5 py-6 text-white sm:px-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">
                    Terminal report preview
                  </p>
                  <h3 className="mt-2 text-xl font-bold sm:text-2xl">{preview.snapshot.school.name}</h3>
                  <p className="mt-1 text-sm text-white/70">
                    {termLabel(preview.snapshot.school.current_term)} · {preview.snapshot.school.academic_year}
                    {preview.revision ? ` · Archive v${preview.revision}` : ""}
                  </p>
                </div>
                <button
                  className="btn-primary !bg-white !text-slate-900"
                  disabled={busy || !preview.snapshot.scores.length}
                  onClick={() =>
                    void run(
                      () => downloadReport(preview.snapshot, preview.revision),
                      "PDF downloaded.",
                    )
                  }
                >
                  <Download className="mr-2 inline h-4 w-4" /> Download PDF
                </button>
              </div>
            </header>

            <div className="space-y-6 p-5 sm:p-7">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-bold text-slate-500">
                      {preview.snapshot.student.photo_url ? (
                        <img
                          src={preview.snapshot.student.photo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials(preview.snapshot.student)
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Learner</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {fullName(preview.snapshot.student)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {preview.snapshot.student.admission_number} · {preview.snapshot.class.name}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-3 gap-3">
                  {[
                    ["Average", `${previewBundle.data.overallAverage.toFixed(1)}%`, Award],
                    ["Grade", previewBundle.data.overallGrade, BookOpen],
                    [
                      "Position",
                      previewBundle.data.overallPosition
                        ? `${previewBundle.data.overallPosition}/${previewBundle.data.totalStudents}`
                        : "—",
                      GraduationCap,
                    ],
                  ].map(([label, value, Icon]) => {
                    const SummaryIcon = Icon as typeof Award;
                    return (
                      <div key={String(label)} className="rounded-2xl bg-slate-50 p-4">
                        <SummaryIcon className="h-4 w-4 text-slate-400" />
                        <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {String(label)}
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{String(value)}</p>
                      </div>
                    );
                  })}
                </section>
              </div>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-700" />
                  <h4 className="font-bold text-slate-900">Academic results</h4>
                </div>
                {previewBundle.data.scores.length ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>SBA</th>
                          <th>Exam</th>
                          <th>Total</th>
                          <th>Grade</th>
                          <th>Position</th>
                          <th>Remark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewBundle.data.scores.map((score) => (
                          <tr key={score.id}>
                            <td className="font-semibold">
                              {previewSubjectMap.get(score.subjectId) || score.subjectId}
                            </td>
                            <td>{Number(score.sbaScaled).toFixed(1)}</td>
                            <td>{Number(score.examScaled).toFixed(1)}</td>
                            <td className="font-semibold">{Number(score.total).toFixed(1)}</td>
                            <td>{score.grade}</td>
                            <td>{score.position || "—"}</td>
                            <td>{score.subjectRemark || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    No scores have been recorded for this report.
                  </div>
                )}
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-emerald-700" />
                    <h4 className="font-bold">Attendance & development</h4>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">Attendance</p>
                      <p className="mt-1 font-bold text-slate-900">
                        {previewBundle.data.attendance
                          ? `${previewBundle.data.attendance.daysPresent}/${previewBundle.data.attendance.totalDays} days`
                          : "Not recorded"}
                      </p>
                    </div>
                    {[
                      ["Conduct", previewBundle.data.affective?.conduct],
                      ["Interest", previewBundle.data.affective?.interest],
                      ["Attitude", previewBundle.data.affective?.attitude],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">{String(label)}</p>
                        <p className="mt-1 font-semibold text-slate-800">{String(value || "—")}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-5 w-5 text-emerald-700" />
                    <h4 className="font-bold">Professional remarks</h4>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Class teacher</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {previewBundle.data.remarks?.classTeacherRemark || "No remark recorded."}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Headteacher</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {previewBundle.data.remarks?.headteacherRemark || "No remark recorded."}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
