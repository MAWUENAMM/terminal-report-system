"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, GraduationCap, ShieldCheck } from "lucide-react";
import { store } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("teacher@school.edu.gh");
  const [error, setError] = useState("");

  useEffect(() => { store.seed(); }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const user = store.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      setError("Account not found. Use one of the demonstration accounts below.");
      return;
    }
    store.setCurrentUser(user);
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
        <section className="hidden lg:flex relative overflow-hidden bg-[#101828] p-12 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,.25),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(0,107,63,.18),transparent_35%)]"/>
          <div className="relative flex w-full flex-col justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#101828]"><GraduationCap size={21}/></div>
              <div><div className="font-semibold">EduReport</div><div className="text-[10px] uppercase tracking-[.14em] text-slate-400">Ghana Basic Schools</div></div>
            </Link>
            <div className="max-w-xl">
              <div className="eyebrow text-slate-400">Secure school workspace</div>
              <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-[-.04em]">Everything your school needs for a clean reporting term.</h1>
              <p className="mt-6 text-base leading-7 text-slate-300">Manage learners, assessments, attendance and report generation from one focused workspace.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15}/> Designed for role-based school administration</div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-md">
            <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Back to landing page</Link>
            <div className="mb-8 lg:hidden flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101828] text-white"><GraduationCap size={21}/></div><span className="font-semibold">EduReport</span></div>
            <div className="mb-8"><div className="eyebrow">Welcome back</div><h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to your workspace</h2><p className="mt-2 text-sm text-slate-500">Select a demonstration role or enter its email.</p></div>

            <form onSubmit={handleLogin} className="surface rounded-2xl p-6 md:p-7">
              <label className="mb-2 block text-sm font-medium text-slate-700">Email address</label>
              <input className="field" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@school.edu.gh" required/>
              <label className="mb-2 mt-5 block text-sm font-medium text-slate-700">Password</label>
              <input className="field" type="password" defaultValue="demo123" />
              <div className="mt-2 text-xs text-slate-400">Prototype access — password verification is not enabled yet.</div>
              {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
              <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-700/15 hover:bg-primary-800">
                Continue <ArrowRight size={16}/>
              </button>
            </form>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[.13em] text-slate-400">Demo roles</div>
              <div className="mt-3 grid gap-2">
                {[["Admin","admin@school.edu.gh"],["Headteacher","head@school.edu.gh"],["Class Teacher","teacher@school.edu.gh"]].map(([role,mail])=>(
                  <button key={mail} onClick={()=>setEmail(mail)} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50">
                    <span className="text-sm font-medium text-slate-700">{role}</span><span className="text-xs text-slate-400">{mail}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
