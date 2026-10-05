"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  Bell,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { isLeader, roleNames } from "@/lib/models";
import { browserClient } from "@/lib/supabase/client";
export function DashboardShell({ children }: { children: ReactNode }) {
  const { data: w, refresh, run } = useWorkspace(),
    [mobile, setMobile] = useState(false),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [pendingRequests, setPendingRequests] = useState<
      Array<{
        id: string;
        kind: string;
        school_name: string;
        created_at: string;
      }>
    >([]);
  const path = usePathname();

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
    const timer = setInterval(refreshNotifications, 60000);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshNotifications);
      clearInterval(timer);
    };
  }, [w.operator]);
  const schoolActive = w.school.active && !w.school.deleted_at;
  const platformPage = [
    "/dashboard/schools",
    "/dashboard/requests",
    "/dashboard/profile",
  ].includes(path);
  const admin = w.profile.role === "ADMIN",
    ownClass = w.classes.some((c) => c.class_teacher_id === w.profile.id),
    leader = isLeader(w.profile.role);
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
    admin && (!w.classes.length || !w.students.some((student) => student.status === "ACTIVE"));

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
      badge: pendingRequests.length,
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
            <span className="min-w-0 flex-1 truncate">{n.label}</span>
            {"badge" in n && Number(n.badge) > 0 && (
              <span
                className={`grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  path === n.path
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-[var(--g-gold)] text-slate-950"
                }`}
              >
                {Number(n.badge) > 99 ? "99+" : Number(n.badge)}
              </span>
            )}
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
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <button
                className={`relative rounded-xl border p-2.5 transition ${
                  notificationsOpen
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-transparent text-muted hover:border-slate-200 hover:bg-slate-50"
                }`}
                title="Notifications"
                aria-label={`Notifications${notificationCount ? `, ${notificationCount} new or actionable` : ""}`}
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
                <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <p className="text-sm font-bold text-slate-950">Notifications</p>
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
                              {new Date(request.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                              })}
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
                            {reportAttention === 1 ? "" : "s"} still have incomplete
                            current-term report records.
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
                            Add classes and active learners to complete the workspace setup.
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
