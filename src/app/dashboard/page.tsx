"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, BookOpenCheck, ClipboardCheck, FileText, GraduationCap, TrendingUp, UsersRound } from "lucide-react";
import { store } from "@/lib/store";
import { School, Student, Class, Score } from "@/types";

export default function DashboardPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [scores, setScores] = useState<Score[]>([]);

  useEffect(() => {
    store.seed();
    setSchool(store.getSchool());
    setStudents(store.getStudents());
    setClasses(store.getClasses());
    setScores(store.getScores());
  }, []);

  const activeStudents = students.filter(s => s.status === "ACTIVE");
  const completion = activeStudents.length ? Math.min(100, Math.round((scores.length / Math.max(1, activeStudents.length * 5)) * 100)) : 0;
  const average = scores.length ? (scores.reduce((a,s)=>a+s.total,0)/scores.length).toFixed(1) : "0.0";

  const classRows = useMemo(() => classes.map(c => ({
    ...c,
    count: activeStudents.filter(s=>s.classId===c.id).length,
    avg: (() => { const x=scores.filter(s=>s.classId===c.id); return x.length ? (x.reduce((a,s)=>a+s.total,0)/x.length).toFixed(1) : "—"; })()
  })), [classes,activeStudents,scores]);

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">School overview</div>
          <h1 className="page-title mt-2">{school?.name || "School Dashboard"}</h1>
          <p className="mt-2 text-sm text-slate-500">{school?.academicYear || "Academic year"} · Term {school?.currentTerm || 1} · {school?.district || "School administration"}</p>
        </div>
        <Link href="/dashboard/reports" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-700/10 hover:bg-primary-800">
          Open report centre <ArrowRight size={16}/>
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active students",activeStudents.length,UsersRound,"Learner records"],
          ["Classes",classes.length,GraduationCap,"Configured classes"],
          ["Scores entered",scores.length,ClipboardCheck,"Assessment records"],
          ["Class average",average+"%",TrendingUp,"Across entered scores"],
        ].map(([label,value,Icon,sub]:any)=>(
          <div key={label} className="surface rounded-2xl p-5">
            <div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Icon size={19}/></div><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Live</span></div>
            <div className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
            <div className="mt-1 text-sm font-medium text-slate-700">{label}</div>
            <div className="mt-1 text-xs text-slate-400">{sub}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_.8fr]">
        <div className="surface rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div><div className="eyebrow">Academic progress</div><h2 className="mt-1 text-lg font-semibold">Assessment completion</h2></div>
            <BarChart3 size={19} className="text-slate-400"/>
          </div>
          <div className="mt-7 flex items-end justify-between"><div className="text-4xl font-semibold tracking-tight">{completion}%</div><div className="text-xs text-slate-500">{scores.length} records captured</div></div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary-600 transition-all" style={{width:`${completion}%`}}/></div>
          <div className="mt-3 flex justify-between text-xs text-slate-400"><span>Data entry progress</span><span>Target: complete term records</span></div>
        </div>

        <div className="rounded-2xl bg-[#101828] p-6 text-white shadow-xl shadow-slate-900/10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><FileText size={19}/></div>
          <div className="mt-8 text-lg font-semibold">Ready to issue reports?</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">Review scores, attendance and remarks before generating branded terminal reports.</p>
          <Link href="/dashboard/reports" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">Go to reports <ArrowRight size={15}/></Link>
        </div>
      </section>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div><div className="eyebrow">School structure</div><h2 className="mt-1 text-lg font-semibold">Classes at a glance</h2></div>
          <Link href="/dashboard/classes" className="text-xs font-semibold text-primary-700 hover:underline">Manage classes</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {classRows.map(c=>(
            <div key={c.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/70">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><BookOpenCheck size={18}/></div>
              <div className="min-w-0 flex-1"><div className="font-medium text-slate-800">{c.name}</div><div className="text-xs text-slate-400">{c.level} · {c.count} students</div></div>
              <div className="text-right"><div className="text-sm font-semibold text-slate-800">{c.avg}{c.avg!=="—" ? "%" : ""}</div><div className="text-[10px] uppercase tracking-wider text-slate-400">Average</div></div>
            </div>
          ))}
          {classRows.length===0 && <div className="px-6 py-12 text-center text-sm text-slate-500">No classes configured yet.</div>}
        </div>
      </section>
    </div>
  );
}
