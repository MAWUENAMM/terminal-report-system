import { GState, jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportCardData, Subject } from "@/types";
import { computeGradeNineMock, MANDATORY_CORE } from "./grade9-mock";

/**
 * Grade 9 school mock / BECE-style layout based on the supplied reference PDF.
 * The supplied A-E school mock scale is NOT an official WAEC 1-9 result.
 * Only the A4 Grade 9 report renderer uses this layout.
 */
export function generateGradeNineMockPDF(
  data: ReportCardData, subjects: Subject[], existingDoc?: jsPDF,
): jsPDF {
  const doc=existingDoc??new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  if(existingDoc)doc.addPage();
  const page=doc.getNumberOfPages();
  const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight();
  const blue:[number,number,number]=[22,97,184];
  const dark:[number,number,number]=[23,43,67];
  const muted:[number,number,number]=[95,110,122];
  const pale:[number,number,number]=[231,242,250];
  const line:[number,number,number]=[205,215,224];
  const text=(value:string,x:number,y:number,size=8,bold=false,color=dark,align:"left"|"center"|"right"="left")=>{
    doc.setFont("helvetica",bold?"bold":"normal");
    doc.setFontSize(size);doc.setTextColor(...color);
    doc.text(value,x,y,{align});
  };
  const trim=(value:string,width:number,max:number,min=5.8)=>{
    doc.setFont("helvetica","bold");
    for(let size=max;size>=min;size-=0.2){doc.setFontSize(size);if(doc.getTextWidth(value)<=width)return size;}
    return min;
  };
  const subjectMap=new Map(subjects.map(s=>[s.id,s]));
  const rows=data.scores
    .filter(s=>subjectMap.has(s.subjectId))
    .map(s=>({
      subjectId:s.subjectId,name:subjectMap.get(s.subjectId)!.name,
      score:Number(s.total),position:s.position,
    })).sort((a,b)=>
      (subjectMap.get(a.subjectId)?.order??999)-(subjectMap.get(b.subjectId)?.order??999));
  const mock=computeGradeNineMock(rows);
  const school=data.school,student=data.student;
  const candidateName=[student.firstName,student.otherNames,student.lastName].filter(Boolean).join(" ").toUpperCase();
  const opening="GRADE 9 SCHOOL MOCK - BECE-STYLE";
  doc.setDrawColor(...blue);doc.setLineWidth(.45);doc.rect(7,7,W-14,H-14);
  doc.setFillColor(...blue);doc.rect(7,7,W-14,1.7,"F");
  if(school.logoUrl?.startsWith("data:image")){
    try{doc.addImage(school.logoUrl,"PNG",11,12,20,20);}catch{/* logo optional */}
  }
  if(student.photoUrl?.startsWith("data:image")){
    try{doc.addImage(student.photoUrl,"PNG",W-31,12,20,24);}catch{/* photo optional */}
  }
  const titleName=school.name.toUpperCase();
  text(titleName,W/2,19,trim(titleName,130,15,8),true,blue,"center");
  text([school.address,school.district,school.region].filter(Boolean).join(" | ").slice(0,95),
    W/2,25,6.8,false,muted,"center");
  text([school.phone,school.email].filter(Boolean).join(" | ").slice(0,90),
    W/2,30,6.6,false,muted,"center");
  text(opening,W/2,39,10.8,true,dark,"center");
  text("STUDENT PERFORMANCE REPORT - INTERNAL SCHOOL ASSESSMENT",W/2,45,7.5,false,muted,"center");
  doc.setFillColor(...blue);doc.rect(10,50,W-20,7,"F");
  text("CANDIDATE INFORMATION",14,54.8,8,true,[255,255,255]);
  doc.setDrawColor(...line);doc.rect(10,57,W-20,22);
  text("CANDIDATE",14,62.5,6.5,true,muted);
  text(candidateName,14,69,trim(candidateName,95,9.3,6.6),true,dark);
  text("CLASS",14,74.2,6.4,true,muted);
  text(data.class.name,36,74.2,7.2,true,dark);
  text("ADMISSION / INDEX NUMBER",110,62.5,6.5,true,muted);
  text(student.admissionNumber,110,69,8.8,true,dark);
  text("ACADEMIC PERIOD",110,74.2,6.4,true,muted);
  text(`${school.academicYear} / Term ${school.currentTerm}`,143,74.2,7.0,true,dark);
  text("EXAMINATION RESULTS",W/2,85,10,true,blue,"center");

  const body=mock.rows.map(row=>[
    row.name.toUpperCase(),row.score.toFixed(1),row.grade,String(row.point),
    row.position?String(row.position):"-",
  ]);
  const rowCount=Math.max(1,body.length);
  if(rowCount>14)throw new Error("Too many Grade 9 subjects to fit on one A4 mock report.");
  autoTable(doc,{
    startY:89,
    margin:{left:10,right:10,top:10,bottom:16},
    head:[["SUBJECT","SCORE","GRADE","POINT","POSITION"]],
    body:body.length?body:[["No marks recorded","-","-","-","-"]],
    theme:"grid",
    headStyles:{fillColor:blue,textColor:[255,255,255],fontSize:7.3,minCellHeight:8,cellPadding:2.0},
    styles:{font:"helvetica",fontSize:7.8,cellPadding:1.7,minCellHeight:6.7,
      lineColor:line,lineWidth:0.15,overflow:"linebreak"},
    alternateRowStyles:{fillColor:[248,251,255]},
    columnStyles:{0:{cellWidth:100},1:{cellWidth:22,halign:"center"},
      2:{cellWidth:21,halign:"center"},3:{cellWidth:21,halign:"center"},
      4:{cellWidth:W-20-164,halign:"center"}},
  });
  const finalY=(doc as jsPDF&{lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY??101;
  if(doc.getNumberOfPages()!==page)throw new Error("Grade 9 subject table exceeds one A4 page.");
  const summaryY=finalY+5;
  const summaryH=51;
  if(summaryY+summaryH+39>H-15){
    throw new Error("Grade 9 report is too long for one A4 page.");
  }
  const summaryGap=4,half=(W-20-summaryGap)/2;
  doc.setDrawColor(...blue);doc.rect(10,summaryY,half,summaryH);
  doc.setDrawColor(...line);doc.rect(14+half,summaryY,half,summaryH);
  text("PERFORMANCE SUMMARY",10+half/2,summaryY+6,8.5,true,blue,"center");
  doc.setFillColor(...pale);doc.rect(14,summaryY+10,half-8,19,"F");
  text("BEST SIX AGGREGATE",10+half/2,summaryY+15,6.5,true,muted,"center");
  text(mock.aggregate===null?"PENDING":String(mock.aggregate),
    10+half/2,summaryY+25.2,17,true,blue,"center");
  const third=half/3;
  for(const [i,entry]of [
    ["AVERAGE",mock.average===null?"-":mock.average.toFixed(1)],
    ["POSITION",mock.aggregate===null?"-":String(data.gradeNineMockPosition??"-")],
    ["TOTAL",mock.total===null?"-":mock.total.toFixed(1)],
  ].entries()){
    const x=10+third*(i+.5);
    text(entry[0],x,summaryY+36,6.3,true,muted,"center");
    text(entry[1],x,summaryY+44,10,true,blue,"center");
  }
  text("CORE SUBJECT PERFORMANCE",14+half+half/2,summaryY+6,8.2,true,blue,"center");
  const colsStart=14+half;
  doc.setFillColor(...blue);doc.rect(colsStart+3,summaryY+10,half-6,7,"F");
  text("SUBJECT",colsStart+6,summaryY+14.5,6.4,true,[255,255,255]);
  text("GRADE",colsStart+half-28,summaryY+14.5,6.4,true,[255,255,255],"right");
  text("POINT",colsStart+half-6,summaryY+14.5,6.4,true,[255,255,255],"right");
  MANDATORY_CORE.forEach((name,i)=>{
    const r=mock.rows.find(row=>row.core===name);
    const y=summaryY+23+i*6.1;
    text(name,colsStart+6,y,7.0,false,dark);
    text(r?.grade||"-",colsStart+half-28,y,7.1,true,dark,"right");
    text(r?String(r.point):"-",colsStart+half-6,y,7.1,true,dark,"right");
  });
  const remarkY=summaryY+summaryH+7;
  text("EXAMINATION REMARK",10,remarkY,9,true,blue);
  doc.setDrawColor(...line);doc.rect(10,remarkY+4,W-20,20);
  const remark=data.remarks?.classTeacherRemark||data.remarks?.headteacherRemark||
    (mock.complete?"Results based on the recorded school assessment.":"Results are incomplete; required subject marks are missing.");
  doc.setFont("helvetica","normal");doc.setFontSize(8);
  doc.setTextColor(...dark);
  const wrapped=doc.splitTextToSize(remark,W-30) as string[];
  doc.text(wrapped.slice(0,3),14,remarkY+10);
  if(mock.aggregate===null){
    const msg=[
      mock.missingCore.length?"Missing core: "+mock.missingCore.join(", "):"",
      mock.missingElectives?"Need "+mock.missingElectives+" more other subject(s)":"",
    ].filter(Boolean).join(" | ");
    text(msg.slice(0,115),14,remarkY+22,6.5,true,muted);
  }
  const note="SCHOOL MOCK SCALE: 80-100 A(1) | 68-79 B(2) | 54-67 C(3) | 40-53 D(4) | 0-39 E(5)";
  text(note,W/2,H-16,6.6,true,muted,"center");
  text("School mock aggregate uses four core subjects plus best two others. NOT an official WAEC BECE result.",
    W/2,H-11,6.6,false,[155,65,46],"center");
  text(`EduReport | ${school.academicYear} | Term ${school.currentTerm}`,11,H-5,6.3,false,muted);
  text("Page 1 of 1",W-11,H-5,6.3,false,muted,"right");
  // Watermark behind header and sections is deliberately omitted for readability.
  // Optional photos and school branding continue to use the actual stored files.
  void GState;
  return doc;
}
