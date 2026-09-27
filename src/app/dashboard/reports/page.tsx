"use client";

import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Class, Student, Subject, School, ReportCardData } from "@/types";
import { computeOverallAverage, getGrade, computePositions } from "@/lib/grading";
import { formatName } from "@/lib/utils";
import { generateReportPDF } from "@/lib/report-pdf";
import { v4 as uuidv4 } from "uuid";
import { CheckCircle2, Download, FileText, Search, Sparkles } from "lucide-react";

export default function ReportsPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [term, setTerm] = useState<1|2|3>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const cls = store.getClasses();
    const sch = store.getSchool();
    setClasses(cls);
    setSchool(sch);
    setSubjects(store.getSubjects());
    if (cls.length) setSelectedClass(cls[0].id);
    if (sch) setTerm(sch.currentTerm);
  }, []);

  useEffect(() => {
    if (selectedClass) setStudents(store.getStudentsByClass(selectedClass));
  }, [selectedClass]);

  function buildReportData(student: Student): ReportCardData | null {
    if (!school) return null;
    const cls = classes.find(c => c.id === selectedClass);
    if (!cls) return null;
    const scores = store.getScoresByClassTerm(selectedClass, term, school.academicYear)
      .filter(s => s.studentId === student.id);
    if (scores.length === 0) return null;

    const allStudents = store.getStudentsByClass(selectedClass);
    const studentAverages = allStudents.map(st => {
      const stScores = store.getScoresByClassTerm(selectedClass, term, school.academicYear)
        .filter(s => s.studentId === st.id);
      return { studentId: st.id, total: computeOverallAverage(stScores) };
    }).filter(x => x.total > 0);
    const posMap = computePositions(studentAverages);
    const overallAverage = computeOverallAverage(scores);
    const overallGrade = getGrade(overallAverage).grade;
    const attendance = store.getAttendance().find(a => a.studentId === student.id && a.term === term && a.academicYear === school.academicYear);
    const affective = store.getAffective().find(a => a.studentId === student.id && a.term === term && a.academicYear === school.academicYear);
    const remarks = store.getRemarks().find(r => r.studentId === student.id && r.term === term && r.academicYear === school.academicYear);

    return {
      student, school, class: cls, scores, attendance, affective, remarks,
      overallAverage, overallGrade,
      overallPosition: posMap.get(student.id),
      totalStudents: allStudents.length,
    };
  }

  function downloadOne(student: Student) {
    const data = buildReportData(student);
    if (!data) {
      setMessage("No scores found for " + formatName(student.firstName, student.lastName));
      return;
    }
    const doc = generateReportPDF(data, subjects);
    doc.save("Report_" + student.admissionNumber + "_" + school?.academicYear + "_T" + term + ".pdf");
    setMessage("Downloaded report for " + formatName(student.firstName, student.lastName));
  }

  function downloadAll() {
    let count = 0;
    students.forEach(st => {
      const data = buildReportData(st);
      if (data) {
        generateReportPDF(data, subjects).save("Report_" + st.admissionNumber + "_" + school?.academicYear + "_T" + term + ".pdf");
        count++;
      }
    });
    setMessage("Generated " + count + " report(s)");
  }

  function ensureDemoRemarks() {
    if (!school) return;
    const remarks = store.getRemarks();
    const att = store.getAttendance();
    const aff = store.getAffective();
    let changed = false;
    students.forEach(st => {
      if (!remarks.find(r => r.studentId === st.id && r.term === term)) {
        remarks.push({
          id: uuidv4(), studentId: st.id, term, academicYear: school.academicYear,
          classTeacherRemark: "A hardworking pupil who participates actively in class. Keep it up.",
          headteacherRemark: "Promising performance. Continue to work hard.",
        });
        changed = true;
      }
      if (!att.find(a => a.studentId === st.id && a.term === term)) {
        att.push({ id: uuidv4(), studentId: st.id, term, academicYear: school.academicYear, daysPresent: 55 + Math.floor(Math.random() * 10), totalDays: 65 });
        changed = true;
      }
      if (!aff.find(a => a.studentId === st.id && a.term === term)) {
        aff.push({ id: uuidv4(), studentId: st.id, term, academicYear: school.academicYear, conduct: "Good", interest: "High", attitude: "Positive", talents: "Sports, Music" });
        changed = true;
      }
    });
    if (changed) {
      store.saveRemarks(remarks);
      store.saveAttendance(att);
      store.saveAffective(aff);
      setMessage("Sample attendance, conduct and remarks added.");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Report Cards</h1>
        <p className="text-slate-600">Generate professional GES-style terminal report PDFs</p>
      </div>
      <div className="surface rounded-2xl p-4 md:p-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="field min-w-[160px]">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Term</label>
          <select value={term} onChange={e => setTerm(Number(e.target.value) as 1|2|3)} className="px-3 py-2 border rounded-lg text-sm">
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
        </div>
        <button onClick={ensureDemoRemarks} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"><CheckCircle2 size={15}/> Prepare demo data</button>
        <button onClick={downloadAll} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"><Download size={15}/> Download all</button>
      </div>
      {message && <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><CheckCircle2 size={16}/>{message}</div>}
      <div className="surface overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Learner</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Admission no.</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Completion</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Report</th>
            </tr>
          </thead>
          <tbody>
            {students.map(st => {
              const scoreCount = school ? store.getScoresByClassTerm(selectedClass, term, school.academicYear).filter(s => s.studentId === st.id).length : 0;
              return (
                <tr key={st.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-medium flex items-center gap-3">
                    {st.photoUrl ? <img src={st.photoUrl} className="w-8 h-8 rounded-full object-cover" alt="" /> : <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500">{st.firstName[0]}</div>}
                    {formatName(st.firstName, st.lastName)}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{st.admissionNumber}</td>
                  <td className="px-5 py-4"><span className={"inline-flex rounded-full px-2.5 py-1 text-xs font-semibold "+(scoreCount>0?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700")}>{scoreCount} subjects entered</span></td>
                  <td className="px-4 py-3">
                    <button onClick={() => downloadOne(st)} disabled={scoreCount === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><Download size={13}/> PDF</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
