import { GState, jsPDF } from "jspdf";
import type { School, Student, SchoolClass } from "@/lib/models";
import { imageUrlToPngDataUrl, resolveSchoolAssetUrl } from "@/lib/school-branding";
import { ghs, money, type FinanceAllocation, type FinanceCharge, type FinancePayment } from "@/lib/finance-receipt";

export type FinanceSale = {
  id: string; school_id: string; student_id: string; item_id: string;
  quantity: number; unit_price: number; total: number;
  created_by: string; created_at: string;
};
export type FinanceSaleItem = {
  id: string; name: string; description: string; image_path: string | null;
};
export type SaleSettlement = {
  paid: number; balance: number; status: "PAID" | "PART_PAID" | "UNPAID";
};
export function calculateSaleSettlement(
  sale: Pick<FinanceSale,"total">,
  charge: Pick<FinanceCharge,"id">,
  allocations: FinanceAllocation[],
  payments: FinancePayment[]
): SaleSettlement {
  const validPayments = new Set(payments.filter(p => !p.voided_at).map(p => p.id));
  const paidPesewas = allocations
    .filter(a => a.charge_id === charge.id && validPayments.has(a.payment_id))
    .reduce((sum, a) => sum + money(Number(a.amount)), 0);
  const totalPesewas = money(Number(sale.total));
  const paid = Math.min(totalPesewas, paidPesewas);
  const balance = Math.max(0,totalPesewas - paid);
  return {
    paid: paid/100,
    balance: balance/100,
    status: balance === 0 ? "PAID" : paid > 0 ? "PART_PAID" : "UNPAID"
  };
}
export function saleDocumentReference(id: string) {
  return "SALE-" + id.replace(/[^a-zA-Z0-9]/g,"").toUpperCase();
}
type SaleDocumentArgs = {
  school: School; student: Student; cls?: SchoolClass;
  sale: FinanceSale; item: FinanceSaleItem; charge: FinanceCharge;
  payments: FinancePayment[]; allocations: FinanceAllocation[];
  recordedBy: string; itemImageUrl?: string | null;
};
const deepGreen: [number,number,number] = [10,82,63];
const ink: [number,number,number] = [21,42,50];
const muted: [number,number,number] = [100,116,118];
const gold: [number,number,number] = [218,170,56];
const white: [number,number,number] = [255,255,255];
const clean = (text:string)=>String(text||"").replace(/[^\x20-\x7E]/g," ").replace(/\s+/g," ").trim();

