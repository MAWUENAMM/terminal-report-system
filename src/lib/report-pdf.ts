import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportCardData, Subject } from "@/types";
import { formatName } from "@/lib/utils";

export function generateReportPDF(data: ReportCardData, subjects: Subject[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 12;

  const {
    student,
    school,
    class: cls,
    scores,
    attendance,
    affective,
    remarks,
    overallAverage,
    overallGrade,
    overallPosition,
    totalStudents,
  } = data;

  // Header bar
  doc.setFillColor(16, 24, 40);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  while (
    doc.getTextWidth(school.name.toUpperCase()) > pageWidth - margin * 2 &&
    doc.getFontSize() > 8
  )
    doc.setFontSize(doc.getFontSize() - 1);
  doc.text(school.name.toUpperCase(), pageWidth / 2, 10, {
    align: "center",
    maxWidth: pageWidth - margin * 2,
  });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (school.address) {
    doc.text(school.address, pageWidth / 2, 16, { align: "center" });
  }

  // Gold badge for TERMINAL REPORT
  doc.setFillColor(252, 209, 22);
  doc.roundedRect(pageWidth / 2 - 27, 18, 54, 8, 2, 2, "F");
  doc.setTextColor(16, 24, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TERMINAL REPORT", pageWidth / 2, 23.5, { align: "center" });

  // Green accent line
  doc.setDrawColor(0, 107, 63);
  doc.setLineWidth(1.2);
  doc.line(margin, 29, pageWidth - margin, 29);

  y = 34;
  doc.setTextColor(30, 30, 30);

  // Student info block
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const leftX = margin;
  const midX = pageWidth / 2;

  doc.text(
    "Name: " +
      formatName(student.firstName, student.lastName, student.otherNames),
    leftX,
    y,
  );
  doc.text("Class: " + cls.name, midX, y);
  y += 5;
  doc.text("Admission No: " + student.admissionNumber, leftX, y);
  doc.text("Gender: " + (student.gender === "M" ? "Male" : "Female"), midX, y);
  y += 5;
  doc.text("Academic Year: " + school.academicYear, leftX, y);
  doc.text("Term: " + school.currentTerm, midX, y);
  y += 5;
  doc.text("On Roll: " + totalStudents, leftX, y);
  if (overallPosition) {
    doc.text("Position: " + overallPosition, midX, y);
  }
  y += 8;

  // Photo if available
  if (student.photoUrl && student.photoUrl.startsWith("data:image")) {
    try {
      doc.addImage(
        student.photoUrl,
        "JPEG",
        pageWidth - margin - 22,
        34,
        20,
        22,
      );
    } catch {
      /* ignore invalid images */
    }
  }

  // Scores table
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const tableBody = [...scores]
    .sort(
      (a, b) =>
        (subjectMap.get(a.subjectId)?.order ?? 99) -
        (subjectMap.get(b.subjectId)?.order ?? 99),
    )
    .map((sc) => [
      subjectMap.get(sc.subjectId)?.name || sc.subjectId,
      sc.sbaScaled.toFixed(1),
      sc.examScaled.toFixed(1),
      sc.total.toFixed(1),
      sc.grade,
      sc.position?.toString() || "-",
      sc.subjectRemark || "",
    ]);

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Subject",
        `SBA (${school.sbaWeight})`,
        `Exam (${school.examWeight})`,
        "Total",
        "Grade",
        "Pos.",
        "Remarks",
      ],
    ],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [16, 24, 40],
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 54 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 40 },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  function room(height: number) {
    if (y + height > 278) {
      doc.addPage();
      y = 20;
    }
  }
  function paragraph(text: string, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines: string[] = doc.splitTextToSize(text, pageWidth - margin * 2);
    for (const line of lines) {
      room(6);
      doc.text(line, leftX, y);
      y += 4.5;
    }
    y += 2;
  }
  doc.setFontSize(9);
  doc.setTextColor(16, 24, 40);
  paragraph(
    "Overall Average: " +
      overallAverage.toFixed(1) +
      "%    |    Overall Grade: " +
      overallGrade,
    true,
  );
  if (attendance)
    paragraph(
      "Attendance: " +
        attendance.daysPresent +
        " out of " +
        attendance.totalDays +
        " days",
    );
  if (affective) {
    room(12);
    paragraph("Conduct & Attitude", true);
    for (const [label, text] of [
      ["Conduct", affective.conduct],
      ["Interest", affective.interest],
      ["Attitude", affective.attitude],
      ["Talents", affective.talents],
    ])
      if (text) paragraph(label + ": " + text);
  }
  if (remarks?.classTeacherRemark) {
    room(12);
    paragraph("Class Teacher's Remarks:", true);
    paragraph(remarks.classTeacherRemark);
  }
  if (remarks?.headteacherRemark) {
    room(12);
    paragraph("Headteacher's Remarks:", true);
    paragraph(remarks.headteacherRemark);
  }
  y += 6;
  room(20);
  // Signature lines
  y = Math.max(y, 250);
  doc.setFontSize(8);
  doc.line(leftX, y, leftX + 50, y);
  doc.line(midX, y, midX + 50, y);
  y += 4;
  doc.text("Class Teacher", leftX, y);
  doc.text("Headteacher", midX, y);
  y += 4;
  doc.text("Signature & Date", leftX, y);
  doc.text("Signature & Date", midX, y);

  // Repeat a compact footer on every page, including long reports.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      "Generated on " +
        new Date().toLocaleDateString("en-GB") +
        " | Computer-generated report | Page " +
        page +
        " of " +
        pages,
      pageWidth / 2,
      290,
      { align: "center" },
    );
  }
  return doc;
}
