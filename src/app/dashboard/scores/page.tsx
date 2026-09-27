"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Empty } from "@/components/ui";
import { saveRows } from "@/lib/api";
import { fullName } from "@/lib/models";
import { computeTotal } from "@/lib/grading";
type Draft = { sba_raw: string; exam_raw: string; subject_remark: string };
export default function Scores() {
  const { data: w, run, busy } = useWorkspace(),
    [classId, setClassId] = useState(w.classes[0]?.id || ""),
    [subjectId, setSubjectId] = useState(""),
    [edits, setEdits] = useState<Record<string, Draft>>({});
  const cls = w.classes.find((c) => c.id === classId),
    canAll =
      w.profile.role === "ADMIN" || cls?.class_teacher_id === w.profile.id;
  const assignments = w.assignments.filter(
      (a) =>
        a.class_id === classId && (canAll || a.teacher_id === w.profile.id),
    ),
    subjects = w.subjects.filter(
      (s) => s.active && assignments.some((a) => a.subject_id === s.id),
    ),
    selected = subjects.some((s) => s.id === subjectId)
      ? subjectId
      : subjects[0]?.id || "";
  const open = w.terms.some(
      (t) =>
        t.academic_year === w.school.academic_year &&
        t.term === w.school.current_term &&
        t.status === "OPEN",
    ),
    students = w.students.filter(
      (s) => s.class_id === classId && s.status === "ACTIVE",
    );
  const scoreFor = (id: string) =>
    w.scores.find(
      (s) =>
        s.student_id === id &&
        s.subject_id === selected &&
        s.academic_year === w.school.academic_year &&
        s.term === w.school.current_term,
    );
  function draftFor(id: string) {
    const s = scoreFor(id);
    return (
      edits[id] || {
        sba_raw: s ? String(s.sba_raw) : "",
        exam_raw: s ? String(s.exam_raw) : "",
        subject_remark: s?.subject_remark || "",
      }
    );
  }
  function change(id: string, key: keyof Draft, value: string) {
    setEdits({ ...edits, [id]: { ...draftFor(id), [key]: value } });
  }
  function discard() {
    return (
      !Object.keys(edits).length ||
      confirm("Discard unsaved marks before switching?")
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Assessment"
        title="SBA & examination scores"
        description={`Term ${w.school.current_term} · ${w.school.academic_year}. Enter raw scores out of 100. The school weighting is ${w.school.sba_weight}% SBA and ${w.school.exam_weight}% examination.`}
      />
      <div className="surface grid gap-4 rounded-2xl p-5 sm:grid-cols-2">
        <Field label="Class">
          <select
            className="field"
            value={classId}
            onChange={(e) => {
              if (discard()) {
                setClassId(e.target.value);
                setSubjectId("");
                setEdits({});
              }
            }}
          >
            <option value="">Choose class</option>
            {w.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject">
          <select
            className="field"
            value={selected}
            onChange={(e) => {
              if (discard()) {
                setSubjectId(e.target.value);
                setEdits({});
              }
            }}
          >
            <option value="">Choose subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!open && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This term is closed. Marks are read-only. School leadership can start
          the next term.
        </p>
      )}
      {!selected ? (
        <Empty>
          No subject is assigned for you in this class. Ask your administrator
          to configure teaching assignments.
        </Empty>
      ) : !students.length ? (
        <Empty>No active learners in this class.</Empty>
      ) : (
        <form
          method="post"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(async () => {
              const rows = Object.entries(edits).map(([id, d]) => {
                if (d.sba_raw === "" || d.exam_raw === "")
                  throw new Error(
                    `Enter both scores for ${fullName(students.find((s) => s.id === id)!)}.`,
                  );
                const a = Number(d.sba_raw),
                  b = Number(d.exam_raw);
                if (
                  !Number.isFinite(a) ||
                  !Number.isFinite(b) ||
                  a < 0 ||
                  a > 100 ||
                  b < 0 ||
                  b > 100
                )
                  throw new Error("Scores must be between 0 and 100.");
                const existing = scoreFor(id);
                return {
                  ...(existing ? { id: existing.id } : {}),
                  school_id: w.school.id,
                  student_id: id,
                  class_id: classId,
                  subject_id: selected,
                  academic_year: w.school.academic_year,
                  term: w.school.current_term,
                  sba_raw: a,
                  exam_raw: b,
                  subject_remark: d.subject_remark,
                };
              });
              await saveRows(
                "scores",
                rows,
                "student_id,subject_id,term,academic_year",
              );
            }, "Marks saved and available to authorised staff.");
            if (ok) setEdits({});
          }}
        >
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>SBA / 100</th>
                  <th>Exam / 100</th>
                  <th>Weighted total</th>
                  <th>Grade</th>
                  <th>Subject remark</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const d = draftFor(s.id),
                    computed =
                      d.sba_raw !== "" && d.exam_raw !== ""
                        ? computeTotal(
                            Number(d.sba_raw),
                            100,
                            Number(d.exam_raw),
                            100,
                            Number(w.school.sba_weight),
                            Number(w.school.exam_weight),
                          )
                        : null;
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="font-medium whitespace-nowrap">
                          {fullName(s)}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {s.admission_number}
                        </div>
                      </td>
                      <td>
                        <input
                          aria-label={`SBA for ${fullName(s)}`}
                          disabled={!open}
                          className="field min-w-24"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={d.sba_raw}
                          onChange={(e) =>
                            change(s.id, "sba_raw", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Exam for ${fullName(s)}`}
                          disabled={!open}
                          className="field min-w-24"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={d.exam_raw}
                          onChange={(e) =>
                            change(s.id, "exam_raw", e.target.value)
                          }
                        />
                      </td>
                      <td className="font-semibold tabular-nums">
                        {computed?.total.toFixed(2) || "—"}
                      </td>
                      <td>{computed?.grade || "—"}</td>
                      <td>
                        <input
                          aria-label={`Remark for ${fullName(s)}`}
                          disabled={!open}
                          maxLength={250}
                          className="field min-w-40"
                          value={d.subject_remark}
                          onChange={(e) =>
                            change(s.id, "subject_remark", e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-sm text-muted">
              {Object.keys(edits).length} learners with unsaved changes
            </span>
            <button
              className="btn-primary"
              disabled={busy || !open || !Object.keys(edits).length}
            >
              Save marks
            </button>
          </div>
        </form>
      )}
    </>
  );
}
