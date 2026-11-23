import { GState, jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportCardData, Subject } from "@/types";
import { formatName } from "@/lib/utils";
import { computeGradeNineMock, gradeNineExamScore, MANDATORY_CORE, SCHOOL_MOCK_BANDS } from "./grade9-mock";

/**
 * Grade 9 ONLY: printable, single-A4-page school mock report in the format
 * of the supplied JHS3 example. The A-E 1-5 bands belong to the SCHOOL MOCK
 * example, NOT to official WAEC Stanine grades. Aggregate selection follows
 * GES four mandatory core plus best two other subjects.
 *
 * This separate renderer leaves every other class's existing PDF unchanged.
 */
export function generateGradeNineMockPDF(
  data: ReportCardData,
  subjects: Subject[],
  existingDoc?: jsPDF,
): jsPDF {
  const doc = existingDoc ?? new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (existingDoc) doc.addPage();
  const targetPage = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 10;
  const blue: [number, number, number] = [28, 103, 184];
  const navy: [number, number, number] = [28, 53, 83];
  const pale: [number, number, number] = [232, 242, 253];
  const line: [number, number, number] = [193, 206, 219];
  const gray: [number, number, number] = [98, 112, 127];
  const white: [number, number, number] = [255, 255, 255];
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const ordered = [...data.scores].filter(s => gradeNineExamScore(s.examRaw) !== null).sort((a, b) =>
    (subjectMap.get(a.subjectId)?.order ?? 999) -
    (subjectMap.get(b.subjectId)?.order ?? 999),
  );
  const mock = computeGradeNineMock(ordered.map((s) => ({
    subjectId: s.subjectId,
    name: subjectMap.get(s.subjectId)?.name ?? s.subjectId,
    score: gradeNineExamScore(s.examRaw)!,
    position: s.position,
  })));
  const mockById = new Map(mock.rows.map((r) => [r.subjectId, r]));
  const setColor = (color: [number, number, number]) => {
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const fill = (color: [number, number, number]) => {
    doc.setFillColor(color[0], color[1], color[2]);
  };
  const stroke = (color: [number, number, number]) => {
    doc.setDrawColor(color[0], color[1], color[2]);
  };
  const print = (
    value: string, x: number, y: number, size = 8,
    bold = false, color: [number, number, number] = navy,
    opts?: Record<string, unknown>,
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    setColor(color);
    doc.text(value, x, y, opts as any);
  };
  const fitSize = (value: string, maxWidth: number, start = 12, min = 7) => {
    let s = start;
    doc.setFont("helvetica", "bold");
    while (s > min) {
      doc.setFontSize(s);
      if (doc.getTextWidth(value) <= maxWidth) break;
      s -= 0.4;
    }
    return s;
  };
  const panel = (x: number, y: number, w: number, h: number) => {
    stroke(line);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
  };
  const bar = (title: string, y: number, h = 8) => {
    fill(blue);
    doc.rect(m, y, W - 2 * m, h, "F");
    print(title, m + 4, y + h / 2 + 2.2, 8.7, true, white);
  };
  const field = (label: string, value: string, x: number, y: number, maxWidth: number) => {
    print(label, x, y, 6.2, true, gray);
    print(value || "—", x, y + 4.4, fitSize(value || "—", maxWidth, 8.5, 6.7), true);
  };
  stroke(blue);
  doc.setLineWidth(0.65);
  doc.rect(5, 5, W - 10, H - 10);

  // School heading retains the real stored logo and the learner photograph.
  panel(m, 10, W - 2 * m, 34);
  if (data.school.logoUrl?.startsWith("data:image")) {
    try { doc.addImage(data.school.logoUrl, "PNG", m + 4, 13, 27, 27); }
    catch { /* School name remains the authoritative identifier. */ }
  }
  if (data.student.photoUrl?.startsWith("data:image")) {
    try { doc.addImage(data.student.photoUrl, "PNG", W - m - 24, 12, 21, 28); }
    catch { /* Some historical profiles lack a readable image. */ }
  }
  const heading = data.school.name.toUpperCase();
  print(heading, W / 2, 18, fitSize(heading, W - 108, 13, 8), true, blue, { align: "center" });
  const address = [data.school.address, data.school.district, data.school.region].filter(Boolean).join(" · ");
  if (address) print(address, W / 2, 23, fitSize(address, W - 108, 7, 5.6), false, gray, { align: "center" });
  const contact = [data.school.phone, data.school.email].filter(Boolean).join(" / ");
  if (contact) print(contact, W / 2, 27.3, fitSize(contact, W - 108, 7, 5.4), false, gray, { align: "center" });
  print("GRADE 9 / JHS 3", W / 2, 33.6, 10, true, navy, { align: "center" });
  print("BECE-STYLE SCHOOL MOCK / TERMINAL PERFORMANCE REPORT", W / 2, 38, 7.1, false, gray, { align: "center" });

  bar("CANDIDATE INFORMATION", 48);
  panel(m, 56, W - 2 * m, 24);
  const name = formatName(data.student.firstName, data.student.lastName, data.student.otherNames);
  field("CANDIDATE", name, m + 4, 62, 78);
  field("ADMISSION NUMBER", data.student.admissionNumber, m + 89, 62, 53);
  const gender = data.student.gender === "M" ? "Male" : data.student.gender === "F" ? "Female" : "Not recorded";
  field("GENDER", gender, m + 150, 62, 33);
  field("CLASS", data.class.name, m + 4, 73, 91);
  field("ACADEMIC YEAR / TERM", data.school.academicYear + " / " + data.school.currentTerm, m + 105, 73, 75);

  print("EXAMINATION RESULTS", W / 2, 86, 10, true, blue, { align: "center" });
  doc.setLineWidth(0.2);
  stroke(line);
  doc.line(m, 89, W - m, 89);
  const body = ordered.map((s) => {
    const r = mockById.get(s.subjectId);
    return [
      subjectMap.get(s.subjectId)?.name ?? s.subjectId,
      gradeNineExamScore(s.examRaw)!.toFixed(1),
      r?.grade ?? "—",
      r?.point?.toString() ?? "—",
      s.position?.toString() ?? "—",
    ];
  });
  autoTable(doc, {
    startY: 91,
    head: [[
      "SUBJECT", "EXAM / 100", "GRADE", "POINT", "POS.",
    ]],
    body,
    theme: "grid",
    styles: {
      font: "helvetica", fontSize: ordered.length > 9 ? 7.25 : 7.65,
      cellPadding: ordered.length > 9 ? 1.1 : 1.5,
      textColor: navy, lineColor: line, lineWidth: 0.18, valign: "middle",
      minCellHeight: ordered.length > 9 ? 6.0 : 6.5,
    },
    headStyles: {
      fillColor: blue, textColor: white, fontStyle: "bold",
      fontSize: 7.1, halign: "center",
    },
    alternateRowStyles: { fillColor: [248, 251, 254] },
    columnStyles: {
      0: { cellWidth: 85, fontStyle: "bold" },
      1: { cellWidth: 35, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 26, halign: "center" },
    },
    margin: { left: m, right: m },
  });
  if (doc.getNumberOfPages() !== targetPage) {
    throw new Error("The Grade 9 subject table exceeds one A4 page.");
  }
  const endY = (doc as any).lastAutoTable?.finalY ?? 100;
  const y = endY + 5;
  const leftW = 93;
  const gap = 4;
  const rightX = m + leftW + gap;
  const rightW = W - 2 * m - leftW - gap;
  const summaryH = 52;
  if (y + summaryH + 46 > H - 19) {
    throw new Error("Grade 9 has too many subjects to fit one A4 report page.");
  }
  panel(m, y, leftW, summaryH);
  panel(rightX, y, rightW, summaryH);
  print("PERFORMANCE SUMMARY", m + leftW / 2, y + 6, 8.2, true, blue, { align: "center" });
  fill(pale);
  doc.rect(m + 4, y + 9, leftW - 8, 22, "F");
  print("FOUR CORE + BEST TWO = AGGREGATE", m + leftW / 2, y + 15, 6.7, true, gray, { align: "center" });
  print(mock.aggregate === null ? "INCOMPLETE" : String(mock.aggregate), m + leftW / 2, y + 25,
    mock.aggregate === null ? 11 : 20, true, blue, { align: "center" });
  const boxW = (leftW - 8) / 3;
  [
    ["AVERAGE", mock.average === null ? "—" : mock.average.toFixed(1) + "%"],
    ["AGG. POS.", mock.aggregate !== null && data.gradeNineMockPosition ? String(data.gradeNineMockPosition) : "—"],
    ["TOTAL", mock.total === null ? "—" : mock.total.toFixed(1)],
  ].forEach(([label, value], i) => {
    const x = m + 4 + i * boxW;
    print(label, x + boxW / 2, y + 38, 6.5, true, gray, { align: "center" });
    print(value, x + boxW / 2, y + 45, 9.3, true, blue, { align: "center" });
  });

  print("CORE SUBJECT PERFORMANCE", rightX + rightW / 2, y + 6, 7.9, true, blue, { align: "center" });
  const cores = MANDATORY_CORE.map((core) => ({
    name: core, row: mock.rows.find((r) => r.core === core),
  }));
  cores.forEach(({ name: core, row }, i) => {
    const yy = y + 14 + i * 6;
    if (i % 2 === 0) { fill([246, 250, 255]); doc.rect(rightX + 3, yy - 4.2, rightW - 6, 5.7, "F"); }
    print(core, rightX + 5, yy, 7.0, false, navy);
    print(row?.grade ?? "—", rightX + rightW - 21, yy, 7, true, blue, { align: "center" });
    print(row?.point?.toString() ?? "—", rightX + rightW - 8, yy, 7, true, blue, { align: "center" });
  });
  const selected = mock.rows.filter((r) => r.included && !r.core).map((r) => r.name);
  print("BEST TWO OTHERS", rightX + 5, y + 42, 6.6, true, gray);
  const choice = selected.length === 2 ? selected.join(", ") : "Pending complete results";
  print(choice, rightX + 5, y + 48, fitSize(choice, rightW - 10, 7.0, 5.3), true, navy);

  let below = y + summaryH + 5;
  const att = data.attendance;
  const rate = att && att.totalDays ? (100 * att.daysPresent / att.totalDays).toFixed(1) + "%" : "Not recorded";
  print("ATTENDANCE", m, below + 4, 7.5, true, blue);
  print(att ? String(att.daysPresent) + " / " + String(att.totalDays) + " days (" + rate + ")" : rate,
    m + 27, below + 4, 7.4, false);
  // Use the school-configured reopening date. A missing date is not guessed.
  const nextDate = data.school.nextTermBegins;
  const parsed = nextDate ? new Date(nextDate + "T12:00:00") : null;
  const nextTerm = parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "Not yet announced";
  print("NEXT TERM BEGINS", m + 102, below + 4, 7.2, true, blue);
  print(nextTerm, m + 146, below + 4, fitSize(nextTerm, 40, 7.0, 5.5), true);
  below += 8;

  print("REMARKS", m, below + 3, 7.7, true, blue);
  const remark = data.remarks?.classTeacherRemark || "No class-teacher remark recorded.";
  const headRemark = data.remarks?.headteacherRemark || "No headteacher remark recorded.";
  panel(m, below + 5, W - 2 * m, 21);
  print("CLASS TEACHER", m + 3, below + 10, 6.5, true, gray);
  print(doc.splitTextToSize(remark, W - 63).slice(0, 1).join(" "), m + 37, below + 10, 7.1);
  print("HEADTEACHER", m + 3, below + 18, 6.5, true, gray);
  print(doc.splitTextToSize(headRemark, W - 63).slice(0, 1).join(" "), m + 37, below + 18, 7.1);
  below += 30;

  stroke(navy);
  doc.setLineWidth(0.25);
  doc.line(m + 8, below + 5, m + 83, below + 5);
  doc.line(W - m - 83, below + 5, W - m - 8, below + 5);
  print("CLASS TEACHER'S SIGNATURE", m + 45, below + 10, 6.2, true, gray, { align: "center" });
  print("HEADTEACHER'S SIGNATURE", W - m - 45, below + 10, 6.2, true, gray, { align: "center" });

  if (data.school.logoUrl?.startsWith("data:image")) {
    try {
      doc.saveGraphicsState();
      doc.setGState(new GState({ opacity: 0.08 }));
      doc.addImage(data.school.logoUrl, "PNG", W / 2 - 30, 112, 60, 60);
      doc.restoreGraphicsState();
    } catch { try { doc.restoreGraphicsState(); } catch { /* optional watermark */ } }
  }
  stroke(line);
  doc.line(m, H - 16, W - m, H - 16);
  const scale = SCHOOL_MOCK_BANDS.map((b, i) => {
    const max = i === 0 ? 100 : SCHOOL_MOCK_BANDS[i - 1].min - 1;
    return String(b.min) + "-" + String(max) + " " + b.grade + "(" + b.point + ")";
  }).join("  |  ");
  print("SCHOOL MOCK GRADE SCALE: " + scale, W / 2, H - 12, 6.2, false, gray, { align: "center" });
  print("Internal BECE-style aggregate, NOT an official WAEC BECE result.", W / 2, H - 8.2,
    6.2, true, gray, { align: "center" });
  if (doc.getNumberOfPages() !== targetPage || below + 12 > H - 20) {
    throw new Error("The Grade 9 report would exceed one A4 page.");
  }
  return doc;
}
