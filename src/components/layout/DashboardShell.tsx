"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  FileText,
  Settings,
  CalendarDays,
  UserRound,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Inbox,
  School,
  Building2,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { isLeader, roleNames } from "@/lib/models";
import { browserClient } from "@/lib/supabase/client";
export function DashboardShell({ children }: { children: ReactNode }) {
  const { data: w, refresh, run } = useWorkspace(),
    [mobile, setMobile] = useState(false);
  const path = usePathname();
  const schoolActive = w.school.active && !w.school.deleted_at;
  const platformPage = [
    "/dashboard/schools",
    "/dashboard/requests",
    "/dashboard/profile",
  ].includes(path);
  const admin = w.profile.role === "ADMIN",
    ownClass = w.classes.some((c) => c.class_teacher_id === w.profile.id),
    leader = isLeader(w.profile.role);
  const nav = [
    {
      path: "/dashboard/schools",
      label: "Schools",
      icon: Building2,
      show: w.operator,
    },
    {
      path: "/dashboard",
      label: "Overview",
      icon: LayoutDashboard,
      show: true,
    },
    { path: "/dashboard/students", label: "Learners", icon: Users, show: true },
    { path: "/dashboard/classes", label: "Classes", icon: School, show: true },
    {
      path: "/dashboard/subjects",
      label: "Subjects",
      icon: BookOpen,
      show: admin,
    },
    {
      path: "/dashboard/staff",
      label: "Staff accounts",
      icon: UserRound,
      show: admin,
    },
    {
      path: "/dashboard/scores",
      label: "Assessment",
      icon: ClipboardList,
      show:
        admin ||
        ownClass ||
        w.assignments.some((a) => a.teacher_id === w.profile.id),
    },
    {
      path: "/dashboard/reports",
      label: "Reports & attendance",
      icon: FileText,
      show: leader || ownClass,
    },
    {
      path: "/dashboard/terms",
      label: "Academic terms",
      icon: CalendarDays,
      show: leader,
    },
    {
      path: "/dashboard/settings",
      label: "School settings",
      icon: Settings,
      show: admin,
    },
    {
      path: "/dashboard/requests",
      label: "School requests",
      icon: Inbox,
      show: w.operator,
    },
    {
      path: "/dashboard/profile",
      label: "My profile",
      icon: UserRound,
      show: true,
    },
  ].filter(
    (n) =>
      n.show &&
      (schoolActive ||
        [
          "/dashboard/schools",
          "/dashboard/requests",
          "/dashboard/profile",
        ].includes(n.path)),
  );
  const navigation = (
    <>
      <Link
        href="/dashboard"
        onClick={() => setMobile(false)}
        className="flex items-center gap-3 px-5 pb-5 pt-6"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[var(--g-green)]">
          <GraduationCap size={24} />
        </span>
        <span>
          <strong className="block">EduReport</strong>
          <span className="text-[10px] uppercase tracking-widest text-white/60">
            {w.operator ? "Platform administration" : "School workspace"}
          </span>
        </span>
      </Link>
      <div className="mx-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm shadow-inner">
        <span className="block font-medium">{w.school.name}</span>
        <span className="mt-1 block text-xs text-white/60">
          {w.school.academic_year} · Term {w.school.current_term}
        </span>
      </div>
      <nav
        aria-label="Workspace navigation"
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
      >
        {nav.map((n) => (
          <Link
            key={n.path}
            href={n.path}
            onClick={() => setMobile(false)}
            className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all duration-200 ${path === n.path ? "bg-white font-semibold text-emerald-950 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          >
            <n.icon size={17} />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="text-sm font-semibold">{w.profile.full_name}</div>
        <div className="mt-1 text-xs text-white/60">
          {w.operator ? "Platform Administrator" : roleNames[w.profile.role]}
        </div>
        <button
          className="mt-4 flex items-center gap-2 text-sm text-white/70"
          onClick={async () => {
            await browserClient().auth.signOut();
            window.location.assign("/login");
          }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </>
  );
  return (
    <div className="flex min-h-screen bg-[#f4f7f4]">
      <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col bg-[linear-gradient(180deg,#0a382b_0%,#07523b_55%,#063c2e_100%)] text-white shadow-[18px_0_50px_rgba(5,45,32,0.08)] lg:flex">
        {navigation}
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-50 bg-black/45 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0"
            onClick={() => setMobile(false)}
          />
          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col bg-[linear-gradient(180deg,#0a382b_0%,#07523b_55%,#063c2e_100%)] text-white">
            <button
              className="absolute right-2 top-2 p-3"
              onClick={() => setMobile(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {navigation}
          </aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 shadow-[0_1px_14px_rgba(15,23,42,0.04)] backdrop-blur-xl md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="rounded-lg p-2 lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="truncate text-sm font-semibold">
              {nav.find((n) => n.path === path)?.label || "School workspace"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl border border-transparent p-2.5 text-muted transition hover:border-slate-200 hover:bg-slate-50"
              title="Refresh school data"
              aria-label="Refresh school data"
              onClick={() => void run(refresh, "School data refreshed.")}
            >
              <RefreshCw size={17} />
            </button>
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-sm shadow-sm transition hover:border-emerald-200"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--g-green)] text-xs font-bold text-white shadow-sm">
                {w.profile.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span className="hidden sm:inline">{w.profile.full_name}</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] space-y-7 p-4 pb-28 sm:p-5 md:p-7 md:pb-28 xl:p-8">
          {schoolActive || (w.operator && platformPage) ? (
            children
          ) : (
            <section className="surface rounded-2xl p-7">
              <h1 className="page-title">School workspace inactive</h1>
              <p className="my-4 text-muted">
                This school’s records are preserved. Use Schools to restore
                access. Your platform administration remains available.
              </p>
              <Link href="/dashboard/schools" className="btn-primary">
                Manage schools
              </Link>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
