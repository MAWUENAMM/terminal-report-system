import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { School, SchoolClass, Student } from "@/lib/models";
import { dueFor, ghs, type FinanceAllocation, type FinanceCharge, type FinancePayment } from "@/lib/finance-receipt";

export type FinanceReportData = {
  school: School; students: Student[]; classes: SchoolClass[];
  charges: FinanceCharge[]; payments: FinancePayment[];
  allocations: FinanceAllocation[];
  sales: {id:string;student_id:string;item_id:string;quantity:number;total:number;created_at:string}[];
  items: {id:string;name:string;unit_price:number;stock_quantity:number;active:boolean}[];
};
export type FinanceReportKind = "all"|"accounts"|"payments"|"charges"|"inventory";
const schoolName = (student:Student)=>[student.first_name,student.other_names,student.last_name].filter(Boolean).join(" ");
const dateLabel=(x:string)=>{const date=new Date(x);return Number.isNaN(date.getTime())?"Unknown":date.toLocaleDateString("en-GB");};
const status=(charged:number,paid:number,due:number)=>
  charged===0?"No fees":due===0?"Fully paid":paid>0?"Part-paid":"Unpaid";
export function reportRows(data:FinanceReportData) {
  const names=new Map(data.students.map(s=>[s.id,schoolName(s)]));
  const classes=new Map(data.classes.map(c=>[c.id,c.name]));
  const balances=data.students.map(s=>{
    const b=dueFor(s.id,data.charges,data.payments,data.allocations);
    return [s.admission_number,schoolName(s),classes.get(s.class_id)||"-",
      ghs(b.charged),ghs(b.paid),ghs(b.outstanding),status(b.charged,b.paid,b.outstanding)];
  });
  const payments=data.payments.map(p=>[
    dateLabel(p.created_at),p.receipt_number,names.get(p.student_id)||"Unknown",
    p.method,p.reference||"-",ghs(Number(p.amount)),p.voided_at?"VOIDED":"Received"
  ]);
  const charges=data.charges.map(c=>[
    dateLabel(c.created_at),names.get(c.student_id)||"Unknown",c.description,
    c.academic_year+" / T"+c.term,c.category,ghs(Number(c.amount)),c.voided_at?"VOIDED":"Active"
  ]);
  const items=data.items.map(i=>[
    i.name,ghs(Number(i.unit_price)),String(i.stock_quantity),
    ghs(Number(i.unit_price)*i.stock_quantity),i.active?"Active":"Inactive"
  ]);
  const sales=data.sales.map(s=>[
    dateLabel(s.created_at),names.get(s.student_id)||"Unknown",
    data.items.find(i=>i.id===s.item_id)?.name||"Item",String(s.quantity),ghs(Number(s.total))
  ]);
  return {balances,payments,charges,items,sales};
}
export function exportFinanceCsv(rows:string[][],headers:string[],name:string) {
  const quote=(value: string)=>'"'+String(value).replace(/"/g,'""')+'"';
  const csv="\uFEFF"+[headers,...rows].map(row=>row.map(quote).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const objectUrl=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=objectUrl;anchor.download=name;document.body.appendChild(anchor);
  anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(objectUrl),5000);
}
export function downloadFinanceReport(data:FinanceReportData,kind:FinanceReportKind="all") {
  const rows=reportRows(data);
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const green:[number,number,number]=[12,91,68];
  const dark:[number,number,number]=[25,43,50];
  const muted:[number,number,number]=[111,124,122];
  const pageHeader=()=>{
    doc.setFillColor(...green);doc.rect(0,0,210,28,"F");
    doc.setFont("helvetica","bold");doc.setFontSize(14);doc.setTextColor(255,255,255);
    doc.text(data.school.name.slice(0,55),15,13);
    doc.setFontSize(8);doc.text("OFFICIAL FINANCE REPORT | GHS",15,21);
  };
  const section=(heading:string,header:string[],body:string[][],y=42)=>{
    if(y>245){doc.addPage();pageHeader();y=41;}
    doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(...green);
    doc.text(heading,15,y);
    autoTable(doc,{
      startY:y+5,margin:{left:15,right:15,top:37,bottom:19},
      head:[header],body:body.length?body:[header.map((_,i)=>i===0?"No records":"")],
      theme:"striped",
      styles:{font:"helvetica",fontSize:7.2,cellPadding:2.7,textColor:[25,43,50],overflow:"linebreak"},
      headStyles:{fillColor:[25,43,50],textColor:[255,255,255],fontStyle:"bold"},
      alternateRowStyles:{fillColor:[240,248,243]},
      didDrawPage:()=>{},
    });
    return (doc as jsPDF & {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY||y+18;
  };
  const active=data.payments.filter(p=>!p.voided_at);
  const charged=data.charges.filter(c=>!c.voided_at).reduce((sum,c)=>sum+Number(c.amount),0);
  const paid=active.reduce((sum,p)=>sum+Number(p.amount),0);
  pageHeader();
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(...dark);
  doc.text(kind==="all"?"CONSOLIDATED SCHOOL FINANCE REPORT":"SCHOOL FINANCE REPORT",15,43);
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...muted);
  doc.text("Generated: "+new Date().toLocaleString("en-GB")+"  |  Scope: all recorded academic periods",15,51);
  doc.setFillColor(236,247,241);doc.roundedRect(15,57,180,32,3,3,"F");
  const stats=[["Total charged",charged],["Payments received",paid],["Outstanding",Math.max(0,charged-paid)]];
  stats.forEach(([title,value],i)=>{
    const x=21+i*59;
    doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...green);
    doc.text(String(title),x,66);
    doc.setFontSize(13);doc.setTextColor(...dark);doc.text(ghs(Number(value)),x,78);
  });
  let y=99;
  const add=(heading:string,header:string[],body:string[][])=>{
    if(y>170){doc.addPage();pageHeader();y=40;}
    y=section(heading,header,body,y)+12;
  };
  if(kind==="all"||kind==="accounts") add("STUDENT BALANCES",
    ["Admission","Student","Class","Charged","Paid","Owing","Status"],rows.balances);
  if(kind==="all"||kind==="payments") add("PAYMENT TRANSACTIONS",
    ["Date","Receipt No.","Student","Mode","Reference","Amount","Status"],rows.payments);
  if(kind==="all"||kind==="charges") add("FEE AND ITEM CHARGES",
    ["Date","Student","Description","Year / Term","Type","Amount","Status"],rows.charges);
  if(kind==="all"||kind==="inventory"){
    add("INVENTORY AND STOCK",
      ["Item","Unit price","Stock","Stock value","Status"],rows.items);
    add("ITEM SALES",["Date","Student","Item","Qty","Amount"],rows.sales);
  }
  const pages=doc.internal.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    doc.setPage(i);doc.setDrawColor(226,177,61);doc.line(15,282,195,282);
    doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(...muted);
    doc.text("EduReport | School-specific financial records | All amounts in GHS",15,287);
    doc.text("Page "+i+" of "+pages,195,287,{align:"right"});
  }
  doc.save("finance-"+kind+"-"+new Date().toISOString().slice(0,10)+".pdf");
}
