/**
 * Grade 9 internal MOCK grading based on the user-provided school report.
 *
 * IMPORTANT: This A-E (points 1-5) reference scale is NOT WAEC's official
 * BECE Stanine 1-9. Official WAEC grades cannot be inferred from a single
 * school's raw percentage scores.
 *
 * Aggregate composition follows the GES formula: four mandatory core subjects
 * plus two best-scoring additional subjects. Incomplete aggregates are NOT zero.
 */
export type MockBand = { min: number; grade: "A"|"B"|"C"|"D"|"E"; point: 1|2|3|4|5 };
export const SCHOOL_MOCK_BANDS: readonly MockBand[] = [
  {min:80,grade:"A",point:1},
  {min:68,grade:"B",point:2},
  {min:54,grade:"C",point:3},
  {min:40,grade:"D",point:4},
  {min:0,grade:"E",point:5},
];
export type CoreName = "English Language"|"Mathematics"|"Science"|"Social Studies";
export const MANDATORY_CORE: readonly CoreName[] = [
  "English Language","Mathematics","Science","Social Studies",
];
export type MockSubject = { subjectId: string; name: string; score: number; position?: number };
export type MockResult = MockSubject & { grade:string; point:number; core:CoreName|null; included:boolean };
export type MockAggregate = {
  rows:MockResult[];
  aggregate:number|null;
  coreTotal:number|null;
  bestTwoTotal:number|null;
  average:number|null;
  total:number|null;
  missingCore:CoreName[];
  missingElectives:number;
  complete:boolean;
};
export function isGradeNineClass(name:string):boolean {
  return /^(?:grade\s*0?9|basic\s*0?9|jhs[\s-]*3|jhs[\s-]*iii)$/i.test(name.trim());
}
export function mockBandFor(score:number):MockBand|null {
  if(!Number.isFinite(score)||score<0||score>100)return null;
  return SCHOOL_MOCK_BANDS.find(x=>score>=x.min)??null;
}
function normalized(name:string){return name.trim().toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/INTEGRATEDSCIENCE/,"SCIENCE");}
export function coreSubject(name:string):CoreName|null {
  const n=normalized(name);
  if(n==="ENGLISH"||n==="ENGLISHLANGUAGE")return "English Language";
  if(n==="MATHS"||n==="MATH"||n==="MATHEMATICS")return "Mathematics";
  if(n==="SCIENCE"||n==="GENERALSCIENCE")return "Science";
  if(n==="SOCIALSTUDIES"||n==="SOCIALSTUDY")return "Social Studies";
  return null;
}
export function computeGradeNineMock(input:readonly MockSubject[]):MockAggregate {
  const rows:MockResult[]=input.flatMap(s=>{
    const band=mockBandFor(s.score);
    if(!band)return [];
    return [{...s,grade:band.grade,point:band.point,core:coreSubject(s.name),included:false}];
  });
  const seenCore=new Map<CoreName,MockResult>();
  const duplicates=new Set<CoreName>();
  for(const row of rows){
    if(row.core){if(seenCore.has(row.core))duplicates.add(row.core);else seenCore.set(row.core,row);}
  }
  const missingCore=MANDATORY_CORE.filter(n=>!seenCore.has(n)||duplicates.has(n));
  const extras=rows.filter(x=>x.core===null).sort((a,b)=>a.point-b.point||b.score-a.score||a.name.localeCompare(b.name));
  const bestTwo=extras.slice(0,2);
  const missingElectives=Math.max(0,2-bestTwo.length);
  const complete=missingCore.length===0&&missingElectives===0;
  const coreRows=MANDATORY_CORE.map(n=>seenCore.get(n)).filter((x):x is MockResult=>x!==undefined&&!duplicates.has(x.core!));
  const coreTotal=missingCore.length?null:coreRows.reduce((n,x)=>n+x.point,0);
  const bestTwoTotal=missingElectives?null:bestTwo.reduce((n,x)=>n+x.point,0);
  if(complete)for(const row of [...coreRows,...bestTwo])row.included=true;
  const total=rows.length?rows.reduce((n,x)=>n+x.score,0):null;
  const average=total===null?null:Math.round(total/rows.length*10)/10;
  return {
    rows,aggregate:complete&&coreTotal!==null&&bestTwoTotal!==null?coreTotal+bestTwoTotal:null,
    coreTotal,bestTwoTotal,average,total,missingCore,missingElectives,complete
  };
}
/** Ascending aggregate: lower is better; equal aggregates share the same rank. */
export function aggregatePositions(values:readonly {studentId:string;aggregate:number|null}[]):Map<string,number>{
  const valid=values.filter((v):v is {studentId:string;aggregate:number}=>v.aggregate!==null&&Number.isFinite(v.aggregate))
    .sort((a,b)=>a.aggregate-b.aggregate||a.studentId.localeCompare(b.studentId));
  const result=new Map<string,number>();
  let currentRank=0,previous:number|undefined;
  valid.forEach((v,i)=>{if(v.aggregate!==previous)currentRank=i+1;result.set(v.studentId,currentRank);previous=v.aggregate;});
  return result;
}
