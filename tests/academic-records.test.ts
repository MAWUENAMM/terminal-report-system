import assert from "node:assert/strict";
import test from "node:test";
import { latestArchivedTerms, summarizeAcademicTerm, termLabel, ordinalPosition,
  type ArchivedAcademicTerm } from "../src/lib/academic-records";
import type { ReportSnapshot } from "../src/lib/models";

function archive(year: string, term: number, revision=1, className="Basic 1"): ArchivedAcademicTerm {
  const id=`${year}:${term}:${revision}`;
  return {
    id, school_id:"school",student_id:"student",
    academic_year:year,term,revision,created_at:`2026-11-${String(1+revision).padStart(2,"0")}T00:00:00Z`,
    snapshot:{
      school: {id:"school",name:"Testing Academy",academic_year:year,current_term:term},
      student:{id:"student",school_id:"school",class_id:"class1",first_name:"Ama",
        last_name:"Example",admission_number:"ST001",gender:"F",status:"ACTIVE"},
      class:{id:"class1",school_id:"school",name:className,level:"PRIMARY",academic_year:year,class_teacher_id:null},
      subjects:[
        {id:"math",school_id:"school",name:"Mathematics",display_order:1,active:true,level:"PRIMARY",is_core:true},
        {id:"eng",school_id:"school",name:"English",display_order:2,active:true,level:"PRIMARY",is_core:true},
      ],
      scores:[
        {id:"score1",school_id:"school",student_id:"student",class_id:"class1",subject_id:"math",
          total:80,sba_raw:0,exam_raw:0,sba_scaled:0,exam_scaled:0,grade:"A",term,academic_year:year},
        {id:"score2",school_id:"school",student_id:"student",class_id:"class1",subject_id:"eng",
          total:60,sba_raw:0,exam_raw:0,sba_scaled:0,exam_scaled:0,grade:"C",term,academic_year:year},
      ],
      class_students:[{id:"student"},{id:"peer"}],
      class_scores:[
        {id:"result1",school_id:"school",student_id:"student",class_id:"class1",subject_id:"math",total:80,grade:"A",term,academic_year:year,sba_raw:0,exam_raw:0,sba_scaled:0,exam_scaled:0},
        {id:"result2",school_id:"school",student_id:"student",class_id:"class1",subject_id:"eng",total:60,grade:"C",term,academic_year:year,sba_raw:0,exam_raw:0,sba_scaled:0,exam_scaled:0},
        {id:"result3",school_id:"school",student_id:"peer",class_id:"class1",subject_id:"math",total:75,grade:"B",term,academic_year:year,sba_raw:0,exam_raw:0,sba_scaled:0,exam_scaled:0},
        {id:"result4",school_id:"school",student_id:"peer",class_id:"class1",subject_id:"eng",total:65,grade:"C",term,academic_year:year,sba_raw:0,exam_raw:0,sba_scaled:0,exam_scaled:0},
      ],attendance:null,affective:null,remarks:null,
    } as ReportSnapshot,
  };
}

test("ten-year pupil history retains every closed term from Basic 1 through later classes",()=>{
  const years=Array.from({length:10},(_,i)=>`${2026+i}/${2027+i}`);
  const full=years.flatMap((year,i)=>[1,2,3].map((term)=>archive(year,term,1,`Basic ${Math.min(i+1,9)}`)));
  const latest=latestArchivedTerms(full.reverse());
  assert.equal(latest.length,30);
  assert.equal(latest[0].snapshot.class.name,"Basic 1");
  assert.equal(latest[29].snapshot.class.name,"Basic 9");
  assert.equal(latest[0].academic_year,"2026/2027");
  assert.equal(latest[29].academic_year,"2035/2036");
});

test("reopened terms retain versions but transcript selects latest archived revision only",()=>{
  const selected=latestArchivedTerms([
    archive("2027/2028",2,1),archive("2026/2027",3,2),
    archive("2026/2027",3,1),archive("2027/2028",2,3),
  ]);
  assert.deepEqual(selected.map(x=>[x.academic_year,x.term,x.revision]),[
    ["2026/2027",3,2],["2027/2028",2,3],
  ]);
});

test("historical class and subject grades come from the archive, not present enrollment",()=>{
  const row=summarizeAcademicTerm(archive("2026/2027",1));
  assert.equal(row.className,"Basic 1");
  assert.equal(row.total,140);
  assert.equal(row.average,70);
  assert.equal(row.position,1);
  assert.equal(row.subjects[0].name,"Mathematics");
  assert.equal(row.subjects[1].grade,"C");
});

test("empty archived subject results remain missing, never zero",()=>{
  const report=archive("2026/2027",2);
  report.snapshot.scores=[];
  const row=summarizeAcademicTerm(report);
  assert.equal(row.average,null);
  assert.equal(row.total,null);
  assert.equal(row.position,null);
  assert.equal(row.subjects.length,0);
});

test("historic term and ordinal labels remain readable",()=>{
  assert.equal(termLabel(2),"Second Term");
  assert.equal(ordinalPosition(1),"1st");
  assert.equal(ordinalPosition(12),"12th");
});
