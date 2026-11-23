import { GState, jsPDF } from "jspdf";
import { imageUrlToPngDataUrl, resolveSchoolAssetUrl } from "@/lib/school-branding";
import type { School, Student, SchoolClass } from "@/lib/models";

export type FinancePayment = {
  id: string; school_id: string; student_id: string; amount: number;
  method: string; reference: string; note: string;
  receipt_number: string; created_at: string; voided_at: string | null;
  created_by: string; void_reason: string | null;
};
export type FinanceCharge = {
  id: string; school_id: string; student_id: string; academic_year: string;
  term: number; category: string; description: string; amount: number;
  fee_id: string | null; sale_id: string | null; voided_at: string | null;
  created_at: string;
};
export type FinanceAllocation = {
  id: string; payment_id: string; charge_id: string; amount: number;
};
export const ghs = (amount: number) => "GHS " + Number(amount || 0).toLocaleString("en-GB", {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
export const money = (amount: number) => Math.round((Number(amount) + Number.EPSILON) * 100);
export const dueFor = (studentId: string, charges: FinanceCharge[], payments: FinancePayment[], allocations: FinanceAllocation[]) => {
  const valid = new Set(payments.filter(p => p.student_id === studentId && !p.voided_at).map(p => p.id));
  const charged = charges.filter(c => c.student_id === studentId && !c.voided_at)
    .reduce((sum, c) => sum + money(c.amount), 0);
  const paid = allocations.filter(a => valid.has(a.payment_id))
    .reduce((sum, a) => sum + money(a.amount), 0);
  return { charged: charged / 100, paid: paid / 100, outstanding: Math.max(0, charged - paid) / 100 };
};

const smallNumbers = [
  "zero","one","two","three","four","five","six","seven","eight","nine",
  "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"
];
const tensWords = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function underThousand(value: number): string {
  const words: string[] = [];
  if (value >= 100) {
    words.push(smallNumbers[Math.floor(value / 100)], "hundred");
    value %= 100;
  }
  if (value >= 20) {
    words.push(tensWords[Math.floor(value / 10)]);
    if (value % 10) words.push(smallNumbers[value % 10]);
  } else if (value > 0) words.push(smallNumbers[value]);
  return words.join(" ");
}
export function amountInWords(value: number) {
  const pesewas = Math.round(value * 100);
  if (!Number.isSafeInteger(pesewas) || pesewas < 0) return "";
  const whole = Math.floor(pesewas / 100);
  const units = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1_000, "thousand"],
    [1, ""],
  ] as const;
  let n = whole;
  const words: string[] = [];
  for (const [size, label] of units) {
    const chunk = Math.floor(n / size);
    if (chunk) {
      words.push(underThousand(chunk), label);
      n %= size;
    }
  }
  return (words.join(" ").trim() || "zero") + " Ghana cedis" +
    (pesewas % 100 ? " and " + underThousand(pesewas % 100) + " pesewas" : " only");
}

import autoTable from "jspdf-autotable";

export type FinanceReceiptArgs = {
  school: School;
  student: Student;
  cls?: SchoolClass;
  payment: FinancePayment;
  charges: FinanceCharge[];
  allocations: FinanceAllocation[];
  issuedBy: string;
  balance: number;
};

/**
 * PAYMENT RECEIPTS ONLY: A5 portrait (148 x 210 mm).
 * Report cards, academic transcripts, ranking sheets, class PDFs, finance
 * reports and item sale documents retain their existing page formats.
 */
