import assert from "node:assert/strict";
import test from "node:test";
import { computeGradeNineMock, gradeNineExamScore, isGradeNineClass, mockBandFor } from "../src/lib/grade9-mock";
import { generateReportPDF } from "../src/lib/report-pdf";
import type { ReportCardData, Subject } from "../src/types";
import { buildClassResultSheet } from "../src/lib/class-sheets";
import { exportClassResultsPdf } from "../src/lib/class-sheet-pdf";
import { currentSnapshot, reportData } from "../src/lib/reporting";
import type { Workspace } from "../src/lib/models";

const names = [
  "Career Tech", "Creative Art", "English Language", "French",
  "Ghanaian Language", "Mathematics", "R.M.E", "Science", "Social Studies",
];
const marks = [78, 90, 34, 89, 70, 100, 67, 56, 100];
const subjects: Subject[] = names.map((name, i) => ({
  id: "s" + i, name, code: String(i), level: "JHS",
  isCore: ["English Language", "Mathematics", "Science", "Social Studies"].includes(name),
  order: i,
}));
const scores = subjects.map((sub, i) => ({
  id: "score" + i, studentId: "l1", subjectId: sub.id, classId: "c9",
  term: 1 as const, academicYear: "2026/2027",
  sbaRaw: marks[i] * 0.6, examRaw: marks[i],
  sbaScaled: marks[i] * 0.6, examScaled: marks[i] * 0.4, total: marks[i],
  grade: "F", position: 1,
}));
const report: ReportCardData = {
  school: {
    id: "school", name: "MOCK SCHOOL", address: "Kumasi",
    academicYear: "2026/2027", currentTerm: 1, nextTermBegins: "2027-01-05", sbaWeight: 60,
    examWeight: 40, gradingScale: { id: "default", name: "Other classes", grades: [] },
  },
  student: {
    id: "l1", admissionNumber: "JHS001", firstName: "Viser", lastName: "Student",
    gender: "M", classId: "c9", status: "ACTIVE", createdAt: "",
  },
  class: { id: "c9", name: "Grade 9", level: "JHS", academicYear: "2026/2027" },
  scores, overallAverage: 76.0, overallGrade: "A", overallPosition: 1, totalStudents: 22,
  attendance: {
    id: "a1", studentId: "l1", term: 1, academicYear: "2026/2027",
    daysPresent: 62, totalDays: 65,
  },
  remarks: {
    id: "r1", studentId: "l1", term: 1, academicYear: "2026/2027",
    classTeacherRemark: "Good participation and effort.",
    headteacherRemark: "Continue to work hard.",
  },
};

test("Grade 9 scope accepts only actual ninth-level class aliases", () => {
  for (const className of ["Grade 9", "GRADE 09", "JHS 3", "JHS-3", "JHS III", "Basic 9"]) {
    assert.equal(isGradeNineClass(className), true, className);
  }
  for (const className of ["Grade 8", "JHS 2", "Grade 10", "Primary 9", "KG 9"]) {
    assert.equal(isGradeNineClass(className), false, className);
  }
});

test("reference school mock bands have the uploaded PDF boundaries", () => {
  for (const [mark, grade, point] of [
    [100, "A", 1], [80, "A", 1], [79.99, "B", 2], [68, "B", 2],
    [67.99, "C", 3], [54, "C", 3], [53.99, "D", 4], [40, "D", 4],
    [39.99, "E", 5], [0, "E", 5],
  ] as const) {
    assert.deepEqual(
      { grade: mockBandFor(mark)?.grade, point: mockBandFor(mark)?.point },
      { grade, point },
    );
  }
});

test("aggregate counts the four mandatory core subjects plus best two others", () => {
  const mock = computeGradeNineMock(subjects.map((s, i) => ({
    subjectId: s.id, name: s.name, score: marks[i],
  })));
  assert.equal(mock.complete, true);
  // PDF sample prints 9, but its printed grades yield 10 core + 1 + 1 = 12.
  assert.equal(mock.coreTotal, 10);
  assert.equal(mock.bestTwoTotal, 2);
  assert.equal(mock.aggregate, 12);
  assert.equal(mock.rows.filter((r) => r.included).length, 6);
  assert.deepEqual(
    mock.rows.filter((r) => r.included && !r.core).map((r) => r.name).sort(),
    ["Creative Art", "French"],
  );
});

test("incomplete Grade 9 data never produces a misleading aggregate zero", () => {
  const missing = computeGradeNineMock([
    { subjectId: "math", name: "Mathematics", score: 100 },
    { subjectId: "eng", name: "English Language", score: 85 },
    { subjectId: "elective", name: "French", score: 90 },
  ]);
  assert.equal(missing.complete, false);
  assert.equal(missing.aggregate, null);
  assert.deepEqual(missing.missingCore.sort(), ["Science", "Social Studies"]);
  assert.equal(missing.missingElectives, 1);
});

test("Grade 9 renders sample-style core and aggregate fields on ONE A4 page", () => {
  const doc = generateReportPDF(report, subjects);
  assert.equal(doc.getNumberOfPages(), 1);
  assert.equal(Math.round(doc.internal.pageSize.getWidth()), 210);
  assert.equal(Math.round(doc.internal.pageSize.getHeight()), 297);
  const pdf = doc.output();
  for (const label of [
    "BECE-STYLE SCHOOL MOCK", "FOUR CORE + BEST TWO", "CORE SUBJECT PERFORMANCE",
    "SCHOOL MOCK GRADE SCALE", "NOT an official WAEC", "ATTENDANCE",
    "HEADTEACHER", "SIGNATURE", "GENDER", "Male",
    "NEXT TERM BEGINS", "5 Jan 2027", "EXAM / 100",
  ]) {
    assert.ok(pdf.includes(label), "Missing text: " + label);
  }
  assert.ok(pdf.includes("(12)"), "Correct aggregate 12 should be printed");
  assert.ok(!pdf.includes("(SBA)"), "Grade 9 printed report must have no SBA column");
  assert.ok(!pdf.includes("SBA 60%"), "Grade 9 must not use school's shared SBA weight");
  assert.equal(report.scores[0].grade, "F", "Stored mark and grade must not be mutated");
});

