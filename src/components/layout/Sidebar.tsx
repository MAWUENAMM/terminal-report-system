"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  FileOutput,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings2,
  Users,
} from "lucide-react";
import { store } from "@/lib/store";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/students", label: "Students", icon: Users },
  { href: "/dashboard/classes", label: "Classes", icon: Building2 },
  { href: "/dashboard/scores", label: "Assessment", icon: ClipboardList },
  { href: "/dashboard/reports", label: "Report cards", icon: FileOutput },
  { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = store.getCurrentUser();

  function logout() {
    store.setCurrentUser(null);
    router.push("/login");
  }

  const initials = (user?.name || "U")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");

  return (
    <aside className="hidden min-h-screen w-[260px] shrink-0 flex-col bg-[var(--g-green)] text-white lg:flex">
      <div className="kente-bar" />

      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--g-green)] shadow-md">
            <GraduationCap size={20} strokeWidth={2} />
          </div>
          <div className="leading-none">
            <div className="text-[15px] font-bold tracking-tight">EduReport</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/50">
              Terminal reports
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 pt-5">
        <div className="mb-2 px-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
          Workspace
        </div>
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                active
                  ? "bg-[var(--g-gold)] text-ink shadow-md shadow-black/10"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon
                size={17}
                strokeWidth={1.75}
                className={active ? "text-ink" : "text-white/40"}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--g-gold)] text-[11px] font-bold text-ink">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{user?.name || "User"}</div>
              <div className="truncate text-[10px] capitalize text-white/50">
                {user?.role?.split("_").join(" ") || "Staff"}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
