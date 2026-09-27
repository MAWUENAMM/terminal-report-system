"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, GraduationCap, UsersRound } from "lucide-react";
import { store } from "@/lib/store";
import { Class } from "@/types";

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState(store.getStudents());

  useEffect(() => {
    store.seed();
    setClasses(store.getClasses());
    setStudents(store.getStudents());
  }, []);

  const total = students.filter(s=>s.status==="ACTIVE").length;
  const grouped = useMemo(() => classes.map(c => ({
    ...c,
    count: students.filter(s=>s.classId===c.id && s.status==="ACTIVE").length
  })), [classes,students]);

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><div className="eyebrow">Academic structure</div><h1 className="page-title mt-2">Classes & Subjects</h1><p className="mt-2 text-sm text-slate-500">Organise school classes, learner placement and the academic structure for each year.</p></div>
      <Link href="/dashboard/scores" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">Open assessment centre <ArrowRight size={16}/></Link>
    </header>
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="surface rounded-2xl p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><GraduationCap size={19}/></div><div className="mt-5 text-3xl font-semibold">{classes.length}</div><div className="mt-1 text-sm text-slate-500">Configured classes</div></div>
      <div className="surface rounded-2xl p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><UsersRound size={19}/></div><div className="mt-5 text-3xl font-semibold">{total}</div><div className="mt-1 text-sm text-slate-500">Active learners</div></div>
      <div className="surface rounded-2xl p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><BookOpenCheck size={19}/></div><div className="mt-5 text-3xl font-semibold">{store.getSubjects().length}</div><div className="mt-1 text-sm text-slate-500">Subjects configured</div></div>
    </div>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {grouped.map(c=><article key={c.id} className="surface group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><GraduationCap size={20}/></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.level}</span></div>
        <h2 className="mt-6 text-xl font-semibold tracking-tight">{c.name}</h2><p className="mt-1 text-sm text-slate-500">{c.academicYear}</p>
        <div className="mt-7 flex items-end justify-between border-t border-slate-100 pt-5"><div><div className="text-2xl font-semibold">{c.count}</div><div className="text-xs text-slate-400">active learners</div></div><Link href="/dashboard/students" className="text-xs font-semibold text-primary-700">View students →</Link></div>
      </article>)}
    </section>
  </div>;
}
