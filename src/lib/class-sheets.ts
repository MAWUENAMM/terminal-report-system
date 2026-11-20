import { computePositions } from "./grading";
import { fullName, type School, type SchoolClass, type Score, type Student, type Subject, type Workspace } from "./models";

export type NameSort = "az" | "za";
export type GenderFilter = "" | "M" | "F";

export function filterSortStudents(
  students: Student[],
  options: { query?: string; classId?: string; gender?: GenderFilter; order?: NameSort },
): Student[] {
  const search = (options.query || "").trim().toLocaleLowerCase();
  const sign = options.order === "za" ? -1 : 1;
  return students
    .filter((student) =>
      (!options.classId || student.class_id === options.classId) &&
      (!options.gender || student.gender === options.gender) &&
      (!search || `${fullName(student)} ${student.admission_number}`.toLocaleLowerCase().includes(search)),
    )
    .sort((a, b) =>
      sign * fullName(a).localeCompare(fullName(b), "en", { sensitivity: "base", numeric: true }) ||
      a.admission_number.localeCompare(b.admission_number, "en", { numeric: true }),
    );
}

export type ClassResultRow = {
  student: Student;
  bySubject: Map<string, number>;
  total: number | null;
  average: number | null;
  subjectCount: number;
  expectedCount: number;
  complete: boolean;
  position: number | null;
};

export type ClassResultSheet = {
  school: School;
  classGroup: SchoolClass;
  subjects: Subject[];
  rows: ClassResultRow[];
  ranked: ClassResultRow[];
  withScores: number;
};

const oneDecimal = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

export function buildClassResultSheet(workspace: Workspace, classId: string): ClassResultSheet {
  const classGroup = workspace.classes.find((c) => c.id === classId && c.school_id === workspace.school.id);
  if (!classGroup) throw new Error("Select a class assigned to this school.");

  const assigned = new Set(workspace.assignments
    .filter((a) => a.class_id === classId && a.school_id === workspace.school.id)
    .map((a) => a.subject_id));
  const subjects = workspace.subjects
    .filter((s) =>
      s.active && s.school_id === workspace.school.id &&
      (assigned.size ? assigned.has(s.id) : s.level === "ALL" || s.level === classGroup.level),
    )
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "en"));
  const subjectIds = new Set(subjects.map((s) => s.id));
  const classScores = workspace.scores.filter((score) =>
    score.school_id === workspace.school.id &&
    score.class_id === classId &&
    score.academic_year === workspace.school.academic_year &&
    score.term === workspace.school.current_term &&
    subjectIds.has(score.subject_id),
  );
  const scoreIndex = new Map<string, Score>();
  for (const score of classScores) scoreIndex.set(`${score.student_id}:${score.subject_id}`, score);

  const rows: ClassResultRow[] = filterSortStudents(
    workspace.students.filter((s) => s.school_id === workspace.school.id && s.class_id === classId && s.status === "ACTIVE"),
    { order: "az" },
  ).map((student) => {
    const bySubject = new Map<string, number>();
    for (const subject of subjects) {
      const score = scoreIndex.get(`${student.id}:${subject.id}`);
      const total = Number(score?.total);
      if (score && Number.isFinite(total) && total >= 0 && total <= 100) bySubject.set(subject.id, total);
    }
    const subjectCount = bySubject.size;
    const total = subjectCount ? [...bySubject.values()].reduce((sum, n) => sum + n, 0) : null;
    const average = total === null ? null : oneDecimal(total / subjectCount);
    return {
      student, bySubject,
      total: total === null ? null : oneDecimal(total),
      average, subjectCount,
      expectedCount: subjects.length,
      complete: subjects.length > 0 && subjectCount === subjects.length,
      position: null,
    };
  });

  // Only students with recorded marks can be ranked. Competition ranking:
  // 1, 2, 2, 4 (ties do not produce arbitrary, contradictory positions).
  const ranks = computePositions(rows
    .filter((row) => row.average !== null)
    .map((row) => ({ studentId: row.student.id, total: row.average! })));
  for (const row of rows) row.position = ranks.get(row.student.id) ?? null;
  const ranked = [...rows].sort((a, b) =>
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
    fullName(a.student).localeCompare(fullName(b.student), "en", { sensitivity: "base" }),
  );
  return { school: workspace.school, classGroup, subjects, rows, ranked, withScores: ranks.size };
}

export function ordinal(rank: number | null): string {
  if (rank === null) return "—";
  const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? "th" :
    rank % 10 === 1 ? "st" : rank % 10 === 2 ? "nd" : rank % 10 === 3 ? "rd" : "th";
  return `${rank}${suffix}`;
}
