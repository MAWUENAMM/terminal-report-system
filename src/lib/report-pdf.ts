import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportCardData, Subject } from "@/types";
import { formatName } from "@/lib/utils";
import { getPerformanceRemark } from "@/lib/grading";

type RGB = [number, number, number];

const NAVY: RGB = [24, 45, 72];
const GREEN: RGB = [0, 107, 63];
const GOLD: RGB = [219, 172, 34];
const RED: RGB = [190, 52, 52];
const LINE: RGB = [192, 202, 209];
const PALE: RGB = [247, 249, 248];
const MUTED: RGB = [91, 105, 116];
const WHITE: RGB = [255, 255, 255];

export function generateReportPDF(data: ReportCardData, subjects: Subject[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 9;
  const contentWidth = pageWidth - margin * 2;
  let y = 10;

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

  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const orderedScores = [...scores].sort(
    (a, b) =>
      (subjectMap.get(a.subjectId)?.order ?? 999) -
      (subjectMap.get(b.subjectId)?.order ?? 999),
  );
  const schoolName = school.name.toUpperCase();
  const learnerName = formatName(student.firstName, student.lastName, student.otherNames);
  const termText =
    school.currentTerm === 1
      ? "One (1)"
      : school.currentTerm === 2
        ? "Two (2)"
        : "Three (3)";

  const setStroke = (color: RGB = LINE, width = 0.35) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(width);
  };

  const fillRect = (
    x: number,
    top: number,
    width: number,
    height: number,
    fill: RGB,
    radius = 2,
  ) => {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(x, top, width, height, radius, radius, "F");
  };

  const outlineRect = (
    x: number,
    top: number,
    width: number,
    height: number,
    color: RGB = LINE,
    radius = 2,
  ) => {
    setStroke(color);
    doc.roundedRect(x, top, width, height, radius, radius, "S");
  };

  const text = (
    value: string,
    x: number,
    top: number,
    size = 8,
    weight: "normal" | "bold" = "normal",
    color: RGB = NAVY,
    options?: Record<string, unknown>,
  ) => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x, top, options as any);
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
      doc.setGState({ opacity: 0.035 });
      doc.addImage(school.logoUrl, "PNG", pageWidth / 2 - 48, 92, 96, 96);
      doc.setGState({ opacity: 1 });
    } catch {
      doc.setGState({ opacity: 1 });
    }
  };

  const drawPageFrame = () => {
    setStroke(NAVY, 0.55);
    doc.roundedRect(5.5, 5.5, pageWidth - 11, pageHeight - 11, 2.5, 2.5, "S");
    setStroke(GREEN, 0.35);
    doc.roundedRect(7.2, 7.2, pageWidth - 14.4, pageHeight - 14.4, 2, 2, "S");
  };

  const room = (height: number) => {
    if (y + height <= pageHeight - 17) return;
    doc.addPage();
    y = 12;
    drawPageFrame();
    addWatermark();
  };

  const labelValue = (
    label: string,
    value: string,
    x: number,
    top: number,
    width: number,
  ) => {
    text(label.toUpperCase(), x, top, 5.2, "bold", MUTED);
    const display = value || "—";
    text(display, x, top + 4.2, fit(display, width, 7.4, 5.8), "bold", NAVY);
  };

  drawPageFrame();
  addWatermark();

  // Institutional header inspired by Ghanaian school report cards, but kept modern and compact.
  outlineRect(margin, y, contentWidth, 31, NAVY, 2.5);
  if (school.logoUrl?.startsWith("data:image")) {
    try {
      doc.addImage(school.logoUrl, "PNG", margin + 4, y + 4, 23, 23);
    } catch {
      /* optional school logo */
    }
  } else {
    fillRect(margin + 4, y + 4, 23, 23, PALE, 2);
    text("SCHOOL", margin + 15.5, y + 17, 5.5, "bold", MUTED, { align: "center" });
  }

  if (student.photoUrl?.startsWith("data:image")) {
    try {
      doc.addImage(student.photoUrl, "PNG", pageWidth - margin - 23, y + 3, 19, 25);
    } catch {
      /* optional learner photo */
    }
  } else {
    outlineRect(pageWidth - margin - 23, y + 3, 19, 25, LINE, 1.5);
    text("PHOTO", pageWidth - margin - 13.5, y + 17, 5.2, "bold", MUTED, { align: "center" });
  }

  const headerCenter = pageWidth / 2;
  const headerTextWidth = contentWidth - 62;
  text(
    schoolName,
    headerCenter,
    y + 9,
    fit(schoolName, headerTextWidth, 15, 9.2),
    "bold",
    GREEN,
    { align: "center" },
  );
  const location = [school.address, school.district, school.region]
    .filter(Boolean)
    .join(" · ");
  if (location)
    text(location, headerCenter, y + 15.5, 6.4, "normal", NAVY, { align: "center" });
  const contact = [school.phone, school.email].filter(Boolean).join("  ·  ");
  if (contact)
    text(contact, headerCenter, y + 21, 6.2, "normal", MUTED, { align: "center" });
  if (school.headteacherName)
    text(
      `Headteacher: ${school.headteacherName}`,
      headerCenter,
      y + 26,
      5.7,
      "normal",
      MUTED,
      { align: "center" },
    );
  y += 34;

  fillRect(margin + 40, y, contentWidth - 80, 9, PALE, 1.5);
  outlineRect(margin + 40, y, contentWidth - 80, 9, NAVY, 1.5);
  text("TERMINAL REPORT CARD", pageWidth / 2, y + 6.1, 9.2, "bold", NAVY, {
    align: "center",
  });
  y += 12;

  // Compact learner information block.
  outlineRect(margin, y, contentWidth, 29, NAVY, 2.5);
  const left = margin + 5;
  const middle = margin + 78;
  const right = margin + 137;
  labelValue("Name", learnerName, left, y + 6, 66);
  labelValue("Class", cls.name, middle, y + 6, 51);
  labelValue("Gender", student.gender === "M" ? "Male" : "Female", right, y + 6, 45);
  labelValue("Admission no.", student.admissionNumber, left, y + 17, 66);
  labelValue("Term", termText, middle, y + 17, 51);
  labelValue("Academic year", school.academicYear, right, y + 17, 45);
  y += 32;

  const summaryGap = 3;
  const summaryWidth = (contentWidth - summaryGap * 3) / 4;
  const summary = [
    ["AVERAGE", scores.length ? `${overallAverage.toFixed(1)}%` : "—"],
    ["GRADE", scores.length ? overallGrade : "—"],
    ["POSITION", overallPosition ? `${overallPosition} / ${totalStudents}` : "—"],
    ["NO. ON ROLL", String(totalStudents)],
  ];
  summary.forEach(([label, value], index) => {
    const x = margin + index * (summaryWidth + summaryGap);
    fillRect(x, y, summaryWidth, 13, index === 0 ? [237, 248, 243] : PALE, 1.8);
    text(label, x + 3.5, y + 4.7, 4.8, "bold", MUTED);
    text(value, x + 3.5, y + 10, 8.4, "bold", index === 0 ? GREEN : NAVY);
  });
  y += 17;

  text("ACADEMIC PERFORMANCE", margin, y, 7.2, "bold", GREEN);
  setStroke(GOLD, 0.9);
  doc.line(margin, y + 2, margin + 28, y + 2);
  y += 4.5;

  const tableBody = orderedScores.map((score) => {
    const total = Number(score.total);
    return [
      subjectMap.get(score.subjectId)?.name || score.subjectId,
      Number(score.sbaScaled).toFixed(1),
      Number(score.examScaled).toFixed(1),
      total.toFixed(1),
      score.grade || "-",
      score.position?.toString() || "-",
      score.subjectRemark || getPerformanceRemark(total),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[
      "SUBJECT",
      `SBA ${school.sbaWeight}%`,
      `EXAM ${school.examWeight}%`,
      "TOTAL",
      "GRADE",
      "POS.",
      "REMARK",
    ]],
    body: tableBody,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.2,
      textColor: NAVY,
      cellPadding: 1.25,
      lineColor: LINE,
      lineWidth: 0.25,
      valign: "middle",
    },
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 6,
      halign: "center",
      cellPadding: 1.5,
    },
    alternateRowStyles: { fillColor: [250, 251, 250] },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 18, halign: "center", fontStyle: "bold", textColor: RED },
      4: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 53 },
    },
    margin: { left: margin, right: margin },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 4;

  room(24);
  const half = (contentWidth - 4) / 2;
  const infoHeight = 20;
  outlineRect(margin, y, half, infoHeight, LINE, 2);
  text("ATTENDANCE", margin + 4, y + 5.5, 5.5, "bold", GREEN);
  if (attendance) {
    const rate = attendance.totalDays
      ? ((attendance.daysPresent / attendance.totalDays) * 100).toFixed(1)
      : "0.0";
    text(`${attendance.daysPresent} / ${attendance.totalDays} days`, margin + 4, y + 12, 8.6, "bold", NAVY);
    text(`${rate}% attendance`, margin + 4, y + 17, 5.6, "normal", MUTED);
  } else {
    text("Not recorded", margin + 4, y + 13, 7, "normal", MUTED);
  }

  const developmentX = margin + half + 4;
  outlineRect(developmentX, y, half, infoHeight, LINE, 2);
  text("LEARNER DEVELOPMENT", developmentX + 4, y + 5.5, 5.5, "bold", GREEN);
  const development: Array<[string, string | undefined]> = [
    ["Conduct", affective?.conduct],
    ["Interest", affective?.interest],
    ["Attitude", affective?.attitude],
    ["Talent", affective?.talents],
  ];
  development.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = developmentX + 4 + col * (half / 2 - 1);
    const top = y + 11 + row * 6;
    text(`${label}:`, x, top, 4.8, "bold", MUTED);
    const display = value || "—";
    text(display, x + 14, top, fit(display, half / 2 - 18, 5.7, 4.6), "normal", NAVY);
  });
  y += infoHeight + 4;

  room(39);
  text("REMARKS", margin, y, 6.8, "bold", GREEN);
  setStroke(GOLD, 0.8);
  doc.line(margin, y + 2, margin + 18, y + 2);
  y += 4.5;

  const remarkRow = (label: string, value?: string) => {
    const h = 13;
    outlineRect(margin, y, contentWidth, h, LINE, 1.5);
    text(label, margin + 4, y + 4.7, 4.9, "bold", MUTED);
    const lines = doc.splitTextToSize(value || "No remark recorded.", contentWidth - 45);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(lines.slice(0, 2), margin + 40, y + 4.8);
    y += h + 2;
  };

  remarkRow("CLASS TEACHER", remarks?.classTeacherRemark);
  remarkRow("HEADTEACHER", remarks?.headteacherRemark);

  room(31);
  fillRect(margin, y, contentWidth, 10, PALE, 1.5);
  text("PROMOTED TO", margin + 4, y + 4.2, 4.8, "bold", MUTED);
  text(promotedTo || "____________________________", margin + 4, y + 8.1, 6.5, "bold", NAVY);
  text("RESULT SUMMARY", pageWidth - margin - 49, y + 4.2, 4.8, "bold", MUTED);
  text(
    scores.length ? `${overallAverage.toFixed(1)}% · ${overallGrade}` : "No scores",
    pageWidth - margin - 49,
    y + 8.1,
    6.5,
    "bold",
    NAVY,
  );
  y += 15;

  const signatureWidth = (contentWidth - 14) / 2;
  [
    ["CLASS TEACHER'S SIGNATURE", margin],
    ["HEADTEACHER'S SIGNATURE", margin + signatureWidth + 14],
  ].forEach(([label, x]) => {
    const xx = Number(x);
    setStroke(NAVY, 0.35);
    doc.line(xx, y + 8, xx + signatureWidth, y + 8);
    text(String(label), xx, y + 13, 5.1, "bold", MUTED);
    text("Signature & date", xx, y + 17, 4.8, "normal", MUTED);
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    if (page > 1) drawPageFrame();
    setStroke(LINE, 0.25);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    text(
      `${school.name} · ${school.academicYear} · Term ${school.currentTerm} · Page ${page} of ${pages}`,
      pageWidth / 2,
      pageHeight - 6.5,
      5.2,
      "normal",
      MUTED,
      { align: "center" },
    );
  }

  return doc;
}
