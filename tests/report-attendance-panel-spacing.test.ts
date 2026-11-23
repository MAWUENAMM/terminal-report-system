import assert from "node:assert/strict";
import test from "node:test";
import { generateReportPDF } from "../src/lib/report-pdf";
import type { ReportCardData, Subject } from "../src/types";

// Regression for correction.pdf: Grade 8 learner ADJEI OBED, nine subjects.
const nineSubjects: Subject[] = [
  "RME", "COMPUTING", "SCIENCE", "ENGLISH LANGUAGE", "SOCIAL STUDIES",
  "CREATIVE ARTS", "MATHEMATICS", "CAREER TECHNOLOGY", "GHANAIAN LANGUAGE",
].map((name, i) => ({ id: `sub-${i}`, name, level: "JHS", order: i, isCore: true }));

function gradeEightData(subjects: Subject[]): ReportCardData {
  return {
    school: {
      id: "ark", name: "THE ARK ACADEMY", academicYear: "2026/2027",
      currentTerm: 1, sbaWeight: 50, examWeight: 50,
      termTotalDays: 62, nextTermBegins: "2027-01-05",
      gradingScale: { id: "default", name: "School", grades: [] },
    },
    student: {
      id: "ARK188", admissionNumber: "ARK188", firstName: "ADJEI",
      lastName: "OBED", gender: "M", classId: "grade8",
      status: "ACTIVE", createdAt: "2026-01-01",
    },
    class: { id: "grade8", name: "GRADE 8", level: "JHS", academicYear: "2026/2027" },
    scores: subjects.map((subject, index) => ({
      id: `s-${index}`, studentId: "ARK188", classId: "grade8",
      subjectId: subject.id, term: 1, academicYear: "2026/2027",
      sbaScaled: 46.7, examScaled: 28, total: 74.7,
      grade: "B", position: 1, subjectRemark: "HIGHER",
    })),
    overallAverage: 76.6, overallGrade: "B", overallPosition: 1, totalStudents: 8,
  };
}

// jsPDF uses PDF points, bottom-origin, and prints each label as a text operator.
function textBaselineY(pdf: string, label: string): number {
  const token = `(${label}) Tj`;
  const i = pdf.indexOf(token);
  assert.ok(i >= 0, `Missing PDF label ${label}`);
  const command = pdf.slice(Math.max(0, i - 200), i);
  const matched = command.match(/([0-9.]+) ([0-9.]+) Td\s*$/);
  assert.ok(matched, `PDF coordinates not found for ${label}`);
  return Number(matched[2]);
}

test("Grade 8 attendance/development panel contains its second row and clears Remarks", () => {
  const doc = generateReportPDF(gradeEightData(nineSubjects), nineSubjects);
  assert.equal(doc.getNumberOfPages(), 1, "Report must remain on exactly one A4 page");
  const pdf = doc.output();
  const attendanceHeading = textBaselineY(pdf, "ATTENDANCE");
  const developmentHeading = textBaselineY(pdf, "LEARNER DEVELOPMENT");
  const conduct = textBaselineY(pdf, "Conduct:");
  const attitude = textBaselineY(pdf, "Attitude:");
  const interest = textBaselineY(pdf, "Interest:");
  const talent = textBaselineY(pdf, "Talent:");
  const remarks = textBaselineY(pdf, "REMARKS");
  assert.ok(Math.abs(attendanceHeading - developmentHeading) < 0.1, "Panels must share their top alignment");
  assert.ok(Math.abs(conduct - interest) < 0.1, "First development row should align");
  assert.ok(Math.abs(attitude - talent) < 0.1, "Second development row should align");
  // Panel has 28 mm height, and its heading baseline is 6.2 mm from the top.
  const panelBottomY = attendanceHeading - (28 - 6.2) * (72 / 25.4);
  assert.ok(attitude > panelBottomY + 10, "Second development row must sit INSIDE panel border");
  assert.ok(remarks < panelBottomY - 10, "Remarks must begin below the entire panel");
  assert.ok(attitude - remarks > 26, "Second row and Remarks need meaningful clearance");
  assert.ok(pdf.includes("Total school days: 62"));
});

test("Eleven-subject A4 report retains the same non-overlapping marked area", () => {
  const eleven = [...nineSubjects,
    { id: "sub-9", name: "PHYSICAL EDUCATION", level: "JHS", order: 9, isCore: true },
    { id: "sub-10", name: "MUSIC", level: "JHS", order: 10, isCore: true },
  ] as Subject[];
  const doc = generateReportPDF(gradeEightData(eleven), eleven);
  assert.equal(doc.getNumberOfPages(), 1);
  const body = doc.output();
  assert.ok(textBaselineY(body, "Attitude:") - textBaselineY(body, "REMARKS") > 26);
});
