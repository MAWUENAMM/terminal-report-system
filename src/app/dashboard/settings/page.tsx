"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ImagePlus, Save, Settings2 } from "lucide-react";
import { store } from "@/lib/store";
import { School } from "@/types";

export default function SettingsPage() {
  const [school,setSchool]=useState<School|null>(null); const [saved,setSaved]=useState(false);
  useEffect(()=>{store.seed();setSchool(store.getSchool());},[]);
  function save(e:React.FormEvent){e.preventDefault();if(school){store.saveSchool(school);setSaved(true);setTimeout(()=>setSaved(false),2200)}}
  if(!school) return <div className="p-8 text-sm text-slate-500">Loading school settings…</div>;
  return <div className="space-y-7">
    <header><div className="eyebrow">Administration</div><h1 className="page-title mt-2">School Settings</h1><p className="mt-2 text-sm text-slate-500">Configure the identity, academic session and assessment rules used throughout the system.</p></header>
    <form onSubmit={save} className="grid gap-5 xl:grid-cols-[1.4fr_.7fr]">
      <div className="surface rounded-2xl p-6 md:p-7 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Settings2 size={19}/></div><div><h2 className="font-semibold">School profile</h2><p className="text-xs text-slate-400">Information shown on official reports.</p></div></div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2"><label className="mb-2 block text-sm font-medium">School name</label><input className="field" value={school.name} onChange={e=>setSchool({...school,name:e.target.value})}/></div>
          <div className="md:col-span-2"><label className="mb-2 block text-sm font-medium">Address</label><input className="field" value={school.address||""} onChange={e=>setSchool({...school,address:e.target.value})}/></div>
          <div><label className="mb-2 block text-sm font-medium">District</label><input className="field" value={school.district||""} onChange={e=>setSchool({...school,district:e.target.value})}/></div>
          <div><label className="mb-2 block text-sm font-medium">Region</label><input className="field" value={school.region||""} onChange={e=>setSchool({...school,region:e.target.value})}/></div>
          <div><label className="mb-2 block text-sm font-medium">Phone</label><input className="field" value={school.phone||""} onChange={e=>setSchool({...school,phone:e.target.value})}/></div>
          <div><label className="mb-2 block text-sm font-medium">Email</label><input className="field" value={school.email||""} onChange={e=>setSchool({...school,email:e.target.value})}/></div>
          <div><label className="mb-2 block text-sm font-medium">Headteacher</label><input className="field" value={school.headteacherName||""} onChange={e=>setSchool({...school,headteacherName:e.target.value})}/></div>
        </div>
      </div>
      <div className="space-y-5">
        <div className="surface rounded-2xl p-6">
          <div className="eyebrow">Academic session</div><div className="mt-4 grid gap-4"><div><label className="mb-2 block text-sm font-medium">Academic year</label><input className="field" value={school.academicYear} onChange={e=>setSchool({...school,academicYear:e.target.value})}/></div><div><label className="mb-2 block text-sm font-medium">Current term</label><select className="field" value={school.currentTerm} onChange={e=>setSchool({...school,currentTerm:Number(e.target.value) as 1|2|3})}><option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option></select></div></div>
        </div>
        <div className="surface rounded-2xl p-6">
          <div className="eyebrow">Assessment policy</div><div className="mt-4 grid grid-cols-2 gap-3"><div><label className="mb-2 block text-xs font-medium">SBA weight</label><input className="field" type="number" min="0" max="100" value={school.sbaWeight} onChange={e=>setSchool({...school,sbaWeight:Number(e.target.value)})}/></div><div><label className="mb-2 block text-xs font-medium">Exam weight</label><input className="field" type="number" min="0" max="100" value={school.examWeight} onChange={e=>setSchool({...school,examWeight:Number(e.target.value)})}/></div></div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Combined weighting: <strong className="text-slate-700">{school.sbaWeight + school.examWeight}%</strong>. The system scales raw scores automatically.</div>
        </div>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-700/10 hover:bg-primary-800"><Save size={16}/> Save school settings</button>
        {saved&&<div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><CheckCircle2 size={16}/> Settings saved successfully.</div>}
      </div>
    </form>
  </div>;
}