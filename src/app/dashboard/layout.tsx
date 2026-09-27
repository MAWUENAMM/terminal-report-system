"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  GraduationCap,
  Menu,
  Search,
  X,
  Users,
  Building2,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { store } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";
import { User, Student, Class } from "@/types";
import { cn, formatName } from "@/lib/utils";

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/students": "Students",
  "/dashboard/classes": "Classes",
  "/dashboard/scores": "Assessment",
  "/dashboard/reports": "Report cards",
  "/dashboard/settings": "Settings",
};

const mobileNav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/students", label: "Students" },
  { href: "/dashboard/classes", label: "Classes" },
  { href: "/dashboard/scores", label: "Assessment" },
  { href: "/dashboard/reports", label: "Report cards" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ students: Student[]; classes: Class[] }>({
    students: [],
    classes: [],
  });
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults({ students: [], classes: [] });
      return;
    }
    setResults(store.search(query));
    setOpen(true);
  }, [query]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--g-green)]" />
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

  const hasResults = results.students.length > 0 || results.classes.length > 0;

  function logout() {
    store.setCurrentUser(null);
    setProfileOpen(false);
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />

      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobile(false)}
          />
          <div className="relative flex h-full w-[280px] flex-col bg-[var(--g-green)] text-white">
            <div className="kente-bar" />
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[var(--g-green)]">
                  <GraduationCap size={18} />
                </div>
                <span className="font-bold">EduReport</span>
              </div>
              <button
                onClick={() => setMobile(false)}
                className="rounded-lg p-1.5 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {mobileNav.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobile(false)}
                    className={cn(
                      "block rounded-xl px-3 py-2.5 text-sm font-medium",
                      active
                        ? "bg-[var(--g-gold)] text-ink"
                        : "text-white/70 hover:bg-white/10"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-[60px] max-w-[1400px] items-center justify-between gap-4 px-4 md:px-7">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobile(true)}
                className="rounded-lg p-2 text-muted hover:bg-line/50 lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div className="hidden sm:block">
                <div className="text-[14px] font-semibold tracking-tight text-ink">
                  {titles[pathname] || "Workspace"}
                </div>
                <div className="text-[11px] text-muted">School administration</div>
              </div>
            </div>

            <div className="relative flex-1 max-w-md" ref={searchRef}>
              <div className="flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-2 text-sm">
                <Search size={15} className="shrink-0 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => query.trim() && setOpen(true)}
                  placeholder="Search students, classes…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery("");
                      setOpen(false);
                    }}
                    className="text-muted hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {open && query.trim() && (
                <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-xl shadow-black/10">
                  {!hasResults && (
                    <div className="px-4 py-6 text-center text-sm text-muted">
                      No results for &ldquo;{query}&rdquo;
                    </div>
                  )}
                  {results.students.length > 0 && (
                    <div>
                      <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                        Students
                      </div>
                      {results.students.map((s) => (
                        <Link
                          key={s.id}
                          href="/dashboard/students"
                          onClick={() => {
                            setOpen(false);
                            setQuery("");
                          }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--g-green)]/10 text-[var(--g-green)]">
                            <Users size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {formatName(s.firstName, s.lastName, s.otherNames)}
                            </div>
                            <div className="text-[11px] text-muted">{s.admissionNumber}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {results.classes.length > 0 && (
                    <div className="border-t border-line">
                      <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                        Classes
                      </div>
                      {results.classes.map((c) => (
                        <Link
                          key={c.id}
                          href="/dashboard/classes"
                          onClick={() => {
                            setOpen(false);
                            setQuery("");
                          }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--g-gold)]/20 text-ink">
                            <Building2 size={14} />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{c.name}</div>
                            <div className="text-[11px] capitalize text-muted">{c.level.toLowerCase()}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button className="rounded-full p-2 text-muted hover:bg-line/40">
                <Bell size={17} />
              </button>
              <div className="relative ml-1 border-l border-line pl-3">
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  aria-label="Open profile menu"
                  aria-expanded={profileOpen}
                  className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-paper"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--g-green)] text-[10px] font-bold text-white">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-ink">{user?.name}</div>
                    <div className="text-[10px] capitalize text-muted">
                      {user?.role?.split("_").join(" ")}
                    </div>
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-xl shadow-black/10">
                    <div className="border-b border-line bg-paper/60 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--g-green)] text-xs font-bold text-white">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">{user?.name}</div>
                          <div className="truncate text-xs text-muted">{user?.email}</div>
                          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--g-green)]">
                            {user?.role?.split("_").join(" ")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      <button
                        type="button"
                        onClick={logout}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1400px] p-4 md:p-7">{children}</div>
      </main>
    </div>
  );
}
