import assert from "node:assert/strict";
import test from "node:test";
import { generateReportPDF } from "../src/lib/report-pdf";
import { exportClassResultsPdf } from "../src/lib/class-sheet-pdf";
import type { ReportCardData, Subject } from "../src/types";
import type { Workspace } from "../src/lib/models";

const courseNames = ["NUMERACY", "CREATIVE ARTS", "OWOP", "LITERACY", "WRITING"];
const subjects: Subject[] = courseNames.map((name, i) => ({
  id: `sub-${i+1}`, name, code: String(i+1),
  level: "KG", order: i+1, isCore: true,
}));
const scoreRows: NonNullable<ReportCardData["scores"]> = subjects.map((s,i)=>({
  id: `score-${i}`,studentId:"learner1",subjectId:s.id,classId:"kg1",
  term:1,academicYear:"2026/2027",sbaScaled:50,examScaled:0,
  total:50,grade:"D",position:1,
}));
const first: ReportCardData = {
  school: {
    id:"ark",name:"THE ARK ACADEMY",academicYear:"2026/2027",
    currentTerm:1,sbaWeight:50,examWeight:50,termTotalDays:65,
    nextTermBegins:"2027-01-05",
    gradingScale:{id:"basic",name:"standard",grades:[]},
  },
  student:{
    id:"learner1",firstName:"SARPONG",lastName:"AMPOFO DESMOND",
    admissionNumber:"ARK0036",gender:"M",classId:"kg1",status:"ACTIVE",
    createdAt:"2026-01-01",
  },
  class:{id:"kg1",name:"KG1",level:"KG",academicYear:"2026/2027"},
  scores:scoreRows,overallAverage:50,overallGrade:"D",
  overallPosition:1,totalStudents:31,
  promotedTo:"KG2",
  remarks:{
    id:"r1",studentId:"learner1",term:1,academicYear:"2026/2027",
    classTeacherRemark:"A hardworking student. Keep improving.",
    headteacherRemark:"Continue to work hard next term.",
  },
};
test("Ark KG1 five-subject terminal report fits ONE A4 page with totals and signatures",()=>{
  const doc=generateReportPDF(first,subjects);
  assert.equal(doc.getNumberOfPages(),1);
  const content=doc.output();
  for(const label of ["TOTAL MARKS","NEXT TERM BEGINS","250.0 / 500",
    "CLASS TEACHER", "HEADTEACHER","SIGNATURE","Total school days: 65"]) {
    assert.ok(content.includes(label),`PDF missing ${label}`);
  }
  assert.ok(content.includes("Page 1 of 1"));
});
test("One combined class document places exactly one report on each consecutive A4 page",()=>{
  let doc=generateReportPDF(first,subjects);
  const second:ReportCardData={
    ...first,
    student:{...first.student,id:"learner2",firstName:"AMA",lastName:"OWUSU",admissionNumber:"ARK0040"},
  };
  doc=generateReportPDF(second,subjects,doc);
  assert.equal(doc.getNumberOfPages(),2);
  assert.ok(Math.abs(doc.internal.pageSize.getHeight()-297)<0.1);
});
test("Ranking PDF shows subject names instead of numeric subject codes",()=>{
  const classStudents=[
    {id:"learner1",school_id:"ark",class_id:"kg1",admission_number:"ARK0036",
     first_name:"SARPONG",last_name:"AMPOFO DESMOND",gender:"M",status:"ACTIVE"},
    {id:"learner2",school_id:"ark",class_id:"kg1",admission_number:"ARK0040",
     first_name:"AMA",last_name:"OWUSU",gender:"F",status:"ACTIVE"},
  ];
  const workspace={
    school:{id:"ark",name:"THE ARK ACADEMY",academic_year:"2026/2027",current_term:1},
    classes:[{id:"kg1",school_id:"ark",name:"KG1",level:"KG"}],
    subjects:subjects.map((s)=>({
      id:s.id,name:s.name,code:s.code,level:"KG",
      active:true,school_id:"ark",display_order:s.order,
    })),
    students:classStudents,
    assignments:[],
    scores:classStudents.flatMap((student)=>subjects.map((subject,i)=>({
      id:`${student.id}-${subject.id}`,student_id:student.id,
      subject_id:subject.id,school_id:"ark",class_id:"kg1",
      academic_year:"2026/2027",term:1,total:50-i,
    }))),
  } as unknown as Workspace;
  const doc=exportClassResultsPdf(workspace,"kg1","ranking",{download:false});
  const pdf=doc.output();
  for(const subject of courseNames)assert.ok(pdf.includes(subject),`Missing subject heading: ${subject}`);
  assert.ok(!pdf.includes("(4) Tj"),"Ranking header should not display numeric subject code 4");
});

test("Report also remains one A4 page for a broader 11-subject junior high curriculum",()=>{
  const extended:Subject[]=Array.from({length:11},(_,i)=>({
    id:`subject-${i+1}`,name:`SUBJECT ${i+1}`,
    code:String(i+1),level:"JHS",isCore:true,order:i+1,
  }));
  const scores=extended.map((s,i)=>({
    ...scoreRows[0],id:`score-${i+1}`,subjectId:s.id,total:60,
  }));
  const doc=generateReportPDF({
    ...first,scores,class:{...first.class,name:"Grade 8",level:"JHS"},
    overallAverage:60,overallGrade:"C",
  },extended);
  assert.equal(doc.getNumberOfPages(),1);
});
