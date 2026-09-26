"use client";

import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Class, Student, Subject, Score, School } from "@/types";
import { computeTotal, getGrade, computePositions } from "@/lib/grading";
import { formatName } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

export default function ScoresPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [term, setTerm] = useState<1|2|3>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<{ studentId: string; sbaRaw: string; examRaw: string; existingId?: string }[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cls = store.getClasses();
    const subs = store.getSubjects();
    const sch = store.getSchool();
    setClasses(cls);
    setSubjects(subs);
    setSchool(sch);
    if (cls.length) setSelectedClass(cls[0].id);
    if (subs.length) setSelectedSubject(subs[0].id);
    if (sch) setTerm(sch.currentTerm);
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSubject || !school) return;
    const studs = store.getStudentsByClass(selectedClass);
    setStudents(studs);
    const existing = store.getScoresByClassTerm(selectedClass, term, school.academicYear)
      .filter(s => s.subjectId === selectedSubject);
    setRows(studs.map(st => {
      const ex = existing.find(e => e.studentId === st.id);
      return {
        studentId: st.id,
        sbaRaw: ex?.sbaRaw?.toString() ?? "",
        examRaw: ex?.examRaw?.toString() ?? "",
        existingId: ex?.id,
      };
    }));
    setSaved(false);
  }, [selectedClass, selectedSubject, term, school]);

  function updateRow(studentId: string, field: "sbaRaw" | "examRaw", value: string) {
    setRows(r => r.map(row => row.studentId === studentId ? { ...row, [field]: value } : row));
  }

  function saveAll() {
    if (!school || !selectedClass || !selectedSubject) return;
    const sbaW = school.sbaWeight;
    const examW = school.examWeight;
    let allScores = store.getScores().filter(
      s => !(s.classId === selectedClass && s.subjectId === selectedSubject && s.term === term && s.academicYear === school.academicYear)
    );

    const newScores: Score[] = rows.map(row => {
      const sbaRaw = parseFloat(row.sbaRaw) || 0;
      const examRaw = parseFloat(row.examRaw) || 0;
      const computed = computeTotal(sbaRaw, 100, examRaw, 100, sbaW, examW);
      return {
        id: row.existingId || uuidv4(),
        studentId: row.studentId,
        subjectId: selectedSubject,
        classId: selectedClass,
        term,
        academicYear: school.academicYear,
        sbaRaw,
        sbaScaled: computed.sbaScaled,
        examRaw,
        examScaled: computed.examScaled,
        total: computed.total,
        grade: computed.grade,
      };
    });

    const posMap = computePositions(newScores.map(s => ({ studentId: s.studentId, total: s.total })));
    newScores.forEach(s => { s.position = posMap.get(s.studentId); });

    store.saveScores([...allScores, ...newScores]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function getPreview(row: typeof rows[0]) {
    if (!school) return null;
    const sbaRaw = parseFloat(row.sbaRaw);
    const examRaw = parseFloat(row.examRaw);
    if (isNaN(sbaRaw) && isNaN(examRaw)) return null;
    return computeTotal(sbaRaw || 0, 100, examRaw || 0, 100, school.sbaWeight, school.examWeight);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Scores & SBA</h1>
        <p className="text-slate-600">Enter class assessment and examination scores. Totals and grades are calculated automatically (SBA {school?.sbaWeight ?? 50}% + Exam {school?.examWeight ?? 50}%).</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-4 items-end shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Term</label>
          <select value={term} onChange={e => setTerm(Number(e.target.value) as 1|2|3)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
        </div>
        <button onClick={saveAll}
          className="ml-auto px-5 py-2.5 bg-primary-700 text-white font-medium rounded-lg hover:bg-primary-800 transition">
          Save All Scores
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Student</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">SBA Raw (/100)</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Exam Raw (/100)</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">SBA Scaled</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Exam Scaled</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const st = students.find(s => s.id === row.studentId);
              const preview = getPreview(row);
              return (
                <tr key={row.studentId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium">
                    {st ? formatName(st.firstName, st.lastName) : row.studentId}
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={row.sbaRaw}
                      onChange={e => updateRow(row.studentId, "sbaRaw", e.target.value)}
                      className="w-24 px-2 py-1.5 border rounded focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={row.examRaw}
                      onChange={e => updateRow(row.studentId, "examRaw", e.target.value)}
                      className="w-24 px-2 py-1.5 border rounded focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{preview ? preview.sbaScaled.toFixed(1) : "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{preview ? preview.examScaled.toFixed(1) : "—"}</td>
                  <td className="px-4 py-2.5 font-semibold">{preview ? preview.total.toFixed(1) : "—"}</td>
                  <td className="px-4 py-2.5">
                    {preview && (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-slate-100">
                        {preview.grade}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-8 text-center text-slate-500">No students in this class. Add students first.</div>
        )}
      </div>
    </div>
  );
}
