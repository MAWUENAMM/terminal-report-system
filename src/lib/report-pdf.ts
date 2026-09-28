import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportCardData, Subject } from "@/types";
import { formatName } from "@/lib/utils";
import { getPerformanceRemark } from "@/lib/grading";

const NAVY = [16, 32, 51] as const;
const GREEN = [15, 90, 69] as const;
const GOLD = [207, 164, 60] as const;
const LINE = [218, 224, 228] as const;
const MUTED = [103, 116, 128] as const;

export function generateReportPDF(data: ReportCardData, subjects: Subject[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
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
    promotedTo,
  } = data;

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const orderedScores = [...scores].sort(
    (a, b) =>
      (subjectMap.get(a.subjectId)?.order ?? 999) -
      (subjectMap.get(b.subjectId)?.order ?? 999),
  );

  const roundedRect = (
    x: number,
    top: number,
    width: number,
    height: number,
    fill: readonly number[],
    radius = 3,
  ) => {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(x, top, width, height, radius, radius, "F");
  };

  const outlineRect = (
    x: number,
    top: number,
    width: number,
    height: number,
    radius = 3,
  ) => {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, top, width, height, radius, radius, "S");
  };

  const text = (
    value: string,
    x: number,
    top: number,
    size = 9,
    weight: "normal" | "bold" = "normal",
    color = NAVY,
    options?: Parameters<typeof doc.text>[3],
  ) => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x, top, options);
  };

  const fit = (value: string, maxWidth: number, start: number, min: number) => {
    let size = start;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    while (doc.getTextWidth(value) > maxWidth && size > min) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    return size;
  };

  const addWatermark = () => {
    if (!school.logoUrl?.startsWith("data:image")) return;
    try {
      doc.setGState({ opacity: 0.055 });
      doc.addImage(school.logoUrl, "PNG", pageWidth / 2 - 38, 92, 76, 76);
      doc.setGState({ opacity: 1 });
    } catch {
      doc.setGState({ opacity: 1 });
    }
  };

  const room = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    doc.addPage();
    y = 16;
    addWatermark();
  };

  // Page frame
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(0.7);
  doc.roundedRect(6, 6, pageWidth - 12, pageHeight - 12, 4, 4, "S");
  addWatermark();

  // Branded header
  roundedRect(margin, y, pageWidth - margin * 2, 40, NAVY, 4);
  if (school.logoUrl?.startsWith("data:image")) {
    try {
      doc.addImage(school.logoUrl, "PNG", margin + 4, y + 5, 28, 28);
    } catch {
      /* optional */
    }
  }
  const headerX = school.logoUrl?.startsWith("data:image") ? margin + 37 : margin + 6;
  const schoolName = school.name.toUpperCase();
  text(
    schoolName,
    headerX,
    y + 11,
    fit(schoolName, pageWidth - headerX - margin - 8, 15, 9),
    "bold",
    [255, 255, 255],
  );
  if (school.address) text(school.address, headerX, y + 18, 7.5, "normal", [219, 229, 232]);
  const contact = [school.phone, school.email].filter(Boolean).join("  ·  ");
  if (contact) text(contact, headerX, y + 24, 7.5, "normal", [219, 229, 232]);
  if (school.headteacherName) text(`Headteacher: ${school.headteacherName}`, headerX, y + 30, 7.5, "normal", [219, 229, 232]);

  roundedRect(pageWidth - margin - 48, y + 29, 44, 7, GOLD, 2);
  text("TERMINAL REPORT", pageWidth - margin - 26, y + 34, 6.8, "bold", NAVY, { align: "center" });
  y += 46;

  // Student identity card
  const identityHeight = 48;
  outlineRect(margin, y, pageWidth - margin * 2, identityHeight, 4);
  if (student.photoUrl?.startsWith("data:image")) {
    try {
      doc.addImage(student.photoUrl, "PNG", margin + 4, y + 4, 29, 38);
    } catch {
      /* optional */
    }
  } else {
    roundedRect(margin + 4, y + 4, 29, 38, [241, 245, 246], 3);
    text("LEARNER", margin + 18.5, y + 24, 6.5, "bold", MUTED, { align: "center" });
  }

  text("LEARNER INFORMATION", margin + 39, y + 9, 7, "bold", GREEN);
  const name = formatName(student.firstName, student.lastName, student.otherNames);
  text(name, margin + 39, y + 17, fit(name, 88, 13, 9), "bold", NAVY);

  const info = [
    ["Admission No.", student.admissionNumber],
    ["Class", cls.name],
    ["Gender", student.gender === "M" ? "Male" : "Female"],
    ["Academic Year", school.academicYear],
    ["Term", school.currentTerm === 1 ? "One (1)" : school.currentTerm === 2 ? "Two (2)" : "Three (3)"],
    ["Position", overallPosition ? `${overallPosition} / ${totalStudents}` : "—"],
  ];
  info.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + 39 + col * 64;
    const yy = y + 25 + row * 7;
    text(label, x, yy, 5.7, "normal", MUTED);
    text(value || "—", x, yy + 4, 7.3, "bold", NAVY);
  });
  y += identityHeight + 8;

  // Performance summary
  const summaryWidth = (pageWidth - margin * 2 - 6) / 3;
  [
    ["AVERAGE", overallAverage.toFixed(1) + "%"],
    ["OVERALL GRADE", overallGrade],
    ["POSITION", overallPosition ? `${overallPosition} / ${totalStudents}` : "—"],
  ].forEach(([label, value], index) => {
    const x = margin + index * (summaryWidth + 3);
    roundedRect(x, y, summaryWidth, 22, index === 0 ? [236, 248, 243] : [246, 248, 250], 3);
    text(label, x + 5, y + 8, 5.7, "bold", MUTED);
    text(value, x + 5, y + 16, 11, "bold", index === 0 ? GREEN : NAVY);
  });
  y += 30;

  // Results section
  text("ACADEMIC RESULTS", margin, y, 8, "bold", GREEN);
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(1);
  doc.line(margin, y + 2, margin + 24, y + 2);
  y += 6;

  const tableBody = orderedScores.map((sc) => {
    const total = Number(sc.total);
    return [
      subjectMap.get(sc.subjectId)?.name || sc.subjectId,
      Number(sc.sbaScaled).toFixed(1),
      Number(sc.examScaled).toFixed(1),
      total.toFixed(1),
      sc.grade || "-",
      sc.position?.toString() || "-",
      sc.subjectRemark || getPerformanceRemark(total),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[
      "Subject",
      `SBA ${school.sbaWeight}%`,
      `Exam ${school.examWeight}%`,
      "Total",
      "Grade",
      "Pos.",
      "Remark",
    ]],
    body: tableBody,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      textColor: NAVY,
      cellPadding: 2.6,
      lineColor: LINE,
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
    },
    alternateRowStyles: { fillColor: [249, 251, 251] },
    columnStyles: {
      0: { cellWidth: 51 },
      1: { cellWidth: 19, halign: "center" },
      2: { cellWidth: 19, halign: "center" },
      3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 13, halign: "center" },
      6: { cellWidth: 39 },
    },
    margin: { left: margin, right: margin },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 7;

  // Attendance + affective
  room(46);
  const half = (pageWidth - margin * 2 - 5) / 2;
  const attendanceHeight = 34;
  outlineRect(margin, y, half, attendanceHeight);
  text("ATTENDANCE", margin + 5, y + 8, 7, "bold", GREEN);
  if (attendance) {
    const rate = attendance.totalDays
      ? ((attendance.daysPresent / attendance.totalDays) * 100).toFixed(1)
      : "0.0";
    text(`${attendance.daysPresent} / ${attendance.totalDays} days`, margin + 5, y + 18, 11, "bold", NAVY);
    text(`Attendance rate: ${rate}%`, margin + 5, y + 26, 7, "normal", MUTED);
  } else {
    text("Not recorded", margin + 5, y + 19, 8, "normal", MUTED);
  }

  const rightX = margin + half + 5;
  outlineRect(rightX, y, half, attendanceHeight);
  text("LEARNER DEVELOPMENT", rightX + 5, y + 8, 7, "bold", GREEN);
  const dev = [
    ["Conduct", affective?.conduct],
    ["Interest", affective?.interest],
    ["Attitude", affective?.attitude],
    ["Talents", affective?.talents],
  ];
  dev.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    text(label, rightX + 5 + col * (half / 2 - 2), y + 16 + row * 8, 5.3, "normal", MUTED);
    text(value || "—", rightX + 5 + col * (half / 2 - 2), y + 20 + row * 8, 6.4, "bold", NAVY);
  });
  y += attendanceHeight + 7;

  // Remarks
  room(58);
  text("PROFESSIONAL REMARKS", margin, y, 8, "bold", GREEN);
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.line(margin, y + 2, margin + 31, y + 2);
  y += 6;

  const remarkBox = (title: string, value?: string) => {
    const boxHeight = 24;
    outlineRect(margin, y, pageWidth - margin * 2, boxHeight);
    text(title, margin + 5, y + 8, 6.5, "bold", MUTED);
    const lines = doc.splitTextToSize(value || "No remark recorded.", pageWidth - margin * 2 - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(lines.slice(0, 3), margin + 5, y + 15);
    y += boxHeight + 5;
  };

  remarkBox("CLASS TEACHER'S REMARK", remarks?.classTeacherRemark);
  remarkBox("HEADTEACHER'S REMARK", remarks?.headteacherRemark);

  // Promotion and signatures
  room(45);
  roundedRect(margin, y, pageWidth - margin * 2, 17, [247, 249, 249], 3);
  text("PROMOTED TO", margin + 5, y + 7, 6, "bold", MUTED);
  text(promotedTo || "__________________________________", margin + 5, y + 13, 8, "bold", NAVY);
  y += 25;

  const signatureWidth = (pageWidth - margin * 2 - 12) / 2;
  [
    ["CLASS TEACHER", margin],
    ["HEADTEACHER", margin + signatureWidth + 12],
  ].forEach(([label, x]) => {
    const xx = Number(x);
    doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.setLineWidth(0.35);
    doc.line(xx, y + 12, xx + signatureWidth, y + 12);
    text(String(label), xx, y + 18, 6.5, "bold", MUTED);
    text("Signature & Date", xx, y + 23, 5.8, "normal", MUTED);
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    text(
      `${school.name} · ${school.academicYear} · Term ${school.currentTerm} · Page ${page} of ${pages}`,
      pageWidth / 2,
      pageHeight - 6,
      5.8,
      "normal",
      MUTED,
      { align: "center" },
    );
  }

  return doc;
}
