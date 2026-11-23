import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Student, Workspace } from "./models";
import { fullName } from "./models";
import { buildClassResultSheet, ordinal } from "./class-sheets";

type PDF = InstanceType<typeof jsPDF>;
type SheetKind = "performance" | "ranking";
const NAVY: [number, number, number] = [26, 48, 71];
const GREEN: [number, number, number] = [14, 101, 76];
const GRAY: [number, number, number] = [93, 106, 118];

const cleanFile = (v: string) => v.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
const n1 = (n: number | null) => n === null ? "-" : n.toFixed(1);
const genderName = (g: Student["gender"]) => g === "M" ? "Male" : "Female";

function printHeader(
  doc: PDF, schoolName: string, title: string, subtitle: string,
): void {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, width, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(16);
  doc.text(schoolName.toUpperCase(), 13, 21, { maxWidth: width - 26 });
  doc.setFontSize(11);
  doc.setTextColor(...GREEN);
  doc.text(title, 13, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(subtitle, 13, 34, { maxWidth: width - 26 });
  doc.setDrawColor(215, 225, 221);
  doc.line(13, 37, width - 13, 37);
}

function footers(doc: PDF, caption: string): void {
  const pages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = doc.internal.pageSize.getWidth();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(220, 224, 229);
    doc.line(13, pageHeight - 13, width - 13, pageHeight - 13);
    doc.setFontSize(7.2);
    doc.setTextColor(...GRAY);
    doc.text(caption, 13, pageHeight - 8);
    doc.text(`Page ${page} of ${pages}`, width - 13, pageHeight - 8, { align: "right" });
  }
}

