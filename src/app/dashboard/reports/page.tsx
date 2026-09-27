"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Search,
} from "lucide-react";
import { store } from "@/lib/store";
import {
  Class,
  Student,
  Subject,
  School,
  ReportCardData,
} from "@/types";
import {
  computeOverallAverage,
  getGrade,
  computePositions,
} from "@/lib/grading";
import { formatName } from "@/lib/utils";
import { generateReportPDF } from "@/lib/report-pdf";
import { v4 as uuidv4 } from "uuid";

export default function ReportsPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [term, setTerm] = useState<1 | 2 | 3>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    store.seed();

    const cls = store.getClasses();
    const sch = store.getSchool();

    setClasses(cls);
    setSchool(sch);
    setSubjects(store.getSubjects());

    if (cls.length) setSelectedClass(cls[0].id);
    if (sch) setTerm(sch.currentTerm);
  }, []);

  useEffect(() => {
    if (selectedClass) {
      setStudents(store.getStudentsByClass(selectedClass));
    }
  }, [selectedClass]);

  function showMessage(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3500);
  }

  function buildReportData(student: Student): ReportCardData | null {
    if (!school) return null;

    const cls = classes.find((item) => item.id === selectedClass);
    if (!cls) return null;

    const classScores = store
      .getScoresByClassTerm(selectedClass, term, school.academicYear);

    const scores = classScores.filter((score) => score.studentId === student.id);
    if (scores.length === 0) return null;

    const allStudents = store.getStudentsByClass(selectedClass);
    const studentAverages = allStudents
      .map((item) => {
        const itemScores = classScores.filter(
          (score) => score.studentId === item.id
        );
        return {
          studentId: item.id,
          total: computeOverallAverage(itemScores),
        };
      })
      .filter((item) => item.total > 0);

    const positionMap = computePositions(studentAverages);
    const overallAverage = computeOverallAverage(scores);

    return {
      student,
      school,
      class: cls,
      scores,
      attendance: store.getAttendance().find(
        (item) =>
          item.studentId === student.id &&
          item.term === term &&
          item.academicYear === school.academicYear
      ),
      affective: store.getAffective().find(
        (item) =>
          item.studentId === student.id &&
          item.term === term &&
          item.academicYear === school.academicYear
      ),
      remarks: store.getRemarks().find(
        (item) =>
          item.studentId === student.id &&
          item.term === term &&
          item.academicYear === school.academicYear
      ),
      overallAverage,
      overallGrade: getGrade(overallAverage).grade,
      overallPosition: positionMap.get(student.id),
      totalStudents: allStudents.length,
    };
  }

  function downloadOne(student: Student) {
    const data = buildReportData(student);

    if (!data) {
      showMessage(
        `No assessment scores found for ${formatName(
          student.firstName,
          student.lastName
        )}.`
      );
      return;
    }

    generateReportPDF(data, subjects).save(
      `Report_${student.admissionNumber}_${school?.academicYear}_T${term}.pdf`
    );

    showMessage(
      `Downloaded report for ${formatName(
        student.firstName,
        student.lastName
      )}.`
    );
  }

  function downloadAll() {
    let count = 0;

    students.forEach((student) => {
      const data = buildReportData(student);

      if (data) {
        generateReportPDF(data, subjects).save(
          `Report_${student.admissionNumber}_${school?.academicYear}_T${term}.pdf`
        );
        count += 1;
      }
    });

    showMessage(
      count
        ? `Generated ${count} report ${count === 1 ? "card" : "cards"}.`
        : "No completed reports are available for this class yet."
    );
  }

  function ensureDemoRemarks() {
    if (!school) return;

    const remarks = store.getRemarks();
    const attendance = store.getAttendance();
    const affective = store.getAffective();
    let changed = false;

    students.forEach((student) => {
      if (
        !remarks.find(
          (item) =>
            item.studentId === student.id &&
            item.term === term &&
            item.academicYear === school.academicYear
        )
      ) {
        remarks.push({
          id: uuidv4(),
          studentId: student.id,
          term,
          academicYear: school.academicYear,
          classTeacherRemark:
            "A hardworking pupil who participates actively in class. Keep it up.",
          headteacherRemark:
            "Promising performance. Continue to work hard.",
        });
        changed = true;
      }

      if (
        !attendance.find(
          (item) =>
            item.studentId === student.id &&
            item.term === term &&
            item.academicYear === school.academicYear
        )
      ) {
        attendance.push({
          id: uuidv4(),
          studentId: student.id,
          term,
          academicYear: school.academicYear,
          daysPresent: 55 + Math.floor(Math.random() * 10),
          totalDays: 65,
        });
        changed = true;
      }

      if (
        !affective.find(
          (item) =>
            item.studentId === student.id &&
            item.term === term &&
            item.academicYear === school.academicYear
        )
      ) {
        affective.push({
          id: uuidv4(),
          studentId: student.id,
          term,
          academicYear: school.academicYear,
          conduct: "Good",
          interest: "High",
          attitude: "Positive",
          talents: "Sports, Music",
        });
        changed = true;
      }
    });

    if (changed) {
      store.saveRemarks(remarks);
      store.saveAttendance(attendance);
      store.saveAffective(affective);
      showMessage("Demo attendance, conduct and remarks added.");
    } else {
      showMessage("Demo information is already prepared for this class.");
    }
  }

  const filteredStudents = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return students;

    return students.filter((student) => {
      const name = formatName(
        student.firstName,
        student.lastName,
        student.otherNames
      ).toLowerCase();

      return (
        name.includes(value) ||
        student.admissionNumber.toLowerCase().includes(value)
      );
    });
  }, [students, query]);

  const completedCount = students.filter((student) =>
    school
      ? store
          .getScoresByClassTerm(selectedClass, term, school.academicYear)
          .some((score) => score.studentId === student.id)
      : false
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="eyebrow">Report centre</div>
          <h1 className="page-title mt-2">Terminal Reports</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Generate polished terminal report cards with learner performance,
            attendance, affective records and school remarks.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--g-gold)]/30 bg-[var(--g-gold)]/10 px-3 py-2 text-xs font-semibold text-ink">
          <FileText size={15} />
          Professional PDF output
        </div>
      </header>

      <section className="surface rounded-2xl p-4 md:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_1fr_auto] lg:items-end">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
              className="field"
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
              Term
            </label>
            <select
              value={term}
              onChange={(event) =>
                setTerm(Number(event.target.value) as 1 | 2 | 3)
              }
              className="field"
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
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="field pl-9"
                placeholder="Name or admission no."
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:justify-end">
            <button onClick={ensureDemoRemarks} className="btn-secondary w-full sm:w-auto">
              Prepare demo data
            </button>
            <button
              onClick={downloadAll}
              disabled={completedCount === 0}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={15} />
              Download all
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div
          className="flex items-center gap-2 rounded-xl border border-[var(--g-green)]/15 bg-[var(--g-green)]/5 px-4 py-3 text-sm font-medium text-[var(--g-green)]"
          role="status"
        >
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface rounded-2xl p-4">
          <div className="text-xs text-muted">Class roster</div>
          <div className="mt-1 text-2xl font-semibold">{students.length}</div>
          <div className="text-xs text-muted">active learners</div>
        </div>
        <div className="surface rounded-2xl p-4">
          <div className="text-xs text-muted">Reports ready</div>
          <div className="mt-1 text-2xl font-semibold">{completedCount}</div>
          <div className="text-xs text-muted">learners with scores</div>
        </div>
        <div className="surface rounded-2xl p-4">
          <div className="text-xs text-muted">Academic period</div>
          <div className="mt-1 text-2xl font-semibold">
            T{term}
          </div>
          <div className="text-xs text-muted">
            {school?.academicYear || "—"}
          </div>
        </div>
      </div>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-line px-5 py-4">
          <div className="text-sm font-semibold">Learner report register</div>
          <div className="mt-1 text-xs text-muted">
            Download individual report cards or generate all completed reports.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line bg-paper/80">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted">
                  Learner
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted">
                  Admission no.
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted">
                  Completion
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted">
                  Report
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student) => {
                const scoreCount = school
                  ? store
                      .getScoresByClassTerm(
                        selectedClass,
                        term,
                        school.academicYear
                      )
                      .filter((score) => score.studentId === student.id).length
                  : 0;

                return (
                  <tr
                    key={student.id}
                    className="border-t border-line/70 transition hover:bg-paper/60"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {student.photoUrl ? (
                          <img
                            src={student.photoUrl}
                            className="h-9 w-9 rounded-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--g-green)]/10 text-xs font-semibold text-[var(--g-green)]">
                            {student.firstName[0]}
                            {student.lastName[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-ink">
                            {formatName(
                              student.firstName,
                              student.lastName,
                              student.otherNames
                            )}
                          </div>
                          <div className="text-xs text-muted">
                            {student.gender === "M" ? "Male" : "Female"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-muted">
                      {student.admissionNumber}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold " +
                          (scoreCount > 0
                            ? "bg-[var(--g-green)]/10 text-[var(--g-green)]"
                            : "bg-[var(--g-gold)]/15 text-ink")
                        }
                      >
                        {scoreCount} subject{scoreCount === 1 ? "" : "s"} entered
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => downloadOne(student)}
                        disabled={scoreCount === 0}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download size={13} />
                        PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {students.length === 0 && (
          <div className="px-6 py-16 text-center text-sm text-muted">
            No active learners are assigned to this class.
          </div>
        )}

        {students.length > 0 && filteredStudents.length === 0 && (
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
      </section>
    </div>
  );
}
