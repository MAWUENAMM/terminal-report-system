import { computePositions, getGrade } from "./grading";
import type { ReportSnapshot } from "./models";

export type ArchivedAcademicTerm = {
  id: string;
  student_id: string;
  school_id: string;
  academic_year: string;
  term: number;
  revision: number;
  created_at: string;
  snapshot: ReportSnapshot;
};

export type AcademicTermSummary = {
  archive: ArchivedAcademicTerm;
  academicYear: string;
  term: number;
  className: string;
  subjects: Array<{ id: string; name: string; score: number; grade: string }>;
  total: number | null;
  average: number | null;
  grade: string;
  position: number | null;
  attendance: { daysPresent: number; totalDays: number } | null;
};

export function latestArchivedTerms(archives: ArchivedAcademicTerm[]): ArchivedAcademicTerm[] {
  const selected = new Map<string, ArchivedAcademicTerm>();
  for (const a of archives) {
    const key = `${a.academic_year}:${a.term}`;
    const previous = selected.get(key);
    if (!previous || a.revision > previous.revision ||
        a.revision === previous.revision && a.created_at > previous.created_at) selected.set(key, a);
  }
  return [...selected.values()].sort((a, b) =>
    a.academic_year.localeCompare(b.academic_year, "en", { numeric: true }) ||
    a.term - b.term,
  );
}

export function summarizeAcademicTerm(a: ArchivedAcademicTerm): AcademicTermSummary {
  const snapshot = a.snapshot;
  const subjects = new Map((snapshot.subjects || []).map((s) => [s.id, s]));
  const marks = [...(snapshot.scores || [])]
    .filter((sc) => Number.isFinite(Number(sc.total)) && Number(sc.total) >= 0 && Number(sc.total) <= 100)
    .sort((x, y) =>
      (subjects.get(x.subject_id)?.display_order ?? 999) -
      (subjects.get(y.subject_id)?.display_order ?? 999),
    )
    .map((s) => ({
      id: s.subject_id,
      name: subjects.get(s.subject_id)?.name || "Subject (historic)",
      score: Number(s.total),
      grade: s.grade || getGrade(Number(s.total)).grade,
    }));

  const total = marks.length
    ? Math.round(marks.reduce((sum, s) => sum + s.score, 0) * 100) / 100
    : null;
  const average = total === null ? null : Math.round((total / marks.length) * 10) / 10;

  const ranked = (snapshot.class_students || []).flatMap((student) => {
    const scores = (snapshot.class_scores || []).filter((x) => x.student_id === student.id);
    if (!scores.length) return [];
    const mean = scores.reduce((sum, s) => sum + Number(s.total), 0) / scores.length;
    return [{ studentId: student.id, total: Math.round(mean * 10) / 10 }];
  });
  const position = marks.length ? computePositions(ranked).get(a.student_id) ?? null : null;
  const att = snapshot.attendance;
  return {
    archive: a, academicYear: a.academic_year, term: a.term,
    className: snapshot.class?.name || "Class not recorded",
    subjects: marks, total, average,
    grade: average === null ? "—" : getGrade(average).grade,
    position,
    attendance: att ? { daysPresent: Number(att.days_present), totalDays: Number(att.total_days) } : null,
  };
}

export function termLabel(term: number) {
  return term === 1 ? "First Term" : term === 2 ? "Second Term" : term === 3 ? "Third Term" : `Term ${term}`;
}

export function ordinalPosition(value: number | null) {
  if (value === null) return "—";
  const ending = value % 100 >= 11 && value % 100 <= 13 ? "th" :
    value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th";
  return `${value}${ending}`;
}
