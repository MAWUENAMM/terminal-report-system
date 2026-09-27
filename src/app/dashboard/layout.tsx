"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { store } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";
import { User } from "@/types";

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/students": "Students",
  "/dashboard/classes": "Classes",
  "/dashboard/scores": "Assessment",
  "/dashboard/reports": "Report cards",
  "/dashboard/settings": "Settings",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    store.seed();
    const u = store.getCurrentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
          Preparing workspace…
        </div>
      </div>
    );
  }

  const initials = (user?.name || "U")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />

      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink/50" onClick={() => setMobile(false)} />
          <div className="relative h-full w-[260px] bg-ink p-4 text-white">
            <div className="mb-6 font-semibold">EduReport</div>
            <p className="text-xs text-white/50">Use a wider screen for the full sidebar.</p>
            <button
              onClick={() => setMobile(false)}
              className="mt-6 text-sm text-gold underline"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-30 border-b border-line bg-paper-elevated/90 backdrop-blur-md">
          <div className="mx-auto flex h-[60px] max-w-[1400px] items-center justify-between px-4 md:px-7">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobile(true)}
                className="rounded-md p-2 text-muted hover:bg-line/50 lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div>
                <div className="text-[14px] font-semibold tracking-tight text-ink">
                  {titles[pathname] || "Workspace"}
                </div>
                <div className="text-[11px] text-muted">School administration</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-muted md:flex">
                <Search size={13} />
                Search
              </div>
              <button className="rounded-lg p-2 text-muted hover:bg-line/40">
                <Bell size={17} />
              </button>
              <div className="ml-1 flex items-center gap-2 border-l border-line pl-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">
                  {initials}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-ink">{user?.name}</div>
                  <div className="text-[10px] text-muted">
                    {user?.role?.replaceAll("_", " ")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1400px] p-4 md:p-7">{children}</div>
      </main>
    </div>
  );
}
