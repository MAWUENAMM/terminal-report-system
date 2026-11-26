import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EARLY_YEARS_REMARKS, earlyYearsRemark, isEarlyYearsClass } from "../src/lib/early-years";
import { generateReportPDF } from "../src/lib/report-pdf";
import { reportData } from "../src/lib/reporting";
import { buildClassResultSheet } from "../src/lib/class-sheets";
import type { ReportSnapshot, Workspace } from "../src/lib/models";
import type { ReportCardData, Subject } from "../src/types";

const names = ["Auditory Discrimination (Sense of Hearing)","Care of Environment","Care of Self","Exhibiting Creativity","Eye-Hand Coordination","Identity of Numbers","Number Counting and Names","Participation in Class Discussion","Participation in Practical Activities","Phonics Sounds, Naming, Recognition","Scribbling","Singing of Rhymes","Spoken English, Fluency, Self-Expression","Stereognostic Sense (Sense of Shape)","Understanding of Topics","Writing Letters","Writing of Numbers"];
const subjects: Subject[] = names.map((name,i)=>({id:"s"+i,name,code:String(i),level:"KG",isCore:false,order:i}));
const scores = subjects.map((s,i)=>({id:"r"+i,studentId:"learner",subjectId:s.id,classId:"c1",term:1 as const,academicYear:"2026/2027",sbaRaw:80,examRaw:60,sbaScaled:40,examScaled:30,total:70,grade:"B",position:1,descriptiveAssessment:EARLY_YEARS_REMARKS[i%3]}));
const report: ReportCardData = {
  school:{id:"school",name:"TEST SCHOOL",academicYear:"2026/2027",currentTerm:1,nextTermBegins:"2027-01-05",sbaWeight:50,examWeight:50,gradingScale:{id:"default",name:"Default",grades:[]}},
  student:{id:"learner",firstName:"Test",lastName:"Learner",gender:"M",admissionNumber:"TEST01",classId:"c1",status:"ACTIVE",createdAt:""},
  class:{id:"c1",name:"Crèche",level:"KG",academicYear:"2026/2027"},
  scores, overallAverage:70,overallGrade:"B",overallPosition:1,totalStudents:10,
};
test("Crèche and Nursery aliases only, with exactly the sample remarks",()=>{
  for(const name of ["CRECHE","Crèche","NURSERY","NURSERY 1","NURSERY 2","Nursery II","Nursery 2 A"]) assert.equal(isEarlyYearsClass(name),true,name);
  for(const name of ["KG","KG1","KG 2","GRADE 1","GRADE 9","JHS 3","Primary 1","Nursery Teacher"]) assert.equal(isEarlyYearsClass(name),false,name);
  assert.deepEqual([...EARLY_YEARS_REMARKS],["EXCELLENT","VERY GOOD","GOOD"]);
  for(const value of [null,undefined,70,"B","FAIR","excellent",""]) assert.equal(earlyYearsRemark(value),null);
});
test("all 17 sample activities fit existing one-page A4 report, without numeric grading",()=>{
  for(const className of ["Crèche","NURSERY 2"]){
    const doc = generateReportPDF({...report,class:{...report.class,name:className}},subjects);
    const pdf = doc.output();
    assert.equal(doc.getNumberOfPages(),1);
    assert.equal(Math.round(doc.internal.pageSize.getWidth()),210);
    for(const text of ["TERMINAL REPORT CARD","CHILD ASSESSMENT RECORD","EXCELLENT","VERY GOOD","GOOD","NEXT TERM BEGINS","Writing of Numbers"]) assert.ok(pdf.includes(text),text);
    for(const text of ["SBA 50%","EXAM 50%","TOTAL MARKS","RESULT SUMMARY","(AVERAGE)","(POSITION)","(70.0)"]) assert.ok(!pdf.includes(text),text);
  }
});
test("old marks are not automatically converted into descriptive remarks",()=>{
  const doc=generateReportPDF({...report,scores:[{...scores[0],descriptiveAssessment:undefined}]},subjects);
  assert.ok(doc.output().includes("Not assessed"));
  assert.ok(!doc.output().includes("EXCELLENT"));
});
test("KG 2 still uses the original numerical report",()=>{
  const doc=generateReportPDF({...report,class:{...report.class,name:"KG 2"},scores:scores.slice(0,5)},subjects);
  assert.ok(doc.output().includes("SBA 50%"));
  assert.ok(doc.output().includes("TOTAL MARKS"));
  assert.ok(!doc.output().includes("CHILD ASSESSMENT RECORD"));
});
const learner={id:"learner",school_id:"school",class_id:"c1",first_name:"Test",last_name:"Learner",admission_number:"TEST01",gender:"M",status:"ACTIVE"};
const school={id:"school",name:"TEST SCHOOL",academic_year:"2026/2027",current_term:1,sba_weight:50,exam_weight:50,sba_input_max:100};
const cls={id:"c1",school_id:"school",name:"NURSERY 2",level:"KG"};
const dbSubjects=subjects.slice(0,2).map(s=>({id:s.id,name:s.name,code:s.code,school_id:"school",level:"KG",active:true,display_order:s.order,is_core:false}));
const dbScores=dbSubjects.map((s,i)=>({id:"r"+i,school_id:"school",student_id:"learner",class_id:"c1",subject_id:s.id,term:1,academic_year:"2026/2027",sba_raw:80,exam_raw:60,sba_scaled:40,exam_scaled:30,total:70,grade:"B",subject_remark:"old numeric remark",descriptive_assessment:i===0?"VERY GOOD":null}));
const snapshot={school,student:learner,class:cls,subjects:dbSubjects,scores:dbScores,class_scores:dbScores,class_students:[learner],attendance:null,affective:null,remarks:null} as unknown as ReportSnapshot;
test("report mapping and class sheets do not invent remarks, averages, or ranks",()=>{
  const data=reportData(snapshot).data;
  assert.equal(data.scores[0].descriptiveAssessment,"VERY GOOD");
  assert.equal(data.scores[1].subjectRemark,"Not assessed");
  assert.equal(data.overallPosition,undefined);
  assert.equal(data.overallGrade,"-");
  const w={school,classes:[cls],students:[learner],subjects:dbSubjects,scores:dbScores,assignments:[]} as unknown as Workspace;
  const row=buildClassResultSheet(w,"c1").rows[0];
  assert.equal(row.subjectCount,1);
  assert.equal(row.average,null);
  assert.equal(row.position,null);
});
test("historical snapshots created before descriptive assessments retain original marks",()=>{
  const older={...snapshot,scores:snapshot.scores.map(s=>{const copy={...s};delete copy.descriptive_assessment;return copy;})};
  const data=reportData(older,true).data;
  assert.equal(data.descriptiveMode,false);
  assert.equal(data.overallAverage,70);
});

// The page sends a single atomic upsert for mixed existing and new scores.
// Including id in only some rows makes PostgREST include it for the whole batch.
test("assessment bulk saves omit surrogate IDs for both descriptive and numeric rows",()=>{
  const source=readFileSync("src/app/dashboard/scores/page.tsx","utf8");
  const payload=source.slice(source.indexOf("const rows = Object.entries(edits).map"),source.indexOf("await saveRows("));
  assert.ok(payload.includes("descriptive_assessment: remark"));
  assert.ok(payload.includes("sba_raw: a"));
  assert.doesNotMatch(payload,/\bid\s*:\s*(?:existing|scoreFor)/);
  assert.doesNotMatch(payload,/\.\.\.\(existing\s*\?/);
  assert.ok(source.includes('"student_id,subject_id,term,academic_year"'));
});
