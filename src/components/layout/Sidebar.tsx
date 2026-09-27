"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  FileOutput,
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
    <aside className="hidden min-h-screen w-[248px] shrink-0 flex-col border-r border-white/8 bg-ink text-white lg:flex">
      <div className="border-b border-white/8 px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-md bg-white text-[12px] font-bold text-ink">
            ER
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-ink" />
          </div>
          <div className="leading-none">
            <div className="text-[14px] font-semibold tracking-tight">EduReport</div>
            <div className="mt-0.5 text-[10px] text-white/40">Terminal reports</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 pt-5">
        <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
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
                "flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition",
                active
                  ? "bg-white text-ink"
                  : "text-white/55 hover:bg-white/6 hover:text-white"
              )}
            >
              <Icon
                size={17}
                strokeWidth={1.75}
                className={active ? "text-ink" : "text-white/35"}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/8 p-3">
        <div className="rounded-lg border border-white/8 bg-white/4 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{user?.name || "User"}</div>
              <div className="truncate text-[10px] text-white/40">
                {user?.role?.split("_").join(" ") || "Staff"}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] text-white/40 transition hover:bg-white/8 hover:text-white"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
