import assert from "node:assert/strict";
import test from "node:test";
import { buildClassResultSheet, filterSortStudents, ordinal } from "../src/lib/class-sheets";
import type { Workspace, Student, Score } from "../src/lib/models";

const student = (id: string, first: string, gender: "M" | "F"): Student => ({
  id, school_id: "school1", class_id: "class1", admission_number: id,
  first_name: first, last_name: "Student", gender, status: "ACTIVE",
});
const students = [
  student("s1", "Ama", "F"),
  student("s2", "Kojo", "M"),
  student("s3", "Akosua", "F"),
  student("s4", "Yaw", "M"),
];
const scores: Score[] = [
  { id: "1", student_id: "s1", subject_id: "math", total: 80 },
  { id: "2", student_id: "s1", subject_id: "eng", total: 70 },
  { id: "3", student_id: "s2", subject_id: "math", total: 90 },
  { id: "4", student_id: "s2", subject_id: "eng", total: 60 },
  { id: "5", student_id: "s3", subject_id: "math", total: 60 },
].map((r) => ({
  ...r, school_id: "school1", class_id: "class1", term: 1, academic_year: "2026/2027",
  sba_raw: 0, exam_raw: 0, sba_scaled: 0, exam_scaled: 0, grade: "-",
}));
const workspace = {
  school: { id: "school1", name: "Test School", academic_year: "2026/2027", current_term: 1 },
  classes: [{ id: "class1", school_id: "school1", name: "BS5", level: "PRIMARY" }],
  subjects: [
    { id: "math", school_id: "school1", name: "Mathematics", active: true, display_order: 1, level: "PRIMARY" },
    { id: "eng", school_id: "school1", name: "English", active: true, display_order: 2, level: "PRIMARY" },
  ],
  students, scores, assignments: [],
} as unknown as Workspace;

test("student list sorts A-Z and Z-A without changing original records", () => {
  assert.deepEqual(filterSortStudents(students, { order: "az" }).map((s) => s.first_name),
    ["Akosua", "Ama", "Kojo", "Yaw"]);
  assert.deepEqual(filterSortStudents(students, { order: "za" }).map((s) => s.first_name),
    ["Yaw", "Kojo", "Ama", "Akosua"]);
  assert.deepEqual(filterSortStudents(students, { gender: "F", order: "za" }).map((s) => s.first_name),
    ["Ama", "Akosua"]);
  assert.equal(students[0].first_name, "Ama");
});

test("class performance sheet calculates totals and averages from current term marks", () => {
  const sheet = buildClassResultSheet(workspace, "class1");
  const ama = sheet.rows.find((x) => x.student.id === "s1")!;
  assert.equal(ama.total, 150);
  assert.equal(ama.average, 75);
  assert.equal(ama.complete, true);
  assert.equal(ama.position, 1);
  assert.equal(sheet.rows.length, 4);
  assert.equal(sheet.subjects.length, 2);
  assert.equal(sheet.withScores, 3);
});

test("ranking gives true competition ties and leaves students without marks unranked", () => {
  const sheet = buildClassResultSheet(workspace, "class1");
  assert.deepEqual(sheet.ranked.map((r) => [r.student.id, r.position]),
    [["s1", 1], ["s2", 1], ["s3", 3], ["s4", null]]);
  const incomplete = sheet.rows.find((r) => r.student.id === "s3")!;
  assert.equal(incomplete.subjectCount, 1);
  assert.equal(incomplete.bySubject.has("eng"), false);
  assert.equal(incomplete.complete, false);
  const unscored = sheet.rows.find((r) => r.student.id === "s4")!;
  assert.equal(unscored.total, null);
  assert.equal(unscored.average, null);
});

test("other term marks cannot change the selected class ranking", () => {
  const otherTerm = { ...scores[0], id: "old", term: 2, total: 100 };
  const sheet = buildClassResultSheet({ ...workspace, scores: [...scores, otherTerm] }, "class1");
  assert.equal(sheet.rows.find((r) => r.student.id === "s1")?.average, 75);
});

test("position labels handle 1st, 2nd, 3rd and 11th-13th", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, null].map(ordinal),
    ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "—"]);
});
