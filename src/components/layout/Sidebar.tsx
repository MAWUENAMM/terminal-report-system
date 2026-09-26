"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/students", label: "Students", icon: "👨‍🎓" },
  { href: "/dashboard/classes", label: "Classes", icon: "🏫" },
  { href: "/dashboard/scores", label: "Scores / SBA", icon: "📝" },
  { href: "/dashboard/reports", label: "Report Cards", icon: "📄" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
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
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center font-bold">TR</div>
          <div>
            <div className="font-semibold text-sm">Terminal Reports</div>
            <div className="text-xs text-slate-400">Ghana Basic Schools</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition",
              pathname === item.href
                ? "bg-primary-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="text-sm font-medium truncate">{user?.name || "Guest"}</div>
        <div className="text-xs text-slate-400 mb-3">{user?.role?.replace("_", " ") || ""}</div>
        <button
          onClick={logout}
          className="w-full text-left text-sm text-slate-400 hover:text-white transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
