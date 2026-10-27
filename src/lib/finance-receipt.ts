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
export const ghs = (amount: number) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(amount);
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

export async function downloadFinanceReceipt({
  school, student, cls, payment, charges, allocations, issuedBy, balance
}: {
  school: School; student: Student; cls?: SchoolClass;
  payment: FinancePayment; charges: FinanceCharge[];
  allocations: FinanceAllocation[]; issuedBy: string; balance: number;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const dark: [number,number,number] = [12, 39, 49];
  const green: [number,number,number] = [11, 108, 76];
  const gold: [number,number,number] = [237, 190, 56];
  const studentName = [student.first_name, student.other_names, student.last_name].filter(Boolean).join(" ");
  const w = 210;
  const text = (str: string, x: number, y: number, size = 9, color = dark, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(str, x, y);
  };
  const block = (x: number, y: number, bw: number, bh: number, color: [number,number,number]) => {
    doc.setFillColor(...color);
    doc.roundedRect(x,y,bw,bh,2.5,2.5,"F");
  };

  // Only signed school assets are read, using the same resolver as learner reports.
  const [logoUrl, photoUrl] = await Promise.all([
    resolveSchoolAssetUrl(school.logo_url), resolveSchoolAssetUrl(student.photo_url)
  ]);
  let logo: string | null = null, photo: string | null = null;
  if (logoUrl) try { logo = await imageUrlToPngDataUrl(logoUrl); } catch { /* branding is optional */ }
  if (photoUrl) try { photo = await imageUrlToPngDataUrl(photoUrl); } catch { /* fallback frame */ }

  doc.setDrawColor(...green);
  doc.setLineWidth(1.1);
  doc.rect(7,7,196,283);
  doc.setLineWidth(0.3);
  doc.setDrawColor(...gold);
  doc.rect(9,9,192,279);
  if (logo) {
    doc.saveGraphicsState();
    try {
      doc.setGState(new GState({ opacity: 0.065 }));
      doc.addImage(logo, "PNG", 53, 88, 104, 104);
    } finally {
      doc.restoreGraphicsState();
    }
    doc.addImage(logo, "PNG", 15, 16, 24, 24);
  } else {
    block(15,16,24,24,green);
    text("EDU",19,30,10,[255,255,255],true);
  }
  doc.setFont("helvetica","bold");
  const name = school.name.toUpperCase();
  let nameSize = 15;
  while(nameSize>9 && doc.getTextWidth(name)>148) {
    nameSize -= .5; doc.setFontSize(nameSize);
  }
  text(name, 45, 23, nameSize, green, true);
  const contact = [school.address,school.district,school.region].filter(Boolean).join(" · ");
  doc.setFontSize(7);
  text(contact.slice(0,92),45,29,7,dark);
  text([school.phone,school.email].filter(Boolean).join(" · ").slice(0,95),45,34,7,dark);
  doc.setFillColor(...green);
  doc.rect(12,45,186,25,"F");
  text("OFFICIAL PAYMENT RECEIPT",18,56,13,[255,255,255],true);
  text(ghs(Number(payment.amount)),18,65,15,gold,true);
  doc.setFont("helvetica","bold");
  doc.setTextColor(255,255,255);
  doc.setFontSize(8);
  doc.text(payment.receipt_number,192,56,{align:"right"});
  doc.setFontSize(7);
  doc.text(new Date(payment.created_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}),192,64,{align:"right"});

  block(14,76,182,39,[244,248,246]);
  text("RECEIVED FROM",19,83,7,green,true);
  text(studentName.slice(0,70),19,92,13,dark,true);
  text("Admission: " + student.admission_number,19,100,8);
  text("Class: " + (cls?.name || "—"),19,107,8);
  if (photo) doc.addImage(photo,"PNG",170,80,20,27);
  else {
    doc.setDrawColor(186,204,196);
    doc.rect(170,80,20,27);
    text("PHOTO",173,95,6,[119,136,128]);
  }

  text("PAYMENT BREAKDOWN",16,128,9,green,true);
  doc.setFillColor(...dark);
  doc.rect(15,133,180,10,"F");
  text("DESCRIPTION",19,139.5,8,[255,255,255],true);
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(255,255,255);
  doc.text("AMOUNT",189,139.5,{align:"right"});
  let y=150;
  const own = allocations.filter(a=>a.payment_id===payment.id);
  for(const allocation of own.slice(0,9)){
    const charge=charges.find(c=>c.id===allocation.charge_id);
    if(!charge)continue;
    text(charge.description.slice(0,72),19,y,8);
    doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text(ghs(Number(allocation.amount)),189,y,{align:"right"});
    doc.setDrawColor(220,231,226); doc.line(18,y+3,191,y+3);
    y+=10;
  }
  if(own.length>9) {
    text("Additional fee allocations are recorded in the finance ledger.",19,y,7);
    y+=8;
  }
  y=Math.max(169,y+6);
  block(15,y,180,23,[234,245,239]);
  text("TOTAL RECEIVED",20,y+8,8,green,true);
  text(ghs(Number(payment.amount)),20,y+18,15,green,true);
  doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...dark);
  doc.text("Current outstanding: "+ghs(balance),189,y+13,{align:"right"});
  y+=32;
  text("Amount in words:",16,y,8,green,true);
  const words=doc.splitTextToSize(amountInWords(Number(payment.amount)),175);
  doc.setFontSize(8);doc.setTextColor(...dark);doc.text(words.slice(0,2),16,y+6);
  y+=19;
  text("Payment method: " + payment.method,16,y,8);
  text("Payment reference: " + (payment.reference||"Not supplied").slice(0,52),16,y+7,8);
  text("Recorded by: " + issuedBy.slice(0,60),16,y+14,8);
  const sigY=267;
  doc.setDrawColor(...green);
  doc.line(17,sigY,90,sigY);doc.line(123,sigY,192,sigY);
  text("School finance / cashier",18,sigY+5,7);
  text("Authorized school stamp",125,sigY+5,7);
  if(payment.voided_at){
    doc.setFontSize(44); doc.setTextColor(198,48,48);
    doc.text("VOID",105,155,{align:"center",angle:25});
  }
  text("Generated from EduReport · Retain for your records · " + payment.receipt_number,16,284,6,[94,113,104]);
  doc.save("receipt-" + payment.receipt_number.replace(/[^a-zA-Z0-9-]/g,"") + ".pdf");
}