test("Grade 9 class packs append exactly one A4 page per learner", () => {
  let doc = generateReportPDF(report, subjects);
  doc = generateReportPDF({
    ...report,
    student: { ...report.student, id: "l2", admissionNumber: "JHS002" },
  }, subjects, doc);
  assert.equal(doc.getNumberOfPages(), 2);
});

test("Grade 8 and every other class retain the existing terminal report PDF", () => {
  const data = { ...report, class: { ...report.class, name: "Grade 8" } };
  const pdf = generateReportPDF(data, subjects).output();
  assert.ok(pdf.includes("TERMINAL REPORT CARD"));
  assert.ok(!pdf.includes("BECE-STYLE SCHOOL MOCK"));
});


test("Grade 9 class sheets use aggregate rank while other classes retain average rank", () => {
  const learners = [
    { id: "learner1", school_id: "school", class_id: "c9", admission_number: "JHS001",
      first_name: "Ama", last_name: "First", gender: "F", status: "ACTIVE" },
    { id: "learner2", school_id: "school", class_id: "c9", admission_number: "JHS002",
      first_name: "Kojo", last_name: "Second", gender: "M", status: "ACTIVE" },
  ];
  const subjectList = subjects.map((s, i) => ({
    id: s.id, school_id: "school", name: s.name, level: "JHS",
    display_order: i, code: s.code, active: true, is_core: s.isCore,
  }));
  const workspace = {
    school: {
      id: "school", name: "SCHOOL", academic_year: "2026/2027", current_term: 1,
      sba_weight: 50, exam_weight: 50, sba_input_max: 100,
    },
    classes: [{ id: "c9", school_id: "school", name: "Grade 9", level: "JHS" }],
    students: learners, subjects: subjectList, assignments: [],
    scores: learners.flatMap((student, i) => subjects.map((subject, n) => ({
      id: student.id + "-" + subject.id,
      school_id: "school", class_id: "c9", student_id: student.id,
      subject_id: subject.id, term: 1, academic_year: "2026/2027",
      exam_raw: i === 1 && subject.name === "Mathematics" ? 78 : marks[n],
      sba_raw: 45, sba_scaled: 22.5, exam_scaled: 33,
      total: i === 1 && subject.name === "Mathematics" ? 55.5 : marks[n],
    }))),
  } as unknown as Workspace;
  const result = buildClassResultSheet(workspace, "c9");
  const rawGradeNine = reportData(currentSnapshot(workspace, workspace.students[1])).data;
  const mathsGradeNine = rawGradeNine.scores.find((score) => score.subjectId === "s5")!;
  assert.equal(mathsGradeNine.total, 78, "Grade 9 reports use original full exam");
  assert.equal(mathsGradeNine.examScaled, 78);
  assert.equal(mathsGradeNine.sbaScaled, 0);
  assert.deepEqual(result.ranked.map((r) => r.aggregate), [12, 13]);
  assert.deepEqual(result.ranked.map((r) => r.position), [1, 2]);
  const pdf = exportClassResultsPdf(workspace, "c9", "ranking", { download: false }).output();
  assert.ok(pdf.includes("Aggregate"));
  assert.ok(pdf.includes("Agg. Pos."));

  const grade8 = {
    ...workspace,
    classes: [{ ...workspace.classes[0], name: "Grade 8" }],
  } as Workspace;
  const older = buildClassResultSheet(grade8, "c9");
  const oldGradeReport = reportData(currentSnapshot(grade8, grade8.students[1])).data;
  const oldMaths = oldGradeReport.scores.find((score) => score.subjectId === "s5")!;
  assert.equal(oldMaths.total, 55.5, "Other classes preserve their previously stored weighted totals");
  assert.equal(oldMaths.sbaScaled, 22.5);
  assert.ok(older.rows.every((r) => r.aggregate === undefined));
  const olderPdf = exportClassResultsPdf(grade8, "c9", "performance", { download: false }).output();
  assert.ok(!olderPdf.includes("Agg. Pos."));
});

test("Grade 9 reads original examination values and never reuses old weighted SBA totals", () => {
  for (const [raw, expected] of [
    [0, 0], [66, 66], ["78.00", 78], [100, 100], [null, null],
    [undefined, null], ["", null], [101, null], [-1, null],
  ] as const) assert.equal(gradeNineExamScore(raw), expected);

  const legacyWeighted = {
    ...report, scores: [
      { ...scores[0], examRaw: 66, examScaled: 33, sbaScaled: 22.5, total: 55.5 },
      { ...scores[1], examRaw: 78, examScaled: 39, sbaScaled: 28, total: 67 },
    ],
  };
  const pdf = generateReportPDF(legacyWeighted, subjects).output();
  assert.ok(pdf.includes("(66.0)"), "Must print 66/100 rather than weighted 55.5");
  assert.ok(pdf.includes("(78.0)"), "Must print 78/100 rather than weighted 67");
  assert.ok(!pdf.includes("(55.5)"));
  assert.ok(!pdf.includes("(67.0)"));
});

test("Grade 9 next-term date falls back clearly when the school has not announced it", () => {
  const doc = generateReportPDF({
    ...report, school: { ...report.school, nextTermBegins: null },
  }, subjects);
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(doc.output().includes("Not yet announced"));
});
