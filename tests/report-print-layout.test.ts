import test from "node:test";
import assert from "node:assert/strict";
import { generateReportPDF } from "../src/lib/report-pdf";
import type { ReportCardData, Subject } from "../src/types";

const school: ReportCardData["school"] = {
  id: "school", name: "The Ark Academy", academicYear: "2026/2027",
  currentTerm: 1, sbaWeight: 50, examWeight: 50,
  nextTermBegins: "2027-01-11",
  gradingScale: { id: "basic", name: "School scale", grades: [] },
};

const student: ReportCardData["student"] = {
  id: "s1", firstName: "Ama", lastName: "Boadu", admissionNumber: "ARK001",
  gender: "F", classId: "basic5", status: "ACTIVE", createdAt: "2026-01-01",
};

test("A4 terminal report prints next-term reopening date and total marks", () => {
  const data: ReportCardData = {
    school, student,
    class: { id: "basic5", name: "Basic 5", level: "PRIMARY", academicYear: "2026/2027" },
    scores: [{
      id: "math", studentId: "s1", classId: "basic5", subjectId: "math",
      term: 1, academicYear: "2026/2027", sbaScaled: 40, examScaled: 35,
      total: 75, grade: "B", position: 1,
    }],
    overallAverage: 75, overallGrade: "B", overallPosition: 1,
    totalStudents: 24, promotedTo: "Basic 6",
  };
  const subjects: Subject[] = [{
    id: "math", name: "Mathematics", level: "PRIMARY", isCore: true, order: 1,
  }];
  const doc = generateReportPDF(data, subjects);
  const body = doc.output();
  assert.ok(body.startsWith("%PDF-"));
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 210) < 0.1);
  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(body.includes("NEXT TERM BEGINS"), "PDF must show next-term date field");
  assert.ok(body.includes("11 January 2027"), "PDF must show configured school reopening date");
  assert.ok(body.includes("TOTAL MARKS"), "PDF must show total marks");
  assert.ok(body.includes("75.0 / 100"), "PDF total should be out of all subject marks");
});

test("Missing next-term date prints a safe unannounced label", () => {
  const data: ReportCardData = {
    school: { ...school, nextTermBegins: null },
    student,
    class: { id: "basic5", name: "Basic 5", level: "PRIMARY", academicYear: "2026/2027" },
    scores: [], overallAverage: 0, overallGrade: "—", totalStudents: 24,
  };
  const body = generateReportPDF(data, []).output();
  assert.ok(body.includes("Not yet announced"));
  assert.ok(body.includes("No scores recorded"));
});