export async function buildFinanceReceiptPdf({
  school, student, cls, payment, charges, allocations, issuedBy, balance,
}: FinanceReceiptArgs): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  type Ink = [number, number, number];
  const green: Ink = [12, 91, 68];
  const navy: Ink = [25, 43, 50];
  const gold: Ink = [226, 177, 61];
  const mint: Ink = [234, 247, 239];
  const grey: Ink = [103, 119, 120];
  const white: Ink = [255, 255, 255];
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 9;
  const width = pageWidth - margin * 2;
  const clean = (value: unknown) =>
    String(value ?? "").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

  function fittingSize(value: string, availableWidth: number, preferred: number, minimum = 6) {
    doc.setFont("helvetica", "bold");
    for (let size = preferred; size >= minimum; size -= 0.25) {
      doc.setFontSize(size);
      if (doc.getTextWidth(clean(value)) <= availableWidth) return size;
    }
    return minimum;
  }
  function clip(value: string, availableWidth: number, size: number, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const original = clean(value);
    if (doc.getTextWidth(original) <= availableWidth) return original;
    let result = original;
    while (result.length > 1 && doc.getTextWidth(result + "...") > availableWidth) {
      result = result.slice(0, -1);
    }
    return result + "...";
  }
  function text(value: string, x: number, y: number, size = 8, color: Ink = navy, bold = false, maxWidth?: number) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(maxWidth === undefined ? clean(value) : clip(value, maxWidth, size, bold), x, y);
  }
  function right(value: string, x: number, y: number, size = 8, color: Ink = navy, bold = false, maxWidth?: number) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(maxWidth === undefined ? clean(value) : clip(value, maxWidth, size, bold), x, y, { align: "right" });
  }
  function panel(x: number, y: number, w: number, h: number, color: Ink) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, w, h, 2.4, 2.4, "F");
  }

  const [logoUrl, photoUrl] = await Promise.all([
    resolveSchoolAssetUrl(school.logo_url),
    resolveSchoolAssetUrl(student.photo_url),
  ]);
  let logo: string | null = null;
  let photo: string | null = null;
  if (logoUrl) {
    try { logo = await imageUrlToPngDataUrl(logoUrl); }
    catch { /* The receipt remains printable without the school logo. */ }
  }
  if (photoUrl) {
    try { photo = await imageUrlToPngDataUrl(photoUrl); }
    catch { /* Student photographs are optional on printed receipts. */ }
  }

  const schoolName = clean(school.name).toUpperCase();
  const studentName = [student.first_name, student.other_names, student.last_name]
    .filter(Boolean).join(" ");
  const receivedAt = new Date(payment.created_at);
  const paymentDate = Number.isNaN(receivedAt.getTime())
    ? "Unknown date" : receivedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const printedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const receiptRef = clean(payment.receipt_number);
  const status = payment.voided_at ? "VOIDED" : "RECEIVED";

  // Compact branded A5 letterhead. All coordinates are within the 148 mm page.
  doc.setFillColor(...green);
  doc.rect(0, 0, pageWidth, 31, "F");
  doc.setFillColor(...gold);
  doc.rect(0, 31, pageWidth, 1.8, "F");
  panel(9, 5, 20, 20, white);
  if (logo) doc.addImage(logo, "PNG", 11, 7, 16, 16);
  else text("EDU", 11, 17, 9, green, true);
  text(schoolName, 34, 12.7, fittingSize(schoolName, 106, 11, 7.5), white, true, 106);
  const address = [school.address, school.district, school.region].filter(Boolean).join(" | ");
  const contact = [school.phone, school.email].filter(Boolean).join(" | ");
  text(address, 34, 19.2, 6.2, [221, 241, 230], false, 106);
  text(contact, 34, 24.3, 6.2, [221, 241, 230], false, 106);

  text("PAYMENT RECEIPT", 9, 40.5, 13, green, true);
  text("OFFICIAL SCHOOL FINANCE DOCUMENT", 9, 46.1, 6.4, grey, true);
  right(receiptRef, pageWidth - 9, 40.5, fittingSize(receiptRef, 69, 7.5, 6), navy, true, 69);
  right(paymentDate, pageWidth - 9, 46.1, 6.5, grey);

  panel(margin, 49.5, width, 21, green);
  text("AMOUNT RECEIVED", 13, 56.2, 7, [225, 243, 234], true);
  const paymentAmount = ghs(Number(payment.amount));
  text(paymentAmount, 13, 65.5, fittingSize(paymentAmount, 81, 16, 11), white, true);
  panel(103, 54.5, 32, 10.2, payment.voided_at ? [162, 53, 43] : [231, 246, 236]);
  right(status, 131, 60.9, 8.2, payment.voided_at ? white : green, true);

  panel(margin, 74, width, 29, [245, 249, 247]);
  text("STUDENT DETAILS", 13, 80, 7.1, green, true);
  text(studentName, 13, 88, fittingSize(studentName, 100, 11.5, 7), navy, true, 100);
  text("Admission No: " + student.admission_number, 13, 95, 7.4, grey, false, 103);
  text("Class: " + (cls?.name || "Not specified"), 13, 101, 7.4, grey, false, 103);
  if (photo) doc.addImage(photo, "PNG", 119, 76.7, 17, 22.7);
  else {
    doc.setDrawColor(211, 223, 218);
    doc.roundedRect(119, 76.7, 17, 22.7, 1.6, 1.6, "S");
    text("PHOTO", 121.2, 89, 5.4, grey);
  }

  // Subtle watermark underneath the payment breakdown and totals.
  if (logo) {
    doc.saveGraphicsState();
    try {
      doc.setGState(new GState({ opacity: 0.06 }));
      doc.addImage(logo, "PNG", 40, 114, 68, 68);
    } finally {
      doc.restoreGraphicsState();
    }
  }
  text("PAYMENT BREAKDOWN", 10, 109.2, 8.8, green, true);

  const selectedAllocations = allocations.filter((a) => a.payment_id === payment.id);
  const rows = selectedAllocations.map((a) => {
    const charge = charges.find((c) => c.id === a.charge_id);
    return [
      clean(charge?.description || "School charge"),
      charge ? charge.academic_year + " | Term " + charge.term : "-",
      ghs(Number(a.amount)),
    ];
  });
  autoTable(doc, {
    startY: 112.5,
    margin: { left: margin, right: margin, top: 12, bottom: 12 },
    head: [["DESCRIPTION", "ACADEMIC PERIOD", "AMOUNT"]],
    body: rows.length ? rows : [["Payment (allocation unavailable)", "-", paymentAmount]],
    theme: "grid",
    pageBreak: "auto",
    showHead: "everyPage",
    headStyles: {
      fillColor: navy,
      textColor: white,
      fontStyle: "bold",
      fontSize: 6.8,
      minCellHeight: 7,
      cellPadding: 1.8,
    },
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: 2,
      textColor: navy,
      lineColor: [217, 230, 224],
      lineWidth: 0.12,
      overflow: "linebreak",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [247, 251, 248] },
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 40 },
      2: { cellWidth: width - 96, halign: "right", fontStyle: "bold" },
    },
  });

  let y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 127;
  y += 3;
  const wordText = clean(amountInWords(Number(payment.amount)));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  const wordLines = doc.splitTextToSize(wordText, width - 8) as string[];
  // Keep the totals, amount in words, payment details and footer together.
  const remainingHeight = 20 + 3 + 10 + Math.max(0, wordLines.length - 1) * 4 +
    13 + 13 + 4;
  if (y + remainingHeight > pageHeight - 10) {
    doc.addPage();
    y = 14;
    text("PAYMENT RECEIPT - CONTINUED", 9, 10, 8, green, true);
    right(receiptRef, pageWidth - 9, 10, 6.5, grey, true, 73);
  }

  panel(margin, y, width, 18, mint);
  text("TOTAL RECEIVED", 13, y + 5, 6.8, green, true);
  text(paymentAmount, 13, y + 13.3, fittingSize(paymentAmount, 63, 12.8, 9), green, true);
  right("BALANCE AT PRINT", 135, y + 5, 6.2, grey, true);
  const balanceText = ghs(balance);
  right(balanceText, 135, y + 13.3, fittingSize(balanceText, 56, 10, 7.5), navy, true);
  y += 21;
  text("AMOUNT IN WORDS", 10, y + 2.2, 6.6, green, true);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...navy);
  doc.text(wordLines, 10, y + 7);
  y += 10 + Math.max(0, wordLines.length - 1) * 4;

  text("PAYMENT METHOD", 10, y + 3.5, 6.5, grey, true);
  text(payment.method, 10, y + 9.5, 8, navy, true, 58);
  text("TRANSACTION REFERENCE", 79, y + 3.5, 6.5, grey, true, 60);
  text(payment.reference || "Not supplied", 79, y + 9.5, 8, navy, false, 60);
  y += 14;

  text("RECORDED BY", 10, y + 3.5, 6.5, grey, true);
  text(issuedBy, 10, y + 9.5, 8, navy, true, 62);
  text("PRINTED", 80, y + 3.5, 6.5, grey, true);
  text(printedAt, 80, y + 9.5, 7.5, navy, false, 59);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 8.5, pageWidth - margin, pageHeight - 8.5);
    text("EDUREPORT | OFFICIAL PAYMENT RECORD", margin, pageHeight - 4.7, 5.8, grey, true);
    right("Page " + p + " of " + pages + " | " + receiptRef,
      pageWidth - margin, pageHeight - 4.7, 5.8, grey, false, 70);
    if (payment.voided_at) {
      doc.saveGraphicsState();
      try {
        doc.setGState(new GState({ opacity: 0.30 }));
        doc.setFont("helvetica", "bold");
        doc.setFontSize(32);
        doc.setTextColor(170, 49, 44);
        doc.text("VOIDED", pageWidth / 2, pageHeight / 2, { align: "center", angle: 25 });
      } finally {
        doc.restoreGraphicsState();
      }
    }
  }
  return doc;
}

export async function downloadFinanceReceipt(args: FinanceReceiptArgs): Promise<void> {
  const doc = await buildFinanceReceiptPdf(args);
  doc.save("receipt-" + args.payment.receipt_number.replace(/[^a-zA-Z0-9-]/g, "") + ".pdf");
}
