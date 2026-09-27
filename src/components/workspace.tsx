"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { browserClient } from "@/lib/supabase/client";
import type { Profile, Workspace } from "@/lib/models";
type Context = {
  data: Workspace;
  refresh: () => Promise<void>;
  busy: boolean;
  run: (task: () => Promise<unknown>, success?: string) => Promise<boolean>;
};
const WorkspaceContext = createContext<Context | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace is unavailable.");
  return value;
}
async function all(
  table: string,
  term?: { academic_year: string; current_term: number },
) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = browserClient()
      .from(table)
      .select(
        table === "report_archives"
          ? "id,school_id,student_id,class_id,academic_year,term,created_at,revision,snapshot:snapshot->student"
          : "*",
      )
      .order("id")
      .range(offset, offset + 999);
    if (term)
      query = query
        .eq("academic_year", term.academic_year)
        .eq("term", term.current_term);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(
      ...(table === "report_archives"
        ? data.map((r: any) => ({ ...r, snapshot: { student: r.snapshot } }))
        : data),
    );
    if (data.length < 1000) return rows;
  }
}
export function WorkspaceProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const client = browserClient();
    const { data: p, error: pError } = await client
      .from("school_users")
      .select("*")
      .eq("auth_user_id", profile.auth_user_id)
      .single();
    if (pError || !p?.active) {
      await client.auth.signOut();
      window.location.assign("/login?error=inactive");
      return;
    }
    if (p.must_change_password) {
      window.location.assign("/account/password");
      return;
    }
    const school = await client
      .from("schools")
      .select("*")
      .eq("id", p.school_id)
      .single();
    if (school.error) throw new Error(school.error.message);
    const results = await Promise.all([
      all("school_users"),
      all("classes"),
      all("subjects"),
      all("class_subjects"),
      all("students"),
      all("scores", school.data),
      all("attendance", school.data),
      all("affective_records", school.data),
      all("remarks", school.data),
      all("academic_terms"),
      all("report_archives"),
      all("term_events"),
      client
        .from("platform_operators")
        .select("auth_user_id")
        .eq("auth_user_id", p.auth_user_id)
        .maybeSingle(),
    ]);
    const [
      staff,
      classes,
      subjects,
      assignments,
      students,
      scores,
      attendance,
      affective,
      remarks,
      terms,
      archives,
      termEvents,
      operator,
    ] = results;

    setData({
      profile: p,
      school: school.data,
      staff,
      classes,
      subjects,
      assignments,
      students,
      scores,
      attendance,
      affective,
      remarks,
      terms,
      archives,
      termEvents,
      operator: !!operator.data,
    } as Workspace);
  }, [profile.auth_user_id]);
  useEffect(() => {
    // Data is fetched asynchronously; no state update happens during effect setup.
    void Promise.resolve()
      .then(refresh)
      .catch((e) => setError(e.message));
    const focus = () => {
      if (document.hidden) return;
      void refresh().catch((e) => setError(e.message));
    };
    window.addEventListener("focus", focus);
    const id = setInterval(focus, 30000);
    return () => {
      window.removeEventListener("focus", focus);
      clearInterval(id);
    };
  }, [refresh]);
  async function run(
    task: () => Promise<unknown>,
    success = "Saved successfully.",
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      await refresh();
      setNotice(success);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="mx-auto max-w-xl p-10">
        <h1 className="page-title">Opening your workspace</h1>
        {error ? (
          <>
            <p role="alert" className="mt-4 text-red-700">
              {error}
            </p>
            <button
              className="btn-primary mt-4"
              onClick={() => void refresh().catch((e) => setError(e.message))}
            >
              Try again
            </button>
          </>
        ) : (
          <p className="mt-4 text-muted">
            Loading your school and assigned records…
          </p>
        )}
      </div>
    );
  return (
    <WorkspaceContext.Provider value={{ data, refresh, busy, run }}>
      {(error || notice) && (
        <div
          className={`fixed bottom-5 left-1/2 z-[100] w-[min(92vw,640px)] -translate-x-1/2 rounded-xl border px-5 py-4 shadow-xl ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900"}`}
          role={error ? "alert" : "status"}
        >
          <div className="flex items-start justify-between gap-4">
            <span>{error || notice}</span>
            <button
              aria-label="Dismiss message"
              onClick={() => {
                setError("");
                setNotice("");
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {children}
    </WorkspaceContext.Provider>
  );
}
