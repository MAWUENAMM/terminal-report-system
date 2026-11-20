import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { School, Student } from "./models";
import { fullName } from "./models";
import {
  latestArchivedTerms, summarizeAcademicTerm, termLabel, ordinalPosition,
  type ArchivedAcademicTerm,
} from "./academic-records";

const NAVY: [number, number, number] = [25, 45, 68];
const GREEN: [number, number, number] = [4, 115, 74];
const SLATE: [number, number, number] = [89, 103, 117];
const WHITE: [number, number, number] = [255, 255, 255];
const safeName = (x: string) => x.replace(/[^a-z0-9-_]/gi, "_").slice(0, 70);

export function generateAcademicTranscriptPdf(
  school: School,
  student: Student,
  inputArchives: ArchivedAcademicTerm[],
  reference: string,
  schoolLogoPng?: string | null,
) {
  const archives = latestArchivedTerms(inputArchives);
  if (!archives.length) throw new Error("There are no finalized term reports for this student.");
  if (archives.some((a) => a.student_id !== student.id || a.school_id !== school.id))
    throw new Error("Student and school records do not match the transcript request.");

  const summaries = archives.map(summarizeAcademicTerm);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 0;

  const heading = (firstPage: boolean) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, width, 12, "F");
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(1.1);
    doc.line(margin, 13, margin + 29, 13);
    if (firstPage && schoolLogoPng) {
      try { doc.addImage(schoolLogoPng, "PNG", width - 37, 18, 19, 19); }
      catch { /* Text branding remains available if an old logo fails. */ }
    }
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(firstPage ? 15 : 10);
    doc.text(school.name.toUpperCase(), margin, firstPage ? 25 : 22,
      { maxWidth: width - (firstPage && schoolLogoPng ? 68 : 30) });
    if (firstPage) {
      doc.setFontSize(12);
      doc.setTextColor(...GREEN);
      doc.text("OFFICIAL ACADEMIC TRANSCRIPT", margin, 35);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      doc.setTextColor(...SLATE);
      const address = [school.address, school.district, school.region].filter(Boolean).join(" | ");
      if (address) doc.text(address, margin, 41, { maxWidth: width - 30 });
      const contact = [school.phone, school.email].filter(Boolean).join(" | ");
      if (contact) doc.text(contact, margin, 46, { maxWidth: width - 30 });
    } else {
      doc.setFontSize(8.8);
      doc.setTextColor(...GREEN);
      doc.text("Academic transcript - continued", margin, 29);
    }
  };
  const ensureRoom = (height: number) => {
    if (y + height > pageHeight - 26) { doc.addPage(); y = 45; }
  };
  const label = (a: string, b: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(...SLATE);
    doc.text(a, x, yy);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "normal");
    doc.text(b, x, yy + 5, { maxWidth: 84 });
  };

  heading(true);
  y = 57;
  doc.setFillColor(246, 249, 248);
  doc.roundedRect(margin, y - 4, width - 2 * margin, 37, 2, 2, "F");
  label("LEARNER NAME", fullName(student), margin + 5, y + 3);
  label("ADMISSION NUMBER", student.admission_number, width / 2 + 6, y + 3);
  label("GENDER", student.gender === "M" ? "Male" : "Female", margin + 5, y + 20);
  label("STATUS", student.status === "GRADUATED" ? "Graduated" :
    student.status === "TRANSFERRED" ? "Transferred" :
    student.status === "WITHDRAWN" ? "Withdrawn" : "Currently enrolled", width / 2 + 6, y + 20);
  y += 45;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  doc.setFontSize(8.2);
  doc.text(`Academic period: ${archives[0].academic_year} to ${archives[archives.length - 1].academic_year}  |  Finalized terms: ${archives.length}`, margin, y);
  y += 6;
  doc.text(`Transcript reference: ${reference}`, margin, y, { maxWidth: width - 2 * margin });
  y += 5;
  doc.text(`Date issued: ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`, margin, y);
  y += 12;

  for (const result of summaries) {
    ensureRoom(43);
    doc.setFillColor(...GREEN);
    doc.roundedRect(margin, y, width - margin * 2, 10, 1.7, 1.7, "F");
    doc.setFontSize(9.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text(`${result.academicYear}  |  ${termLabel(result.term)}  |  ${result.className}`, margin + 3.4, y + 6.7);
    y += 13;
    const body = result.subjects.length ? result.subjects.map((row, i) => [
      String(i + 1), row.name, row.score.toFixed(1), row.grade,
    ]) : [["—", "No subject marks recorded for this term", "—", "—"]];
    autoTable(doc, {
      startY: y,
      head: [["No.", "Subject", "Mark / 100", "Grade"]],
      body,
      margin: { left: margin, right: margin, top: 45, bottom: 26 },
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.2, cellPadding: 2.2 },
      headStyles: { fillColor: NAVY, textColor: WHITE },
      alternateRowStyles: { fillColor: [247, 249, 249] },
      columnStyles: {
        0: { cellWidth: 13 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 20, halign: "center" },
      },
    });
    const table = doc as typeof doc & { lastAutoTable?: { finalY: number } };
    y = (table.lastAutoTable?.finalY ?? y + 18) + 6;
    ensureRoom(12);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    const summary = [
      `Total: ${result.total?.toFixed(1) ?? "—"}`,
      `Average: ${result.average?.toFixed(1) ?? "—"}%`,
      `Grade: ${result.grade}`,
      `Position: ${ordinalPosition(result.position)}`,
    ].join("   |   ");
    doc.text(summary, margin + 2, y);
    y += 5;
    doc.setFontSize(7.7);
    doc.setTextColor(...SLATE);
    const attendance = result.attendance
      ? `Attendance: ${result.attendance.daysPresent} / ${result.attendance.totalDays} days`
      : "Attendance: not recorded";
    doc.text(attendance, margin + 2, y);
    y += 14;
  }

  ensureRoom(49);
  doc.setDrawColor(218, 224, 228);
  doc.line(margin, y - 1, width - margin, y - 1);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text("AUTHENTICATION & RECORD NOTES", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  for (const note of [
    "This document is generated from finalized, archived academic-term records.",
    "Missing terms or subjects are not estimated. Each displayed mark comes from a school record.",
    "For verification, contact the issuing school and quote the transcript reference.",
    "A school official must sign/stamp the printed copy if physical authentication is required.",
  ]) { doc.text(note, margin, y, { maxWidth: width - 2 * margin }); y += 4.8; }
  y += 9;
  ensureRoom(19);
  doc.setDrawColor(...NAVY);
  doc.line(margin, y, margin + 72, y);
  doc.line(width - margin - 60, y, width - margin, y);
  doc.setFontSize(7.6);
  doc.text("Authorized school official / signature", margin, y + 5);
  doc.text("School stamp / date", width - margin - 60, y + 5);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    if (page !== 1) heading(false);
    doc.setDrawColor(218, 225, 231);
    doc.line(margin, pageHeight - 15, width - margin, pageHeight - 15);
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.text("EduReport | Issued from archived school academic records", margin, pageHeight - 9.5);
    doc.text(`Page ${page} / ${pages}`, width - margin, pageHeight - 9.5, { align: "right" });
  }
  doc.save(`${safeName(school.name)}_${safeName(student.admission_number)}_Academic_Transcript.pdf`);
}
