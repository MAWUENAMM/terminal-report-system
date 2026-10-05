"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  School,
  Sun,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { isLeader, roleNames } from "@/lib/models";
import { browserClient } from "@/lib/supabase/client";

type DashboardTheme = "light" | "dark";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { data: w, refresh, run } = useWorkspace();
  const path = usePathname();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<DashboardTheme>("light");
  const [navQuery, setNavQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<
    Array<{
      id: string;
      kind: string;
      school_name: string;
      created_at: string;
    }>
  >([]);

  useEffect(() => {
    const savedSidebar = window.localStorage.getItem("edureport:sidebar");
    const savedTheme = window.localStorage.getItem("edureport:dashboard-theme");
    if (savedSidebar === "collapsed") setCollapsed(true);
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "edureport:sidebar",
      collapsed ? "collapsed" : "expanded",
    );
    if (collapsed) setNavQuery("");
  }, [collapsed]);

  useEffect(() => {
    window.localStorage.setItem("edureport:dashboard-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!w.operator) {
      setPendingRequests([]);
      return;
    }

    let active = true;

    const loadPendingRequests = async () => {
      const { data, error } = await browserClient()
        .from("school_requests")
        .select("id,kind,school_name,created_at")
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(5);

      if (active && !error) setPendingRequests(data || []);
    };

    void loadPendingRequests();

    const refreshNotifications = () => {
      if (!document.hidden) void loadPendingRequests();
    };

    window.addEventListener("focus", refreshNotifications);
    const timer = window.setInterval(refreshNotifications, 60000);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshNotifications);
      window.clearInterval(timer);
    };
  }, [w.operator]);

  const schoolActive = w.school.active && !w.school.deleted_at;
  const platformPage = [
    "/dashboard/schools",
    "/dashboard/requests",
    "/dashboard/profile",
  ].includes(path);
  const admin = w.profile.role === "ADMIN";
  const ownClass = w.classes.some((c) => c.class_teacher_id === w.profile.id);
  const leader = isLeader(w.profile.role);

  const currentTerm = w.terms.find(
    (term) =>
      term.academic_year === w.school.academic_year &&
      term.term === w.school.current_term,
  );

  const reportAttention =
    leader || ownClass
      ? w.students.filter((student) => {
          if (student.status !== "ACTIVE") return false;

          const hasScores = w.scores.some(
            (score) =>
              score.student_id === student.id &&
              score.academic_year === w.school.academic_year &&
              score.term === w.school.current_term,
          );
          const hasAttendance = w.attendance.some(
            (record) =>
              record.student_id === student.id &&
              record.academic_year === w.school.academic_year &&
              record.term === w.school.current_term,
          );
          const hasDevelopment = w.affective.some(
            (record) =>
              record.student_id === student.id &&
              record.academic_year === w.school.academic_year &&
              record.term === w.school.current_term,
          );
          const remark = w.remarks.find(
            (record) =>
              record.student_id === student.id &&
              record.academic_year === w.school.academic_year &&
              record.term === w.school.current_term,
          );

          return (
            !hasScores ||
            !hasAttendance ||
            !hasDevelopment ||
            !remark?.class_teacher_remark?.trim() ||
            (leader && !remark?.headteacher_remark?.trim())
          );
        }).length
      : 0;

  const setupAttention =
    admin &&
    (!w.classes.length ||
      !w.students.some((student) => student.status === "ACTIVE"));

  const notificationCount =
    pendingRequests.length +
    (reportAttention > 0 ? 1 : 0) +
    (currentTerm?.status === "CLOSED" ? 1 : 0) +
    (setupAttention ? 1 : 0);

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
    {
      path: "/dashboard/students",
      label: "Learners",
      icon: Users,
      show: true,
    },
    {
      path: "/dashboard/classes",
      label: "Classes",
      icon: School,
      show: true,
    },
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
      badge: pendingRequests.length,
    },
    {
      path: "/dashboard/profile",
      label: "My profile",
      icon: UserRound,
      show: true,
    },
  ].filter(
    (item) =>
      item.show &&
      (schoolActive ||
        [
          "/dashboard/schools",
          "/dashboard/requests",
          "/dashboard/profile",
        ].includes(item.path)),
  );

  const visibleNav = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) return nav;
    return nav.filter((item) => item.label.toLowerCase().includes(query));
  }, [nav, navQuery]);

  function SidebarNavigation({
    compact = false,
    mobileMenu = false,
  }: {
    compact?: boolean;
    mobileMenu?: boolean;
  }) {
    return (
      <>
        <div
          className={
            "flex items-center " +
            (compact ? "justify-center px-3 pb-4 pt-6" : "gap-3 px-5 pb-5 pt-6")
          }
        >
          <Link
            href="/dashboard"
            onClick={() => setMobile(false)}
            className={
              "flex min-w-0 items-center " + (compact ? "justify-center" : "gap-3")
            }
            title={compact ? "EduReport" : undefined}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--g-green)] shadow-sm">
              <GraduationCap size={23} />
            </span>
            {!compact && (
              <span className="min-w-0">
                <strong className="block truncate">EduReport</strong>
                <span className="block truncate text-[9px] uppercase tracking-[0.16em] text-white/55">
                  {w.operator ? "Platform administration" : "School workspace"}
                </span>
              </span>
            )}
          </Link>
        </div>

        {!compact && (
          <>
            <div className="mx-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm shadow-inner">
              <span className="block truncate font-medium">{w.school.name}</span>
              <span className="mt-1 block text-xs text-white/55">
                {w.school.academic_year} · Term {w.school.current_term}
              </span>
            </div>

            <div className="relative mx-3 mt-4">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                value={navQuery}
                onChange={(event) => setNavQuery(event.target.value)}
                placeholder="Find a section..."
                aria-label="Search dashboard navigation"
                className="w-full rounded-xl border border-white/10 bg-black/10 py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:bg-black/15"
              />
            </div>
          </>
        )}

        {compact && !mobileMenu && (
          <button
            className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white"
            onClick={() => setCollapsed(false)}
            title="Search navigation"
            aria-label="Expand sidebar to search navigation"
          >
            <Search size={17} />
          </button>
        )}

        <nav
          aria-label="Workspace navigation"
          className={
            "flex-1 overflow-y-auto py-4 " +
            (compact ? "space-y-2 px-2" : "space-y-1 px-3")
          }
        >
          {visibleNav.map((item) => {
            const active = path === item.path;
            const badge =
              "badge" in item && Number(item.badge) > 0
                ? Number(item.badge)
                : 0;

            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobile(false)}
                title={compact ? item.label : undefined}
                aria-label={compact ? item.label : undefined}
                className={
                  "group relative flex items-center rounded-xl text-sm transition-all duration-200 " +
                  (compact
                    ? "h-11 justify-center px-2 "
                    : "gap-3 px-3 py-3 ") +
                  (active
                    ? "bg-white font-semibold text-emerald-950 shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white")
                }
              >
                <item.icon size={compact ? 19 : 17} className="shrink-0" />
                {!compact && (
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                )}
                {badge > 0 && (
                  <span
                    className={
                      compact
                        ? "absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[var(--g-gold)] px-1 text-[8px] font-bold text-slate-950 ring-2 ring-emerald-950"
                        : "grid min-w-5 place-items-center rounded-full bg-[var(--g-gold)] px-1.5 py-0.5 text-[10px] font-bold text-slate-950"
                    }
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}

          {!compact && visibleNav.length === 0 && (
            <p className="px-3 py-5 text-center text-xs text-white/45">
              No section matches “{navQuery}”.
            </p>
          )}
        </nav>

        <div
          className={
            "border-t border-white/10 " +
            (compact ? "space-y-2 p-3" : "p-4")
          }
        >
          {compact ? (
            <>
              <Link
                href="/dashboard/profile"
                title={w.profile.full_name}
                aria-label={"Open profile for " + w.profile.full_name}
                className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xs font-bold text-white transition hover:bg-white/15"
              >
                {w.profile.full_name
                  .split(" ")
                  .map((name) => name[0])
                  .slice(0, 2)
                  .join("")}
              </Link>
              <button
                className="mx-auto grid h-10 w-10 place-items-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
                title="Sign out"
                aria-label="Sign out"
                onClick={async () => {
                  await browserClient().auth.signOut();
                  window.location.assign("/login");
                }}
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <>
              <div className="truncate text-sm font-semibold">
                {w.profile.full_name}
              </div>
              <div className="mt-1 text-xs text-white/55">
                {w.operator
                  ? "Platform Administrator"
                  : roleNames[w.profile.role]}
              </div>
              <button
                className="mt-4 flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
                onClick={async () => {
                  await browserClient().auth.signOut();
                  window.location.assign("/login");
                }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div
      className={
        "dashboard-theme flex min-h-screen " +
        (theme === "dark"
          ? "dashboard-dark bg-[#0b1512]"
          : "dashboard-light bg-[#f4f7f4]")
      }
    >
      <aside
        className={
          "relative sticky top-0 hidden h-screen shrink-0 flex-col bg-[linear-gradient(180deg,#0a382b_0%,#07523b_55%,#063c2e_100%)] text-white shadow-[18px_0_50px_rgba(5,45,32,0.08)] transition-[width] duration-300 ease-out lg:flex " +
          (collapsed ? "w-[84px]" : "w-[272px]")
        }
      >
        <button
          className="absolute -right-3 top-24 z-20 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:scale-105 hover:text-emerald-700"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
        <SidebarNavigation compact={collapsed} />
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
              className="absolute right-2 top-2 z-10 p-3"
              onClick={() => setMobile(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarNavigation mobileMenu />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="dashboard-topbar sticky top-0 z-30 flex h-[72px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 shadow-[0_1px_14px_rgba(15,23,42,0.04)] backdrop-blur-xl md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="rounded-lg p-2 lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {nav.find((item) => item.path === path)?.label ||
                  "School workspace"}
              </span>
              <span className="hidden truncate text-[10px] font-medium uppercase tracking-[0.13em] text-slate-400 sm:block">
                {w.school.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="dashboard-icon-button rounded-xl border border-transparent p-2.5 text-muted transition hover:border-slate-200 hover:bg-slate-50"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div className="relative">
              <button
                className={
                  "dashboard-icon-button relative rounded-xl border p-2.5 transition " +
                  (notificationsOpen
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-transparent text-muted hover:border-slate-200 hover:bg-slate-50")
                }
                title="Notifications"
                aria-label={
                  "Notifications" +
                  (notificationCount
                    ? ", " + notificationCount + " new or actionable"
                    : "")
                }
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                {notificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="dashboard-popover absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <p className="text-sm font-bold text-slate-950">
                        Notifications
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Items that may need your attention
                      </p>
                    </div>
                    {notificationCount === 0 && (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    )}
                  </div>

                  <div className="max-h-[430px] overflow-y-auto p-2">
                    {w.operator &&
                      pendingRequests.map((request) => (
                        <Link
                          key={request.id}
                          href="/dashboard/requests"
                          onClick={() => setNotificationsOpen(false)}
                          className="flex gap-3 rounded-xl p-3 transition hover:bg-amber-50"
                        >
                          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                            <Inbox size={16} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-800">
                              {request.kind === "ACCESS"
                                ? "New school access request"
                                : "New contact request"}
                            </span>
                            <span className="mt-1 block truncate text-xs text-slate-500">
                              {request.school_name}
                            </span>
                            <span className="mt-1 block text-[10px] text-slate-400">
                              {new Date(request.created_at).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "2-digit",
                                  month: "short",
                                },
                              )}
                            </span>
                          </span>
                        </Link>
                      ))}

                    {reportAttention > 0 && (
                      <Link
                        href="/dashboard/reports"
                        onClick={() => setNotificationsOpen(false)}
                        className="flex gap-3 rounded-xl p-3 transition hover:bg-red-50"
                      >
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700">
                          <AlertTriangle size={16} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">
                            Reports need attention
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {reportAttention} active learner
                            {reportAttention === 1 ? "" : "s"} still have
                            incomplete current-term report records.
                          </span>
                        </span>
                      </Link>
                    )}

                    {currentTerm?.status === "CLOSED" && (
                      <Link
                        href="/dashboard/terms"
                        onClick={() => setNotificationsOpen(false)}
                        className="flex gap-3 rounded-xl p-3 transition hover:bg-sky-50"
                      >
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
                          <CalendarDays size={16} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">
                            Current term is closed
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            Assessment changes are locked until the term is reopened.
                          </span>
                        </span>
                      </Link>
                    )}

                    {setupAttention && (
                      <Link
                        href="/dashboard/classes"
                        onClick={() => setNotificationsOpen(false)}
                        className="flex gap-3 rounded-xl p-3 transition hover:bg-emerald-50"
                      >
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                          <School size={16} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">
                            School setup needs attention
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            Add classes and active learners to complete the
                            workspace setup.
                          </span>
                        </span>
                      </Link>
                    )}

                    {notificationCount === 0 && (
                      <div className="px-5 py-8 text-center">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          You’re all caught up
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          No current notifications require action.
                        </p>
                      </div>
                    )}
                  </div>

                  {w.operator && (
                    <Link
                      href="/dashboard/requests"
                      onClick={() => setNotificationsOpen(false)}
                      className="block border-t border-slate-100 px-5 py-3 text-center text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                    >
                      Open School Requests
                    </Link>
                  )}
                </div>
              )}
            </div>

            <button
              className="dashboard-icon-button rounded-xl border border-transparent p-2.5 text-muted transition hover:border-slate-200 hover:bg-slate-50"
              title="Refresh school data"
              aria-label="Refresh school data"
              onClick={() => void run(refresh, "School data refreshed.")}
            >
              <RefreshCw size={17} />
            </button>

            <Link
              href="/dashboard/profile"
              className="dashboard-profile-pill flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-sm shadow-sm transition hover:border-emerald-200"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--g-green)] text-xs font-bold text-white shadow-sm">
                {w.profile.full_name
                  .split(" ")
                  .map((name) => name[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span className="hidden max-w-[170px] truncate sm:inline">
                {w.profile.full_name}
              </span>
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
