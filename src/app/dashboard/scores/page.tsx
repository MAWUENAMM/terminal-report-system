"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Empty } from "@/components/ui";
import { saveRows } from "@/lib/api";
import { fullName } from "@/lib/models";
import { EARLY_YEARS_REMARKS, earlyYearsRemark, isEarlyYearsClass } from "@/lib/early-years";
import { computeTotal } from "@/lib/grading";
import { isGradeNineClass, mockBandFor } from "@/lib/grade9-mock";
import { filterAssessmentStudents, isCompleteMark, markEntryError } from "@/lib/assessment-filters";
import type { GenderFilter, NameSort } from "@/lib/class-sheets";
type Draft = { sba_raw: string; exam_raw: string; subject_remark: string };
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export default function Scores() {
  const { data: w, run, busy } = useWorkspace(),
    [classId, setClassId] = useState(w.classes[0]?.id || ""),
    [subjectId, setSubjectId] = useState(""),
    [edits, setEdits] = useState<Record<string, Draft>>({}),
    [query, setQuery] = useState(""),
    [gender, setGender] = useState<GenderFilter>(""),
    [order, setOrder] = useState<NameSort>("az"),
    [initial, setInitial] = useState(""),
    [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const sbaMax = Number(w.school.sba_input_max) || 100;
  const cls = w.classes.find((c) => c.id === classId),
    earlyYears = isEarlyYearsClass(cls?.name || ""),
    gradeNine = isGradeNineClass(cls?.name || ""),
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
    ),
    visibleStudents = filterAssessmentStudents(students, { query, gender, order, initial }),
    invalidCount = Object.keys(validationErrors).length;
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
        subject_remark: earlyYears ? (earlyYearsRemark(s?.descriptive_assessment) ?? "") : (s?.subject_remark || ""),
      }
    );
  }
  function change(id: string, key: keyof Draft, value: string) {
    if (key === "sba_raw" || key === "exam_raw") {
      const label = key === "sba_raw" ? "SBA" : "Exam";
      const error = markEntryError(value, key === "sba_raw" ? sbaMax : 100, label);
      const errorKey = `${id}:${key}`;
      setValidationErrors((previous) => {
        const next = { ...previous };
        if (error) next[errorKey] = error;
        else delete next[errorKey];
        return next;
      });
      // Leave the previous mark untouched. Never silently convert 61 to 60 or 101 to 100.
      if (error) return;
    }
    setEdits((previous) => ({ ...previous, [id]: { ...draftFor(id), [key]: value } }));
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
        title={earlyYears ? "Child assessment record" : gradeNine ? "Grade 9 examination scores" : "SBA & examination scores"}
        description={earlyYears ? "Select a descriptive remark for each learner. No SBA, examination scores or marks are required." : gradeNine
          ? `Term ${w.school.current_term} · ${w.school.academic_year}. Grade 9 (JHS 3) uses examination marks out of 100 only (100% exam, no SBA).`
          : `Term ${w.school.current_term} · ${w.school.academic_year}. Enter SBA marks out of ${sbaMax} and examination marks out of 100. Both scale automatically to ${w.school.sba_weight}% SBA and ${w.school.exam_weight}% examination.`}
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
                setValidationErrors({});
                setQuery("");
                setGender("");
                setInitial("");
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
                setValidationErrors({});
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
      {selected && students.length > 0 && (
        <section className="surface mt-4 rounded-2xl p-4 sm:p-5" aria-label="Assessment learner filters">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Search learner name or admission number">
              <input
                className="field"
                type="search"
                placeholder="Type a student name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search learners by name or admission number"
              />
            </Field>
            <Field label="Sort names">
              <select className="field" value={order}
                onChange={(e) => setOrder(e.target.value as NameSort)}
                aria-label="Sort assessment learners by name">
                <option value="az">Names: A–Z</option>
                <option value="za">Names: Z–A</option>
              </select>
            </Field>
            <Field label="Gender">
              <select className="field" value={gender}
                onChange={(e) => setGender(e.target.value as GenderFilter)}
                aria-label="Filter assessment learners by gender">
                <option value="">Male and female</option>
                <option value="M">Male only</option>
                <option value="F">Female only</option>
              </select>
            </Field>
            <Field label="Name starts with">
              <select className="field" value={initial}
                onChange={(e) => setInitial(e.target.value)}
                aria-label="Filter assessment learners by first letter">
                <option value="">All letters (A–Z)</option>
                {ALPHABET.map((letter) => (
                  <option key={letter} value={letter}>{letter}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted" aria-live="polite">
              Showing {visibleStudents.length} of {students.length} active learners.
              Filters only change the displayed rows; existing marks stay unchanged.
            </p>
            {(query || gender || initial || order !== "az") && (
              <button type="button" className="btn-secondary"
                onClick={() => { setQuery(""); setGender(""); setOrder("az"); setInitial(""); }}>
                Clear filters
              </button>
            )}
          </div>
        </section>
      )}
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
              if (invalidCount) {
                throw new Error("A mark above the permitted maximum was rejected. Correct the highlighted entry before saving.");
              }
              const rows = Object.entries(edits).map(([id, d]) => {
                if (earlyYears) {
                  const remark = earlyYearsRemark(d.subject_remark);
                  if (!remark) throw new Error("Select an assessment remark for every edited learner.");
                  const existing = scoreFor(id);
                  return {
                    ...(existing ? { id: existing.id } : {}),
                    school_id: w.school.id, student_id: id, class_id: classId,
                    subject_id: selected, academic_year: w.school.academic_year, term: w.school.current_term,
                    sba_raw: 0, exam_raw: 0, descriptive_assessment: remark,
                  };
                }
                if ((!gradeNine && !isCompleteMark(d.sba_raw, sbaMax, "SBA")) ||
                    !isCompleteMark(d.exam_raw, 100, "Exam")) {
                  const learner = students.find((s) => s.id === id);
                  throw new Error(gradeNine
                    ? `Enter a valid examination mark (0–100) for ${learner ? fullName(learner) : "this learner"}.`
                    : `Enter valid SBA (0–${sbaMax}) and Exam (0–100) marks for ${learner ? fullName(learner) : "this learner"}.`);
                }
                const a = gradeNine ? 0 : Number(d.sba_raw),
                  b = Number(d.exam_raw);
                if (
                  !Number.isFinite(a) ||
                  !Number.isFinite(b) ||
                  a < 0 ||
                  a > sbaMax ||
                  b < 0 ||
                  b > 100
                )
                  throw new Error(`SBA must be 0–${sbaMax}; examination must be 0–100.`);
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
            }, earlyYears ? "Assessments saved." : "Marks saved and available to authorised staff.");
            if (ok) { setEdits({}); setValidationErrors({}); }
          }}
        >
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  {!earlyYears && !gradeNine && <th>SBA / {sbaMax} → {w.school.sba_weight}%</th>}
                  {!earlyYears && <><th>{gradeNine ? "Examination / 100 (100%)" : `Exam / 100 → ${w.school.exam_weight}%`}</th><th>Weighted total</th><th>Grade</th></>}
                  <th>{earlyYears ? "Assessment remark" : "Subject remark"}</th>
                </tr>
              </thead>
              <tbody>
                {!visibleStudents.length && (
                  <tr><td colSpan={earlyYears ? 2 : gradeNine ? 5 : 6} className="py-8 text-center text-muted">
                    No learners match these filters. Change the search, gender, or starting letter.
                  </td></tr>
                )}
                {visibleStudents.map((s) => {
                  const d = draftFor(s.id),
                    computed = isCompleteMark(d.exam_raw, 100, "Exam") &&
                      (gradeNine || isCompleteMark(d.sba_raw, sbaMax, "SBA"))
                        ? gradeNine
                          ? {
                              sbaScaled: 0,
                              examScaled: Number(d.exam_raw),
                              total: Number(d.exam_raw),
                              grade: mockBandFor(Number(d.exam_raw))?.grade ?? "-",
                            }
                          : computeTotal(
                              Number(d.sba_raw),
                              sbaMax,
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
                      {earlyYears ? <td><select aria-label={`Assessment for ${fullName(s)}`} className="field min-w-40" disabled={!open} value={d.subject_remark} onChange={e => change(s.id, "subject_remark", e.target.value)}>
                        <option value="">Select remark</option>
                        {EARLY_YEARS_REMARKS.map(remark => <option key={remark} value={remark}>{remark}</option>)}
                      </select></td> : <>
                      {!gradeNine && <td>
                        <input
                          aria-label={`SBA for ${fullName(s)}`}
                          disabled={!open}
                          className="field min-w-24"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={sbaMax}
                          step="0.01"
                          aria-invalid={Boolean(validationErrors[`${s.id}:sba_raw`])}
                          aria-describedby={`sba-error-${s.id}`}
                          value={d.sba_raw}
                          onChange={(e) =>
                            change(s.id, "sba_raw", e.target.value)
                          }
                        />
                        {validationErrors[`${s.id}:sba_raw`] && (
                          <p id={`sba-error-${s.id}`} className="mt-1 max-w-48 text-xs font-semibold text-red-700" role="alert">
                            {validationErrors[`${s.id}:sba_raw`]}
                          </p>
                        )}
                        <span className="mt-1 block text-xs text-muted">
                          {computed ? `${computed.sbaScaled.toFixed(2)} / ${w.school.sba_weight} scaled` : `Max ${sbaMax}`}
                        </span>
                      </td>}
                      <td>
                        <input
                          aria-label={`Exam for ${fullName(s)}`}
                          disabled={!open}
                          className="field min-w-24"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="0.01"
                          aria-invalid={Boolean(validationErrors[`${s.id}:exam_raw`])}
                          aria-describedby={`exam-error-${s.id}`}
                          value={d.exam_raw}
                          onChange={(e) =>
                            change(s.id, "exam_raw", e.target.value)
                          }
                        />
                        {validationErrors[`${s.id}:exam_raw`] && (
                          <p id={`exam-error-${s.id}`} className="mt-1 max-w-48 text-xs font-semibold text-red-700" role="alert">
                            {validationErrors[`${s.id}:exam_raw`]}
                          </p>
                        )}
                        <span className="mt-1 block text-xs text-muted">
                          {computed
                            ? (gradeNine
                              ? `${computed.examScaled.toFixed(2)} / 100 (100% exam)`
                              : `${computed.examScaled.toFixed(2)} / ${w.school.exam_weight} scaled`)
                            : "Max 100"}
                        </span>
                      </td>
                      <td className="font-semibold tabular-nums">
                        {computed?.total.toFixed(2) || "—"}
                      </td>
                      <td>{computed ? (isGradeNineClass(cls?.name || "")
                        ? `${mockBandFor(computed.total)?.grade ?? "—"} (${mockBandFor(computed.total)?.point ?? "—"})`
                        : computed.grade) : "—"}</td>
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
                      </td></>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">
                {Object.keys(edits).length} learners with unsaved changes
                {visibleStudents.length < students.length ? " (including any edited learners hidden by filters)" : ""}
              </p>
              {invalidCount > 0 && <p className="mt-1 text-sm font-semibold text-red-700" role="alert">
                {invalidCount} invalid mark attempt{invalidCount === 1 ? "" : "s"} rejected. Correct the highlighted input before saving.
              </p>}
            </div>
            <button
              className="btn-primary"
              disabled={busy || !open || invalidCount > 0 || !Object.keys(edits).length}
            >
              {earlyYears ? "Save assessments" : "Save marks"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
