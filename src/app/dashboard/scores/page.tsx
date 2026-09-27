"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { store } from "@/lib/store";
import { Class, Student, Subject, Score, School } from "@/types";
import { computeTotal, computePositions } from "@/lib/grading";
import { formatName } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

type ScoreRow = {
  studentId: string;
  sbaRaw: string;
  examRaw: string;
  existingId?: string;
};

export default function ScoresPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [term, setTerm] = useState<1 | 2 | 3>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    store.seed();

    const cls = store.getClasses();
    const subs = store.getSubjects();
    const sch = store.getSchool();

    setClasses(cls);
    setSubjects(subs);
    setSchool(sch);

    if (cls.length) setSelectedClass(cls[0].id);
    if (subs.length) setSelectedSubject(subs[0].id);
    if (sch) setTerm(sch.currentTerm);
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSubject || !school) return;

    const classStudents = store.getStudentsByClass(selectedClass);
    const existing = store
      .getScoresByClassTerm(selectedClass, term, school.academicYear)
      .filter((score) => score.subjectId === selectedSubject);

    setStudents(classStudents);
    setRows(
      classStudents.map((student) => {
        const score = existing.find((item) => item.studentId === student.id);

        return {
          studentId: student.id,
          sbaRaw: score?.sbaRaw?.toString() ?? "",
          examRaw: score?.examRaw?.toString() ?? "",
          existingId: score?.id,
        };
      })
    );
    setError("");
    setSaved(false);
  }, [selectedClass, selectedSubject, term, school]);

  function updateRow(
    studentId: string,
    field: "sbaRaw" | "examRaw",
    value: string
  ) {
    setRows((current) =>
      current.map((row) =>
        row.studentId === studentId ? { ...row, [field]: value } : row
      )
    );
    setError("");
    setSaved(false);
  }

  function saveAll() {
    if (!school || !selectedClass || !selectedSubject) return;

    const invalid = rows.find((row) => {
      const values = [row.sbaRaw, row.examRaw].filter((value) => value !== "");
      return values.some((value) => {
        const number = Number(value);
        return !Number.isFinite(number) || number < 0 || number > 100;
      });
    });

    if (invalid) {
      setError("Each entered score must be a number between 0 and 100.");
      setSaved(false);
      return;
    }

    const existingScores = store.getScores().filter(
      (score) =>
        !(
          score.classId === selectedClass &&
          score.subjectId === selectedSubject &&
          score.term === term &&
          score.academicYear === school.academicYear
        )
    );

    const nextScores: Score[] = rows.map((row) => {
      const calculation = computeTotal(
        Number(row.sbaRaw) || 0,
        100,
        Number(row.examRaw) || 0,
        100,
        school.sbaWeight,
        school.examWeight
      );

      return {
        id: row.existingId || uuidv4(),
        studentId: row.studentId,
        subjectId: selectedSubject,
        classId: selectedClass,
        term,
        academicYear: school.academicYear,
        sbaRaw: row.sbaRaw === "" ? undefined : Number(row.sbaRaw),
        sbaScaled: calculation.sbaScaled,
        examRaw: row.examRaw === "" ? undefined : Number(row.examRaw),
        examScaled: calculation.examScaled,
        total: calculation.total,
        grade: calculation.grade,
      };
    });

    const positions = computePositions(
      nextScores.map((score) => ({
        studentId: score.studentId,
        total: score.total,
      }))
    );

    nextScores.forEach((score) => {
      score.position = positions.get(score.studentId);
    });

    store.saveScores([...existingScores, ...nextScores]);
    setError("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return students;

    return students.filter((student) => {
      const name = formatName(
        student.firstName,
        student.lastName,
        student.otherNames
      ).toLowerCase();

      return (
        name.includes(q) ||
        student.admissionNumber.toLowerCase().includes(q)
      );
    });
  }, [students, query]);

  const entered = rows.filter(
    (row) => row.sbaRaw !== "" || row.examRaw !== ""
  ).length;

  const completion = students.length
    ? Math.round((entered / students.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="eyebrow">Assessment workspace</div>
          <h1 className="page-title mt-2">Assessment &amp; Scores</h1>
          <p className="mt-2 text-sm text-muted">
            Enter raw marks once. The system scales, grades and ranks them
            automatically.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--g-green)]/15 bg-[var(--g-green)]/5 px-3 py-2 text-xs font-semibold text-[var(--g-green)]">
          <Sparkles size={15} />
          {school?.sbaWeight ?? 50}:{school?.examWeight ?? 50} automated
          weighting
        </div>
      </header>

      <section className="surface rounded-2xl p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Class
            </label>
            <select
              className="field"
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Subject
            </label>
            <select
              className="field"
              value={selectedSubject}
              onChange={(event) => setSelectedSubject(event.target.value)}
            >
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Term
            </label>
            <select
              className="field"
              value={term}
              onChange={(event) =>
                setTerm(Number(event.target.value) as 1 | 2 | 3)
              }
            >
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Find learner
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                className="field pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or admission no."
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface rounded-2xl p-4">
          <div className="text-xs text-muted">Class roster</div>
          <div className="mt-1 text-2xl font-semibold">{students.length}</div>
          <div className="text-xs text-muted">learners</div>
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="text-xs text-muted">Entry completion</div>
          <div className="mt-1 text-2xl font-semibold">{completion}%</div>
          <div className="text-xs text-muted">
            {entered} of {students.length} started
          </div>
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="text-xs text-muted">Assessment policy</div>
          <div className="mt-1 text-2xl font-semibold">
            {school?.sbaWeight ?? 50}/{school?.examWeight ?? 50}
          </div>
          <div className="text-xs text-muted">SBA / examination</div>
        </div>
      </div>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--g-green)]/10 text-[var(--g-green)]">
              <ClipboardCheck size={17} />
            </div>
            <div>
              <div className="text-sm font-semibold">Mark entry</div>
              <div className="text-xs text-muted">
                Raw scores are out of 100
              </div>
            </div>
          </div>

          <button
            onClick={saveAll}
            disabled={!students.length}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={15} />
            Save assessment
          </button>
        </div>

        {error && (
          <div
            className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b border-line bg-paper/80">
              <tr>
                {[
                  "Learner",
                  "SBA raw",
                  "Exam raw",
                  `SBA / ${school?.sbaWeight ?? 50}`,
                  `Exam / ${school?.examWeight ?? 50}`,
                  "Total",
                  "Grade",
                ].map((heading, index) => (
                  <th
                    key={heading}
                    className={`px-3 py-3 text-${index === 0 ? "left" : "center"} text-[10px] font-bold uppercase tracking-wider text-muted first:pl-5 last:pr-5`}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((student) => {
                const row = rows.find(
                  (item) => item.studentId === student.id
                );

                if (!row) return null;

                const calculation = school
                  ? computeTotal(
                      Number(row.sbaRaw) || 0,
                      100,
                      Number(row.examRaw) || 0,
                      100,
                      school.sbaWeight,
                      school.examWeight
                    )
                  : null;

                return (
                  <tr
                    key={student.id}
                    className="border-t border-line/70 transition hover:bg-paper/60"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">
                        {formatName(
                          student.firstName,
                          student.lastName,
                          student.otherNames
                        )}
                      </div>
                      <div className="text-[11px] text-muted">
                        {student.admissionNumber}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={row.sbaRaw}
                        onChange={(event) =>
                          updateRow(
                            student.id,
                            "sbaRaw",
                            event.target.value
                          )
                        }
                        className="w-24 rounded-lg border border-line bg-white px-3 py-2 text-center outline-none transition focus:border-[var(--g-green)] focus:ring-4 focus:ring-[var(--g-green)]/10"
                        aria-label={`${formatName(
                          student.firstName,
                          student.lastName
                        )} SBA score`}
                      />
                    </td>

                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={row.examRaw}
                        onChange={(event) =>
                          updateRow(
                            student.id,
                            "examRaw",
                            event.target.value
                          )
                        }
                        className="w-24 rounded-lg border border-line bg-white px-3 py-2 text-center outline-none transition focus:border-[var(--g-green)] focus:ring-4 focus:ring-[var(--g-green)]/10"
                        aria-label={`${formatName(
                          student.firstName,
                          student.lastName
                        )} examination score`}
                      />
                    </td>

                    <td className="px-3 py-3 text-center text-muted">
                      {calculation
                        ? calculation.sbaScaled.toFixed(1)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-muted">
                      {calculation
                        ? calculation.examScaled.toFixed(1)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold">
                      {calculation ? calculation.total.toFixed(1) : "—"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {calculation ? (
                        <span className="inline-flex min-w-8 justify-center rounded-lg bg-paper px-2 py-1 text-xs font-bold text-ink">
                          {calculation.grade}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {students.length === 0 && (
          <div className="px-6 py-16 text-center">
            <SlidersHorizontal className="mx-auto text-muted/50" />
            <div className="mt-3 text-sm font-medium">No learners in this class</div>
            <div className="mt-1 text-xs text-muted">
              Add learners before entering assessment scores.
            </div>
          </div>
        )}

        {students.length > 0 && filtered.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Search className="mx-auto text-muted/50" />
            <div className="mt-3 text-sm font-medium">
              No learners match your search
            </div>
            <div className="mt-1 text-xs text-muted">
              Try a different name or admission number.
            </div>
          </div>
        )}

        {saved && (
          <div
            className="m-4 flex items-center gap-2 rounded-xl bg-[var(--g-green)]/5 px-4 py-3 text-sm font-medium text-[var(--g-green)]"
            role="status"
          >
            <CheckCircle2 size={16} />
            Assessment records saved successfully.
          </div>
        )}
      </section>
    </div>
  );
}