function tableTheme(fontSize = 8) {
  return {
    theme: "striped" as const,
    startY: 42,
    margin: { left: 13, right: 13, top: 42, bottom: 20 },
    styles: { font: "helvetica", fontSize, cellPadding: 2.7, textColor: NAVY, lineColor: [227, 233, 236] as [number,number,number], lineWidth: 0.08 },
    headStyles: { fillColor: NAVY, textColor: [255,255,255] as [number,number,number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [245, 249, 247] as [number,number,number] },
    didDrawPage: () => { /* Header is drawn after the full table on every page. */ },
  };
}

/** Reference layouts: attached "position performace.pdf" and "new postion rank.pdf". */
export function exportClassResultsPdf(
  w: Workspace,
  classId: string,
  kind: SheetKind,
  options: { download?: boolean } = {},
): PDF {
  const sheet = buildClassResultSheet(w, classId);
  if (!sheet.rows.length) throw new Error("This class has no active learners to print.");
  const wide = kind === "ranking";
  const doc = new jsPDF({
    orientation: wide ? "landscape" : "portrait",
    unit: "mm",
    format: wide && sheet.subjects.length > 6 ? "a3" : "a4",
  });
  const subtitle = `${sheet.classGroup.name} | ${w.school.academic_year} | Term ${w.school.current_term} | ${sheet.rows.length} learners`;
  const heading = kind === "performance" ? "CLASS PERFORMANCE SHEET" : "CLASS RANK POSITIONS & SUBJECT MARKS";
  const records = kind === "performance" ? sheet.rows : sheet.ranked;

  if (kind === "performance") {
    autoTable(doc, {
      ...tableTheme(9),
      head: [["No.", "Full name", "Gender", "Total", "Average", "Position", "Subjects"]],
      body: records.map((row, i) => [
        String(i + 1),
        fullName(row.student),
        genderName(row.student.gender),
        n1(row.total), n1(row.average), ordinal(row.position),
        `${row.subjectCount}/${row.expectedCount}`,
      ]),
      columnStyles: {
        0: { cellWidth: 13 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 20 },
        3: { cellWidth: 22, halign: "right" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 23, halign: "center" },
        6: { cellWidth: 19, halign: "center" },
      },
    });
  } else {
    // A3 landscape for wide class sheets keeps every subject visible and legible.
    // Missing marks appear as "-", never as zero; a genuine score of zero stays "0.0".
    // Never use subject codes here: some schools store numeric codes (1, 2, 3).
    // The school needs the full subject name visible on the printed rank sheet.
    const subjectHeads = sheet.subjects.map((s) => s.name.trim().toUpperCase());
    const headingRow = ["No.", "Full name", ...subjectHeads, "Total", "Avg.", "Position"];
    const tableRows = records.map((row, i) => [
      String(i + 1), fullName(row.student),
      ...sheet.subjects.map((s) => row.bySubject.has(s.id) ? n1(row.bySubject.get(s.id)!) : "-"),
      n1(row.total), n1(row.average), ordinal(row.position),
    ]);
    const fontSize = sheet.subjects.length > 11 ? 6.7 : sheet.subjects.length > 7 ? 7.1 : 8;
    const fullWidth = doc.internal.pageSize.getWidth() - 26;
    const nameWidth = sheet.subjects.length > 6 ? 66 : 61;
    const reservedWidth = 11 + nameWidth + 20 + 18 + 19;
    const perSubject = (fullWidth - reservedWidth) / Math.max(1, sheet.subjects.length);
    if (perSubject < 14) throw new Error("Too many subjects for a legible ranking sheet.");
    const subjectColumnWidths = Object.fromEntries(
      sheet.subjects.map((_, index) => [index + 2, { cellWidth: perSubject, halign: "center" as const }]),
    );
    autoTable(doc, {
      ...tableTheme(fontSize),
      head: [headingRow],
      body: tableRows,
      columnStyles: {
        0: { cellWidth: 11 },
        1: { cellWidth: nameWidth },
        ...subjectColumnWidths,
        [sheet.subjects.length + 2]: { cellWidth: 20, halign: "right" },
        [sheet.subjects.length + 3]: { cellWidth: 18, halign: "right" },
        [sheet.subjects.length + 4]: { cellWidth: 19, halign: "center" },
      },
      headStyles: {
        ...tableTheme(fontSize).headStyles,
        fontSize: Math.min(7.5, fontSize),
        minCellHeight: 12,
        overflow: "linebreak",
        valign: "middle",
      },
      styles: { ...tableTheme(fontSize).styles, cellPadding: 1.7, overflow: "linebreak" },
    });
  }

  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    printHeader(doc, w.school.name, heading, subtitle);
  }
  footers(doc, "Calculated from recorded current-term marks. Equal averages share a position; missing marks are not zero.");
  if (options.download !== false)
    doc.save(`${cleanFile(w.school.name)}_${cleanFile(sheet.classGroup.name)}_Term${w.school.current_term}_${kind}.pdf`);
  return doc;
}

export function exportClassListPdf(
  w: Workspace,
  students: Student[],
  label: string,
  filterDescription = "Active learners",
): void {
  const active = students.filter((s) => s.school_id === w.school.id && s.status === "ACTIVE");
  if (!active.length) throw new Error("No active learners match the selected class and filters.");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  autoTable(doc, {
    ...tableTheme(9),
    head: [["No.", "Student name", "Admission no.", "Class", "Gender"]],
    body: active.map((student, i) => [
      String(i + 1), fullName(student), student.admission_number,
      w.classes.find((c) => c.id === student.class_id)?.name || "-",
      genderName(student.gender),
    ]),
    columnStyles: {
      0: { cellWidth: 13 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 35 },
      3: { cellWidth: 25 },
      4: { cellWidth: 21 },
    },
  });
  const title = "CLASS LIST";
  const subtitle = `${label} | ${w.school.academic_year} | ${filterDescription} | ${active.length} learners`;
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    printHeader(doc, w.school.name, title, subtitle);
  }
  footers(doc, "School enrolment list | Active learners only");
  doc.save(`${cleanFile(w.school.name)}_${cleanFile(label)}_class_list.pdf`);
}
