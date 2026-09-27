"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Menu, Search, ShieldCheck } from "lucide-react";
import { store } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";
import { User } from "@/types";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router=useRouter(); const pathname=usePathname(); const [user,setUser]=useState<User|null>(null); const [ready,setReady]=useState(false); const [mobile,setMobile]=useState(false);
  useEffect(()=>{store.seed();const u=store.getCurrentUser();if(!u){router.replace("/login");return}setUser(u);setReady(true)},[router]);
  if(!ready)return <div className="min-h-screen grid place-items-center bg-[#f5f7fb]"><div className="flex items-center gap-3 text-sm text-slate-500"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary-600"/>Preparing your workspace…</div></div>;
  const titles:Record<string,string>={"/dashboard":"Overview","/dashboard/students":"Students","/dashboard/classes":"Classes & Subjects","/dashboard/scores":"Assessment & Scores","/dashboard/reports":"Terminal Reports","/dashboard/settings":"School Settings"};
  return <div className="flex min-h-screen bg-[#f5f7fb]">
    <Sidebar/>
    {mobile&&<div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-slate-950/40" onClick={()=>setMobile(false)}/><div className="relative h-full w-[280px] bg-[#101828]"><div className="p-4 text-white font-semibold">EduReport</div></div></div>}
    <main className="min-w-0 flex-1 overflow-auto">
      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3"><button onClick={()=>setMobile(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu size={20}/></button><div><div className="text-sm font-semibold text-slate-800">{titles[pathname]||"Workspace"}</div><div className="text-[11px] text-slate-400">School administration workspace</div></div></div>
          <div className="flex items-center gap-2"><div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400"><Search size={14}/> Search workspace</div><button className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"><Bell size={18}/></button><div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{(user?.name||"U").split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div className="hidden sm:block"><div className="text-xs font-semibold text-slate-700">{user?.name}</div><div className="text-[10px] text-slate-400 flex items-center gap-1"><ShieldCheck size={10}/>{user?.role?.replaceAll("_"," ")}</div></div></div></div>
        </div>
      </div>
      <div className="mx-auto max-w-[1500px] p-5 md:p-8">{children}</div>
    </main>
  </div>;
}
