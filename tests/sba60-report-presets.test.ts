import assert from "node:assert/strict";
import test from "node:test";
import { computeTotal, scaleScore } from "../src/lib/grading";
import { teacherRemarks, attitudes, conduct, interests, remarkOptions } from "../src/lib/remark-options";

test("Ark Academy /60 SBA and /100 exam each scale to 50 marks", () => {
  assert.equal(scaleScore(48, 60, 50), 40);
  assert.deepEqual(computeTotal(48, 60, 70, 100), {
    sbaScaled: 40, examScaled: 35, total: 75, grade: "B",
    descriptor: "Very Good",
  });
  assert.equal(computeTotal(60, 60, 100, 100).total, 100);
  assert.equal(computeTotal(0, 60, 0, 100).total, 0);
});

test("legacy /100 SBA for other schools retains previous weighted values", () => {
  const before = computeTotal(80, 100, 70, 100);
  assert.equal(before.total, 75);
  const rebase = computeTotal(48, 60, 70, 100);
  assert.equal(rebase.total, before.total);
  assert.equal(rebase.grade, before.grade);
});

test("school-provided remark sets are available to both teachers and development fields", () => {
  assert.equal(teacherRemarks.length, 30);
  assert.equal(attitudes.length, 20);
  assert.equal(conduct.length, 19);
  assert.equal(interests.length, 18);
  assert.ok(remarkOptions.headteacher_remark.includes("Excellent performance. Keep it up!"));
  assert.ok(remarkOptions.class_teacher_remark.includes("A promising student. Aim higher."));
  assert.ok(remarkOptions.attitude.includes("Punctual and regular"));
  assert.ok(remarkOptions.talents.includes("Coding and programming"));
  assert.ok(remarkOptions.conduct.includes("Respectful"));
  assert.ok(remarkOptions.interest.includes("Drawing and painting"));
});
