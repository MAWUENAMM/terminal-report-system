"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpenCheck, Building2, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, LogOut, Settings2, UsersRound } from "lucide-react";
import { store } from "@/lib/store";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/students", label: "Students", icon: UsersRound },
  { href: "/dashboard/classes", label: "Classes & Subjects", icon: Building2 },
  { href: "/dashboard/scores", label: "Assessment & Scores", icon: ClipboardCheck },
  { href: "/dashboard/reports", label: "Report Cards", icon: FileText },
  { href: "/dashboard/settings", label: "School Settings", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = store.getCurrentUser();

  function logout() {
    store.setCurrentUser(null);
    router.push("/login");
  }

  return (
    <aside className="hidden lg:flex w-[270px] shrink-0 min-h-screen bg-[#101828] text-white flex-col">
      <div className="px-6 pt-7 pb-6 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#101828] shadow-lg">
            <GraduationCap size={23} strokeWidth={2.2}/>
            <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#FCD116] ring-2 ring-[#101828]" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">EduReport</div>
            <div className="text-[11px] text-slate-400">Terminal Report System</div>
          </div>
        </Link>
      </div>

      <div className="px-4 pt-6">
        <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Workspace</div>
        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={cn(
                "group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition",
                active ? "bg-white text-slate-950 shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white"
              )}>
                <Icon size={18} strokeWidth={1.9} className={active ? "text-primary-700" : "text-slate-400 group-hover:text-slate-200"} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center text-xs font-bold">
              {(user?.name || "A").split(" ").map(x=>x[0]).slice(0,2).join("")}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.name || "School User"}</div>
              <div className="truncate text-[11px] text-slate-400">{user?.role?.replaceAll("_"," ") || "Administrator"}</div>
            </div>
          </div>
          <button onClick={logout} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-400 hover:bg-white/10 hover:text-white">
            <LogOut size={15}/> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
