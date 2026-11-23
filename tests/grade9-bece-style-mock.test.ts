import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregatePositions, computeGradeNineMock, isGradeNineClass, mockBandFor,
} from "../src/lib/grade9-mock";
import { generateReportPDF } from "../src/lib/report-pdf";
import type { ReportCardData, Subject } from "../src/types";

// Exact nine subjects, scores and grade points from the uploaded Mock Report.pdf.
const reference = [
  ["Career Tech", 78, 2],
  ["Creative Art", 90, 1],
  ["English Language", 34, 5],
  ["French", 89, 1],
  ["Ghanian Lang.", 70, 2],
  ["Mathematics", 100, 1],
  ["R.M.E", 67, 3],
  ["Science", 56, 3],
  ["Social Studies", 100, 1],
] as const;
const items=reference.map(([name,score],i)=>({subjectId:"id-"+i,name,score,position:1}));

test("Reference PDF best-six result equals 12, never incorrectly printed 9",()=>{
  const r=computeGradeNineMock(items);
  assert.equal(r.total,684);
  assert.equal(r.average,76);
  assert.equal(r.coreTotal,10);
  assert.equal(r.bestTwoTotal,2);
  assert.equal(r.aggregate,12);
  assert.equal(r.rows.filter(x=>x.included).length,6);
  assert.ok(r.rows.some(x=>x.name==="English Language"&&x.point===5));
  assert.ok(r.rows.find(x=>x.name==="French")?.included);
  assert.ok(r.rows.find(x=>x.name==="Creative Art")?.included);
});
test("The reference scale A-E is explicit and is NOT WAEC's official nine-point grade",()=>{
  for(const [score,expectedPoint] of [[100,1],[80,1],[79.99,2],[68,2],[67.99,3],
    [54,3],[53.99,4],[40,4],[39.99,5],[0,5]] as const){
    assert.equal(mockBandFor(score)?.point,expectedPoint);
  }
  assert.equal(mockBandFor(-1),null);
  assert.equal(mockBandFor(101),null);
});
test("Do not invent aggregates for missing mandatory core marks or elective marks",()=>{
  const noEnglish=computeGradeNineMock(items.filter(x=>x.name!=="English Language"));
  assert.equal(noEnglish.aggregate,null);
  assert.deepEqual(noEnglish.missingCore,["English Language"]);
  const coreOnly=computeGradeNineMock(items.filter(x=>
    ["English Language","Mathematics","Science","Social Studies"].includes(x.name)));
  assert.equal(coreOnly.aggregate,null);
  assert.equal(coreOnly.missingElectives,2);
});
test("The mock report is activated only by a Grade 9 equivalent class name",()=>{
  for(const name of ["GRADE 9","Grade9","BASIC 9","JHS 3","JHS-3"])assert.equal(isGradeNineClass(name),true);
  for(const name of ["KG1","GRADE 8","GRADE 5","BASIC 1","JHS 2"])assert.equal(isGradeNineClass(name),false);
});
test("Aggregate positions are ascending, preserve ties and exclude incomplete learners",()=>{
  const ranks=aggregatePositions([
    {studentId:"a",aggregate:12},{studentId:"b",aggregate:6},{studentId:"c",aggregate:12},
    {studentId:"d",aggregate:null},{studentId:"e",aggregate:22}
  ]);
  assert.equal(ranks.get("b"),1);
  assert.equal(ranks.get("a"),2);
  assert.equal(ranks.get("c"),2);
  assert.equal(ranks.get("e"),4);
  assert.equal(ranks.has("d"),false);
});
const subjects:Subject[]=reference.map(([name],i)=>({
  id:"id-"+i,name,level:"JHS",isCore:["English Language","Mathematics","Science","Social Studies"].includes(name),
  order:i,
}));
const base:ReportCardData={
  student:{id:"student",firstName:"Viser",lastName:"",gender:"M",admissionNumber:"10128061",
    classId:"jhs3",status:"ACTIVE",createdAt:"2026-09-01"},
  school:{id:"sch",name:"MYROGITE INTERNATIONAL SCHOOL",academicYear:"2026/2027",currentTerm:1,
    sbaWeight:50,examWeight:50,gradingScale:{id:"default",name:"School",grades:[]}},
  class:{id:"jhs3",name:"GRADE 9",academicYear:"2026/2027",level:"JHS"},
  scores:items.map((s,i)=>({id:"sc-"+i,studentId:"student",classId:"jhs3",subjectId:s.subjectId,
    term:1,academicYear:"2026/2027",sbaScaled:s.score/2,examScaled:s.score/2,total:s.score,
    grade:"A",position:1})),
  overallAverage:76,overallGrade:"B",overallPosition:1,
  gradeNineMockPosition:1,totalStudents:10,
};
test("Only Grade 9 PDF uses one-page A4 mock aggregate layout",()=>{
  const doc=generateReportPDF(base,subjects);
  assert.equal(doc.getNumberOfPages(),1);
  assert.ok(Math.abs(doc.internal.pageSize.getWidth()-210)<0.3);
  const pdf=doc.output();
  for(const label of ["GRADE 9 SCHOOL MOCK","EXAMINATION RESULTS","BEST SIX AGGREGATE",
    "CORE SUBJECT PERFORMANCE","EXAMINATION REMARK","NOT an official WAEC BECE"]){
    assert.ok(pdf.includes(label),"Missing report content: "+label);
  }
  const grade8={...base,class:{...base.class,name:"GRADE 8"}};
  const older=generateReportPDF(grade8,subjects);
  assert.equal(older.getNumberOfPages(),1);
  assert.ok(!older.output().includes("GRADE 9 SCHOOL MOCK"));
});
test("Grade 9 class pack can append one report per A4 page",()=>{
  const doc=generateReportPDF(base,subjects);
  generateReportPDF({...base,student:{...base.student,id:"second",firstName:"Ama"}},subjects,doc);
  assert.equal(doc.getNumberOfPages(),2);
});