export async function downloadSaleDocument(args:SaleDocumentArgs, mode:"download"|"print"="download", printTab?: Window | null) {
  const {school,student,cls,sale,item,charge,payments,allocations,recordedBy,itemImageUrl}=args;
  if(sale.school_id!==school.id || student.school_id!==school.id ||
     sale.student_id!==student.id || sale.item_id!==item.id ||
     charge.sale_id!==sale.id || charge.student_id!==student.id ||
     charge.school_id!==school.id) throw new Error("The sale and student details do not match this school.");
  const settlement=calculateSaleSettlement(sale,charge,allocations,payments);
  const ref=saleDocumentReference(sale.id);
  const doc = new jsPDF({unit:"mm",format:"a4"});
  const txt=(text:string,x:number,y:number,size=9,bold=false,color=ink)=>{
    doc.setFont("helvetica",bold?"bold":"normal");
    doc.setFontSize(size);doc.setTextColor(...color);
    doc.text(clean(text),x,y);
  };
  const right=(text:string,x:number,y:number,size=9,bold=false,color=ink)=>{
    doc.setFont("helvetica",bold?"bold":"normal");
    doc.setFontSize(size);doc.setTextColor(...color);
    doc.text(clean(text),x,y,{align:"right"});
  };
  const area=(x:number,y:number,w:number,h:number,r:number,g:number,b:number)=>{
    doc.setFillColor(r,g,b);doc.roundedRect(x,y,w,h,3,3,"F");
  };
  const fit=(value:string,limit:number,initial:number)=>{
    doc.setFont("helvetica","bold");
    for(let size=initial;size>=8;size-=.5) {
      doc.setFontSize(size);if(doc.getTextWidth(clean(value))<=limit)return size;
    }
    return 8;
  };
  const [logoUrl,photoUrl]=await Promise.all([
    resolveSchoolAssetUrl(school.logo_url),resolveSchoolAssetUrl(student.photo_url)
  ]);
  const images=await Promise.all([logoUrl,photoUrl,itemImageUrl].map(async url=>{
    if(!url)return null;
    try{return await imageUrlToPngDataUrl(url);}catch{return null;}
  }));
  const [logo,photo,product]=images;
  const studentName=[student.first_name,student.other_names,student.last_name].filter(Boolean).join(" ");
  const transactionDate=new Date(sale.created_at);
  const date=Number.isNaN(transactionDate.getTime())?"Not available":transactionDate.toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"});
  const title=settlement.status==="PAID"?"ITEM PURCHASE RECEIPT":
    settlement.status==="PART_PAID"?"PART-PAID ITEM SALE RECORD":"ITEM SALE INVOICE";
  const status=settlement.status==="PAID"?"PAID IN FULL":
    settlement.status==="PART_PAID"?"PART PAYMENT":"PAYMENT PENDING";
  doc.setFillColor(...deepGreen);doc.rect(0,0,210,49,"F");
  doc.setFillColor(...gold);doc.rect(0,49,210,2.4,"F");
  area(15,12,27,27,255,255,255);
  if(logo)doc.addImage(logo,"PNG",17.5,14.5,22,22);
  else txt("EDU",18.5,28,11,true,deepGreen);
  const schoolName=clean(school.name).toUpperCase();
  txt(schoolName,48,21.5,fit(schoolName,145,15),true,white);
  txt([school.address,school.district,school.region].filter(Boolean).join(" | ").slice(0,80),48,29,7,false,[218,238,229]);
  txt([school.phone,school.email].filter(Boolean).join(" | ").slice(0,88),48,35,7,false,[218,238,229]);
  txt(title,15,65,16,true,deepGreen);
  txt("SCHOOL ITEMS AND INVENTORY SALES",15,72,7.5,true,muted);
  right(ref,195,65,8.5,true);
  right(date,195,72,8,false,muted);
  const statusBg=settlement.status==="PAID"?[229,246,236]:settlement.status==="PART_PAID"?[255,243,218]:[255,232,228];
  const statusInk=settlement.status==="PAID"?deepGreen:settlement.status==="PART_PAID"?[128,83,15]:[147,49,41];
  area(15,81,180,20,statusBg[0],statusBg[1],statusBg[2]);
  txt("SALE STATUS",21,88,7.2,true,statusInk as [number,number,number]);
  txt(status,21,96,12,true,statusInk as [number,number,number]);
  right("TOTAL "+ghs(Number(sale.total)),189,94,13,true,ink);
  area(15,110,180,36,246,249,247);
  txt("SOLD TO / STUDENT",21,117,7.2,true,deepGreen);
  txt(studentName,21,126,fit(studentName,123,13),true);
  txt("Admission no: "+student.admission_number,21,134,8,false,muted);
  txt("Class: "+(cls?.name||"Not specified"),21,141,8,false,muted);
  if(photo)doc.addImage(photo,"PNG",164,112,23,30);
  else {doc.setDrawColor(207,221,215);doc.rect(164,112,23,30);txt("PHOTO",167,128,6,false,muted);}
  if(logo) {
    doc.saveGraphicsState();
    try{doc.setGState(new GState({opacity:.065}));doc.addImage(logo,"PNG",57,151,96,96);}
    finally{doc.restoreGraphicsState();}
  }
  txt("PURCHASE DETAILS",16,159,9,true,deepGreen);
  doc.setFillColor(...ink);doc.rect(15,164,180,10,"F");
  txt("ITEM",20,170.7,8,true,white);
  right("QTY",133,170.7,8,true,white);
  right("UNIT PRICE",164,170.7,8,true,white);
  right("TOTAL",190,170.7,8,true,white);
  area(15,176,180,29,248,251,249);
  txt(item.name.slice(0,54),20,186,9.5,true);
  if(item.description)txt(item.description.slice(0,64),20,192,7,false,muted);
  right(String(sale.quantity),133,189,9,true);
  right(ghs(Number(sale.unit_price)),164,189,8.2);
  right(ghs(Number(sale.total)),190,189,9,true);
  if(product)doc.addImage(product,"PNG",20,195,12,8);
  area(15,213,180,34,235,247,239);
  txt("SALE TOTAL",21,222,8,true,deepGreen);right(ghs(Number(sale.total)),189,222,12,true,ink);
  txt("PAYMENTS ALLOCATED",21,231,8,false,muted);right(ghs(settlement.paid),189,231,9,true,deepGreen);
  txt("REMAINING FOR THIS ITEM",21,240,8,true,settlement.balance>0?[147,49,41]:deepGreen);
  right(ghs(settlement.balance),189,240,11,true,settlement.balance>0?[147,49,41]:deepGreen);
  txt("Recorded by: "+recordedBy.slice(0,60),17,257,8,false,ink);
  txt("Original sale: "+date,17,264,8,false,muted);
  if(settlement.status==="PAID"){
    txt("This item charge has been fully settled. See payment receipts for payment methods.",17,273,7,false,deepGreen);
  }else{
    txt("NOT PROOF OF FULL PAYMENT - record a payment to issue an official payment receipt.",17,273,7.3,true,[155,52,45]);
  }
  doc.setDrawColor(...gold);doc.line(15,283,195,283);
  txt("EDUREPORT | ITEM PURCHASE RECORD | GHS",16,288,6.5,true,muted);
  right(ref,194,288,6.5,false,muted);
  if(mode==="print"){
    doc.autoPrint();
    const pdfUrl=URL.createObjectURL(doc.output("blob"));
    if(printTab&&!printTab.closed){
      printTab.location.href=pdfUrl;
      printTab.focus();
      window.setTimeout(()=>URL.revokeObjectURL(pdfUrl),120000);
      return;
    }
    URL.revokeObjectURL(pdfUrl);
  }
  doc.save("item-"+(settlement.status==="PAID"?"receipt-":"sale-invoice-")+ref+".pdf");
}
