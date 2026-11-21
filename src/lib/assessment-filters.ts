import { filterSortStudents, type GenderFilter, type NameSort } from "./class-sheets";
import { fullName, type Student } from "./models";

export type AssessmentFilters = {
  query?: string;
  gender?: GenderFilter;
  order?: NameSort;
  initial?: string;
  classId?: string;
};

export function filterAssessmentStudents(
  students: Student[],
  filters: AssessmentFilters,
): Student[] {
  const initial = (filters.initial || "").toLocaleUpperCase();
  return filterSortStudents(students, {
    query: filters.query,
    gender: filters.gender,
    order: filters.order,
    classId: filters.classId,
  }).filter((student) =>
    !initial || fullName(student).trim().toLocaleUpperCase().startsWith(initial),
  );
}

/**
 * Reject attempted out-of-range values without silently replacing them.
 * Empty and intermediate '.' are allowed while editing but cannot be saved.
 */
export function markEntryError(value: string, max: number, label: string): string | null {
  if (value === "" || value === ".") return null;
  const validShape = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value);
  if (!validShape) {
    return `${label} must be a positive number with at most two decimal places.`;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return `${label} must be 0 or higher.`;
  }
  if (number > max) {
    return `${label} cannot exceed ${max}. The value ${value} was not accepted.`;
  }
  return null;
}

export function isCompleteMark(value: string, max: number, label: string): boolean {
  return value !== "" && value !== "." && markEntryError(value, max, label) === null;
}
