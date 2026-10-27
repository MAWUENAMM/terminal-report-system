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
export async function downloadFinanceReceipt({
  school, student, cls, payment, charges, allocations, issuedBy, balance
}: {
  school: School; student: Student; cls?: SchoolClass;
  payment: FinancePayment; charges: FinanceCharge[];
  allocations: FinanceAllocation[]; issuedBy: string; balance: number;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  type Ink = [number,number,number];
  const green: Ink = [12,91,68], navy: Ink = [25,43,50], gold: Ink = [226,177,61];
  const mint: Ink = [234,247,239], grey: Ink = [103,119,120];
  const clean = (value: string) => String(value||"").replace(/[^\x20-\x7E]/g," ").replace(/\s+/g," ").trim();
  const label = (value:string,x:number,y:number,size=9,color:Ink=navy,bold=false) => {
    doc.setFont("helvetica",bold?"bold":"normal");
    doc.setFontSize(size);doc.setTextColor(...color);doc.text(clean(value),x,y);
  };
  const right = (value:string,x:number,y:number,size=9,color:Ink=navy,bold=false) => {
    doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);doc.setTextColor(...color);
    doc.text(clean(value),x,y,{align:"right"});
  };
  const box = (x:number,y:number,w:number,h:number,color:Ink) => {
    doc.setFillColor(...color);doc.roundedRect(x,y,w,h,3,3,"F");
  };
  const fit = (value:string,limit:number,max=15) => {
    doc.setFont("helvetica","bold");
    for(let size=max;size>=9;size-=.5){doc.setFontSize(size);if(doc.getTextWidth(clean(value))<=limit)return size;}
    return 9;
  };
  const [logoUrl,photoUrl] = await Promise.all([
    resolveSchoolAssetUrl(school.logo_url),resolveSchoolAssetUrl(student.photo_url)
  ]);
  let logo:string|null=null,photo:string|null=null;
  if(logoUrl)try{logo=await imageUrlToPngDataUrl(logoUrl);}catch{ /* optional */ }
  if(photoUrl)try{photo=await imageUrlToPngDataUrl(photoUrl);}catch{ /* optional */ }
  const schoolName=clean(school.name).toUpperCase();
  const studentName=[student.first_name,student.other_names,student.last_name].filter(Boolean).join(" ");
  const receivedAt=new Date(payment.created_at);
  const paymentDate=Number.isNaN(receivedAt.getTime())?"Unknown date":receivedAt.toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"});
  const printedAt=new Date().toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"});
  // Genuine branded letterhead. All currency is ASCII 'GHS' for consistent PDF rendering.
  doc.setFillColor(...green);doc.rect(0,0,210,48,"F");
  doc.setFillColor(...gold);doc.rect(0,48,210,2.5,"F");
  box(15,12,28,28,[255,255,255]);
  if(logo) doc.addImage(logo,"PNG",18,15,22,22);
  else label("EDU",20,30,12,green,true);
  label(schoolName,49,22,fit(schoolName,148),[255,255,255],true);
  label([school.address,school.district,school.region].filter(Boolean).join(" | ").slice(0,85),49,29,7,[218,238,228]);
  label([school.phone,school.email].filter(Boolean).join(" | ").slice(0,85),49,35,7,[218,238,228]);
  label("PAYMENT RECEIPT",16,64,16,green,true);
  label("OFFICIAL SCHOOL FINANCE DOCUMENT",16,70,7.4,grey,true);
  right(payment.receipt_number,194,63,9,navy,true);
  right(paymentDate,194,70,8,grey);
  box(15,79,180,31,green);
  label("AMOUNT RECEIVED",21,88,8,[224,245,233],true);
  label(ghs(Number(payment.amount)),21,101,20,[255,255,255],true);
  box(153,85,35,12,payment.voided_at?[167,54,44]:[231,246,236]);
  right(payment.voided_at?"VOIDED":"RECEIVED",184,92.5,10,payment.voided_at?[255,255,255]:green,true);
  box(15,117,180,36,[245,249,247]);
  label("STUDENT DETAILS",21,125,7.5,green,true);
  label(studentName,21,135,fit(studentName,129,14),navy,true);
  label("Admission No: "+student.admission_number,21,143,8,grey);
  label("Class: "+(cls?.name||"Not specified"),21,149,8,grey);
  if(photo)doc.addImage(photo,"PNG",163,120,25,29);
  else{doc.setDrawColor(211,223,218);doc.roundedRect(163,120,25,29,2,2,"S");label("PHOTO",166,135,6,grey);}
  if(logo){
    doc.saveGraphicsState();
    try{doc.setGState(new GState({opacity:.065}));doc.addImage(logo,"PNG",62,171,86,86);}
    finally{doc.restoreGraphicsState();}
  }
  label("PAYMENT BREAKDOWN",16,162,9.5,green,true);
  const own=allocations.filter(a=>a.payment_id===payment.id);
  const lines=own.map(a=>{
    const charge=charges.find(c=>c.id===a.charge_id);
    return [clean(charge?.description||"School charge"),charge?charge.academic_year+" | Term "+charge.term:"-",
      ghs(Number(a.amount))];
  });
  autoTable(doc,{
    startY:168,margin:{left:15,right:15,bottom:47},
    head:[["DESCRIPTION","ACADEMIC PERIOD","AMOUNT"]],
    body:lines.length?lines:[["Payment (allocation detail unavailable)","-",ghs(Number(payment.amount))]],
    theme:"grid",
    headStyles:{fillColor:[25,43,50],textColor:[255,255,255],fontStyle:"bold",minCellHeight:10},
    styles:{font:"helvetica",fontSize:8.4,cellPadding:3.1,textColor:[25,43,50],lineColor:[217,230,224],lineWidth:.12},
    alternateRowStyles:{fillColor:[247,251,248]},
    columnStyles:{0:{cellWidth:82},1:{cellWidth:52},2:{cellWidth:46,halign:"right",fontStyle:"bold"}}
  });
  let y=(doc as jsPDF & {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY||184;
  if(y>218){doc.addPage();y=24;}
  y+=7;
  box(15,y,180,31,mint);
  label("TOTAL RECEIVED",21,y+9,8,green,true);
  label(ghs(Number(payment.amount)),21,y+23,16,green,true);
  right("BALANCE AT TIME OF PRINT",189,y+9,7,grey,true);
  right(ghs(balance),189,y+22,11,navy,true);
  y+=39;
  label("AMOUNT IN WORDS",17,y,7,green,true);
  const words=doc.splitTextToSize(clean(amountInWords(Number(payment.amount))),174);
  doc.setFont("helvetica","bold");doc.setFontSize(8.4);doc.setTextColor(...navy);
  doc.text(words,17,y+7);
  y+=Math.max(14,words.length*5+8);
  if(y>237){doc.addPage();y=26;}
  label("PAYMENT METHOD",17,y+5,7,grey,true);label(payment.method,17,y+12,9,navy,true);
  label("TRANSACTION REFERENCE",107,y+5,7,grey,true);
  label((payment.reference||"Not supplied").slice(0,40),107,y+12,8.5,navy);
  y+=19;
  label("RECORDED BY",17,y+5,7,grey,true);label(issuedBy.slice(0,50),17,y+12,8.5,navy,true);
  label("PRINTED",117,y+5,7,grey,true);label(printedAt,117,y+12,8,navy);
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    doc.setPage(page);doc.setDrawColor(...gold);doc.setLineWidth(.45);doc.line(15,282,195,282);
    label("EDUREPORT  |  OFFICIAL SCHOOL PAYMENT RECORD",15,287,6.5,grey,true);
    right("Page "+page+" of "+pages+"  |  "+payment.receipt_number,195,287,6.5,grey);
    if(payment.voided_at){
      doc.saveGraphicsState();
      try{doc.setGState(new GState({opacity:.34}));doc.setFont("helvetica","bold");doc.setFontSize(43);
        doc.setTextColor(174,48,44);doc.text("VOIDED",108,203,{align:"center",angle:25});}
      finally{doc.restoreGraphicsState();}
    }
  }
  doc.save("receipt-"+payment.receipt_number.replace(/[^a-zA-Z0-9-]/g,"")+".pdf");
}
