import assert from "node:assert/strict";
import test from "node:test";
import { getGrade, computePositions, getPerformanceRemark } from "../src/lib/grading";
import { validateImport } from "../src/lib/student-import";
import type { SchoolClass, Student } from "../src/lib/models";

test("decimal scores retain the correct grade at every boundary", () => {
  for (const [score, grade] of [
    [39.9, "F"],
    [40, "E"],
    [49.99, "E"],
    [50, "D"],
    [59.5, "D"],
    [60, "C"],
    [69.9, "C"],
    [70, "B"],
    [79.5, "B"],
    [80, "A"],
    [100, "A"],
  ] as const)
    assert.equal(getGrade(score).grade, grade);
});
test("performance remarks follow the school report bands exactly", () => {
  for (const [score, remark] of [
    [100, "HIGHEST"],
    [80, "HIGHEST"],
    [79.99, "HIGHER"],
    [70, "HIGHER"],
    [69.99, "HIGH"],
    [65, "HIGH"],
    [64.99, "HIGH AVERAGE"],
    [60, "HIGH AVERAGE"],
    [59.99, "AVERAGE"],
    [55, "AVERAGE"],
    [54.99, "LOW AVERAGE"],
    [50, "LOW AVERAGE"],
    [49.99, "LOW"],
    [45, "LOW"],
    [44.99, "LOWER"],
    [35, "LOWER"],
    [34.99, "LOWEST"],
    [0, "LOWEST"],
  ] as const)
    assert.equal(getPerformanceRemark(score), remark);
});
test("equal averages share a competition rank", () => {
  assert.deepEqual(
    [
      ...computePositions([
        { studentId: "a", total: 80 },
        { studentId: "b", total: 80 },
        { studentId: "c", total: 75 },
      ]),
    ],
    [
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ],
  );
});
const classes = [{ id: "c1", name: "Primary 4" }] as SchoolClass[];
const valid = {
  admission_number: "0001",
  first_name: "Ama",
  last_name: "Demo",
  gender: "female",
  class: " primary 4 ",
};
test("student import preserves admission zeros and matches class names", () => {
  const result = validateImport([valid], classes, []);
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].admission_number, "0001");
  assert.equal(result.rows[0].class_id, "c1");
  assert.equal(result.rows[0].gender, "F");
});
test("imports reject unknown classes and duplicate admissions", () => {
  const result = validateImport(
    [valid, { ...valid, class: "Unknown" }],
    classes,
    [],
  );
  assert.match(result.errors[0], /does not exist/);
  assert.match(result.errors[0], /duplicated/);
  assert.match(
    validateImport([valid], classes, [{ admission_number: "0001" } as Student])
      .errors[0],
    /already exists/,
  );
});
test("empty and oversized imports are rejected before saving", () => {
  assert.equal(validateImport([], classes, []).rows.length, 0);
  assert.ok(validateImport([], classes, []).errors.length);
  assert.match(
    validateImport(Array(1001).fill(valid), classes, []).errors[0],
    /1,000/,
  );
});
