import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, FileText, GraduationCap, ShieldCheck, Sparkles, UsersRound } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#101828] text-white">
              <GraduationCap size={21}/>
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-[#FCD116] ring-2 ring-white"/>
            </div>
            <div>
              <div className="font-semibold tracking-tight">EduReport</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Ghana Basic Schools</div>
            </div>
          </div>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-[#101828] px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Open system <ArrowRight size={16}/>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(37,99,235,.12),transparent_35%),radial-gradient(circle_at_10%_50%,rgba(0,107,63,.08),transparent_32%)]"/>
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <Sparkles size={14} className="text-primary-600"/> Digital assessment & terminal reporting
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-0.05em] text-slate-950 md:text-6xl">
              A better way to manage <span className="text-primary-700">school reports.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              A modern assessment platform designed around the workflow of Ghanaian basic schools—from student records and SBA entry to verified calculations and professional terminal reports.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-700/20 hover:bg-primary-800">
                Launch demonstration <ArrowRight size={17}/>
              </Link>
              <a href="#capabilities" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Explore capabilities
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600"/> Automated 50:50 scoring</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600"/> PDF report generation</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600"/> Role-based workflow</span>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[28px] bg-[#101828] p-2 shadow-2xl shadow-slate-900/20">
              <div className="rounded-[22px] bg-[#f7f9fc] p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">School overview</div>
                    <div className="mt-1 text-lg font-semibold">Akwaba Basic School</div>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Term 1 · 2025/26</div>
                </div>
                <div className="grid grid-cols-2 gap-3 py-5">
                  {[
                    ["Students","428",UsersRound],
                    ["Classes","14",GraduationCap],
                    ["Assessments","2,416",ClipboardCheck],
                    ["Reports ready","96%",FileText],
                  ].map(([label,value,Icon]: any)=>(
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between"><span className="text-xs text-slate-500">{label}</span><Icon size={16} className="text-primary-600"/></div>
                      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold">Assessment completion</span><BarChart3 size={17} className="text-slate-400"/></div>
                  <div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 w-[82%] rounded-full bg-primary-600"/></div>
                  <div className="mt-2 flex justify-between text-[11px] text-slate-500"><span>82% entered</span><span>18% remaining</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="eyebrow">Built around the school workflow</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">From raw marks to a finished report card.</h2>
            <p className="mt-3 leading-7 text-slate-500">The system is structured as an operational workspace rather than a collection of disconnected forms.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              [ClipboardCheck,"Assessment","SBA and examination entry with automatic scaling, totals and grades."],
              [UsersRound,"Student records","Central student profiles, class placement, guardians and photos."],
              [BarChart3,"Insights","Class performance, completion status and historical academic visibility."],
              [FileText,"Reports","Branded, print-ready terminal reports generated consistently."],
            ].map(([Icon,title,desc]: any)=>(
              <div key={title} className="rounded-2xl border border-slate-200 bg-[#fbfcfe] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Icon size={19}/></div>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#101828] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 md:flex-row md:items-center md:justify-between lg:px-8">
          <div><div className="font-semibold">EduReport</div><div className="mt-1 text-xs text-slate-400">Automated Terminal Report System · Ghanaian Basic Schools</div></div>
          <div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15}/> Prototype environment for stakeholder demonstration</div>
        </div>
      </footer>
    </main>
  );
}
