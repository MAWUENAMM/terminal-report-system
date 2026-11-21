import assert from "node:assert/strict";
import test from "node:test";

import { filterAssessmentStudents, isCompleteMark, markEntryError } from "../src/lib/assessment-filters";
import type { Student } from "../src/lib/models";

const students = [
  { id: "1", first_name: "Yaw", last_name: "Mensah", other_names: "", admission_number: "AA003", class_id: "c1", gender: "M" },
  { id: "2", first_name: "Ama", last_name: "Boateng", other_names: "", admission_number: "AA002", class_id: "c1", gender: "F" },
  { id: "3", first_name: "Akosua", last_name: "Ofori", other_names: "", admission_number: "AA001", class_id: "c1", gender: "F" },
  { id: "4", first_name: "Kwame", last_name: "Owusu", other_names: "", admission_number: "BB020", class_id: "c2", gender: "M" },
] as Student[];

test("Assessment filters by names, admission numbers, gender, letter and class", () => {
  assert.deepEqual(filterAssessmentStudents(students, { classId: "c1", order: "az" }).map((s) => s.id), ["3", "2", "1"]);
  assert.deepEqual(filterAssessmentStudents(students, { classId: "c1", order: "za" }).map((s) => s.id), ["1", "2", "3"]);
  assert.deepEqual(filterAssessmentStudents(students, { gender: "F", initial: "A", order: "az" }).map((s) => s.id), ["3", "2"]);
  assert.deepEqual(filterAssessmentStudents(students, { gender: "M", initial: "A" }).map((s) => s.id), []);
  assert.deepEqual(filterAssessmentStudents(students, { query: "ofori" }).map((s) => s.id), ["3"]);
  assert.deepEqual(filterAssessmentStudents(students, { query: "aa002" }).map((s) => s.id), ["2"]);
  assert.deepEqual(students.map((s) => s.id), ["1", "2", "3", "4"], "Sorting must not mutate stored learners");
});

test("SBA exactly 60 and Exam exactly 100 are valid", () => {
  assert.equal(markEntryError("60", 60, "SBA"), null);
  assert.equal(markEntryError("60.00", 60, "SBA"), null);
  assert.equal(markEntryError("100", 100, "Exam"), null);
  assert.equal(markEntryError("100.00", 100, "Exam"), null);
  assert.equal(markEntryError("0", 60, "SBA"), null);
  assert.equal(isCompleteMark("60", 60, "SBA"), true);
  assert.equal(isCompleteMark("100", 100, "Exam"), true);
});

test("SBA 61 and Exam 101 are rejected immediately, without silent clamping", () => {
  assert.match(markEntryError("61", 60, "SBA") || "", /cannot exceed 60/);
  assert.match(markEntryError("60.01", 60, "SBA") || "", /cannot exceed 60/);
  assert.match(markEntryError("101", 100, "Exam") || "", /cannot exceed 100/);
  assert.match(markEntryError("100.01", 100, "Exam") || "", /cannot exceed 100/);
  assert.equal(isCompleteMark("61", 60, "SBA"), false);
  assert.equal(isCompleteMark("101", 100, "Exam"), false);
});

test("Incomplete and malformed marks cannot be saved", () => {
  for (const v of ["", ".", "-1", "abc", "1e2", "4.567"]) {
    assert.equal(isCompleteMark(v, 60, "SBA"), false, `Should block ${JSON.stringify(v)}`);
  }
  assert.equal(markEntryError("", 60, "SBA"), null, "Blank is allowed only while editing");
  assert.match(markEntryError("-1", 60, "SBA") || "", /positive number/);
  assert.equal(isCompleteMark(".5", 60, "SBA"), true);
  assert.equal(isCompleteMark("12.50", 60, "SBA"), true);
});

test("Other schools can still use the separately configured SBA /100 scale", () => {
  assert.equal(isCompleteMark("80", 100, "SBA"), true);
  assert.equal(isCompleteMark("101", 100, "SBA"), false);
});
