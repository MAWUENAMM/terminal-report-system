"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Building2, Plus, Search } from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { Empty, Field, Modal, PageHeader, Restricted } from "@/components/ui";
import { browserClient } from "@/lib/supabase/client";
import { staffAction } from "@/lib/api";
import type { School } from "@/lib/models";

type ManagedSchool = School & {
  created_at: string;
  staff_count: number;
  learner_count: number;
  class_count: number;
  administrators: { full_name: string; email: string; active: boolean }[];
};
type Directory = {
  items: ManagedSchool[];
  total: number;
  counts: { active: number; inactive: number; deleted: number };
};
type Operation = "ACTIVATE" | "DEACTIVATE" | "DELETE" | "RESTORE";
type SchoolEvent = {
  id: string;
  action: string;
  actor_name: string;
  reason: string;
  created_at: string;
};
const labels: Record<Operation, string> = {
  ACTIVATE: "Activate",
  DEACTIVATE: "Deactivate",
  DELETE: "Delete",
  RESTORE: "Restore",
};
const textFields = [
  ["name", "School name", 150],
  ["email", "School contact email", 254],
  ["phone", "School phone", 35],
  ["headteacher_name", "Headmaster name", 150],
  ["district", "District", 150],
  ["region", "Region", 150],
  ["address", "Address", 500],
] as const;
export default function Schools() {
  const { data: w, busy, run } = useWorkspace();
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL"),
    [page, setPage] = useState(0);
  const [editor, setEditor] = useState<ManagedSchool | "NEW" | null>(null);
  const [action, setAction] = useState<{
    school: ManagedSchool;
    operation: Operation;
  } | null>(null);
  const [credentials, setCredentials] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [history, setHistory] = useState<{
    school: ManagedSchool;
    events: SchoolEvent[];
  } | null>(null);
  const latest = useRef(0);
  const load = useCallback(async () => {
    if (!w.operator) return;
    const request = ++latest.current;
    setLoading(true);
    setError("");
    try {
      const { data, error } = await browserClient().rpc("platform_schools", {
        search_text: query,
        status_filter: filter,
        page_number: page,
      });
      if (error) throw new Error(error.message);
      if (request === latest.current) setDirectory(data as Directory);
    } catch (e) {
      if (request === latest.current)
        setError(e instanceof Error ? e.message : "Could not load schools.");
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [w.operator, query, filter, page]);
  useEffect(() => {
    let cancelled = false;
    const counter = latest;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
      counter.current++;
    };
  }, [load]);
  if (!w.operator) return <Restricted />;
  async function saveSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const details: Record<string, unknown> = Object.fromEntries(
      textFields.map(([key]) => [key, String(form.get(key) || "").trim()]),
    );
    const editing = editor && editor !== "NEW" ? editor : null;
    await run(
      async () => {
        if (editing) {
          const { error } = await browserClient().rpc(
            "platform_update_school",
            { target_id: editing.id, operation: "EDIT", details },
          );
          if (error) throw new Error(error.message);
        } else {
          details.academic_year = form.get("academic_year");
          details.current_term = Number(form.get("current_term"));
          details.active = form.get("active") === "true";
          const result = await staffAction({
            action: "create_school",
            admin_name: form.get("admin_name"),
            admin_email: form.get("admin_email"),
            details,
          });
          setCredentials(result);
        }
        setEditor(null);
        await load();
      },
      editing
        ? "School details updated."
        : "School and administrator account created.",
    );
  }
  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const form = new FormData(event.currentTarget);
    const selected = action;
    await run(
      async () => {
        const { error } = await browserClient().rpc("platform_update_school", {
          target_id: selected.school.id,
          operation: selected.operation,
          details: {
            reason: form.get("reason") || "",
            confirmation: form.get("confirmation") || "",
          },
        });
        if (error) throw new Error(error.message);
        setAction(null);
        await load();
      },
      selected.operation === "RESTORE"
        ? "School restored as inactive. Activate it when ready."
        : `School ${selected.operation.toLowerCase()}d successfully.`,
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Platform administration"
        title="Schools"
        description="Manage every approved school and control access to its workspace. School administrators keep their existing staff and classroom permissions."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/requests" className="btn-secondary">
            School requests
          </Link>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => setEditor("NEW")}
          >
            <Plus size={16} /> Add school
          </button>
        </div>
      </PageHeader>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["active", "Active"],
            ["inactive", "Inactive"],
            ["deleted", "Deleted"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="surface rounded-2xl p-4">
            <div className="text-xs text-muted">{label} schools</div>
            <div className="mt-2 text-2xl font-semibold">
              {directory?.counts[key] ?? "—"}
            </div>
          </div>
        ))}
      </div>
      <div className="surface flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(0);
            setQuery(search.trim());
          }}
          className="flex min-w-0 flex-1 items-end gap-2"
        >
          <div className="min-w-0 flex-1">
            <Field label="Find a school">
              <input
                className="field"
                maxLength={150}
                placeholder="Name, email, district or region"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
          <button className="btn-secondary" aria-label="Search schools">
            <Search size={17} />
          </button>
        </form>
        <Field label="Show">
          <select
            className="field"
            value={filter}
            onChange={(e) => {
              setPage(0);
              setFilter(e.target.value);
            }}
          >
            <option value="ALL">All current schools</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DELETED">Deleted</option>
          </select>
        </Field>
        <button
          className="btn-secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <Empty>Loading schools…</Empty>
      ) : directory?.items.length ? (
        <div className="space-y-4">
          {directory.items.map((school) => (
            <section key={school.id} className="surface rounded-2xl p-5 sm:p-6">
              <div className="flex flex-wrap justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 size={19} />
                    <h2 className="break-words text-lg font-semibold">
                      {school.name}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {[school.district, school.region]
                      .filter(Boolean)
                      .join(" · ") || "Location not added"}
                  </p>
                  <p className="mt-1 break-all text-sm text-muted">
                    {[school.email, school.phone].filter(Boolean).join(" · ") ||
                      "No school contact added"}
                  </p>
                </div>
                <span
                  className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${school.deleted_at ? "bg-red-50 text-red-800" : school.active ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}
                >
                  {school.deleted_at
                    ? "Deleted"
                    : school.active
                      ? "Active"
                      : "Inactive"}
                </span>
              </div>
              <p className="mt-4 text-sm">
                {school.learner_count} learners · {school.class_count} classes ·{" "}
                {school.staff_count} staff · {school.academic_year}, Term{" "}
                {school.current_term}
              </p>
              <div className="mt-3 space-y-1 text-sm text-muted">
                {school.administrators.map((admin) => (
                  <p className="break-words" key={admin.email}>
                    Administrator: {admin.full_name} · {admin.email}
                    {!admin.active && " (staff account inactive)"}
                  </p>
                ))}
              </div>
              {school.status_reason && (
                <p className="mt-3 rounded-lg bg-paper p-3 text-sm">
                  Latest status note: {school.status_reason}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {school.deleted_at ? (
                  <button
                    disabled={busy}
                    className="btn-primary"
                    onClick={() => setAction({ school, operation: "RESTORE" })}
                  >
                    Restore school
                  </button>
                ) : (
                  <>
                    <button
                      disabled={busy}
                      className="btn-secondary"
                      onClick={() => setEditor(school)}
                    >
                      Edit details
                    </button>
                    <button
                      disabled={busy}
                      className={
                        school.active ? "btn-secondary" : "btn-primary"
                      }
                      onClick={() =>
                        setAction({
                          school,
                          operation: school.active ? "DEACTIVATE" : "ACTIVATE",
                        })
                      }
                    >
                      {school.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      disabled={busy}
                      className="btn-secondary text-red-700"
                      onClick={() => setAction({ school, operation: "DELETE" })}
                    >
                      Delete school
                    </button>
                  </>
                )}
                <button
                  disabled={busy}
                  className="btn-secondary"
                  onClick={() =>
                    void run(async () => {
                      const { data, error } = await browserClient()
                        .from("school_events")
                        .select("id,action,actor_name,reason,created_at")
                        .eq("school_id", school.id)
                        .order("created_at", { ascending: false })
                        .limit(50);
                      if (error) throw new Error(error.message);
                      setHistory({ school, events: data || [] });
                    }, "")
                  }
                >
                  History
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        !error && (
          <Empty>
            No schools match this view. Add a school or approve an access
            request to create a workspace.
          </Empty>
        )
      )}
      {directory && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>
            {directory.total} matching schools · Page {page + 1}
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              disabled={!page || loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="btn-secondary"
              disabled={loading || (page + 1) * 25 >= directory.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {editor && (
        <Modal
          title={editor === "NEW" ? "Add a school" : "Edit school details"}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form onSubmit={saveSchool} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {textFields.map(([key, label, max]) => (
                <Field key={key} label={label}>
                  <input
                    className="field"
                    name={key}
                    type={key === "email" ? "email" : "text"}
                    required={key === "name"}
                    minLength={key === "name" ? 2 : undefined}
                    maxLength={max}
                    defaultValue={editor === "NEW" ? "" : editor[key] || ""}
                  />
                </Field>
              ))}
            </div>
            {editor === "NEW" ? (
              <>
                <fieldset className="space-y-4 rounded-xl border border-line p-4">
                  <legend className="px-1 text-sm font-semibold">
                    First school administrator
                  </legend>
                  <p className="text-sm text-muted">
                    Use a unique email that does not already have an account. An
                    initial password is shown after creation; they must change
                    it on first sign-in.
                  </p>
                  <Field label="Administrator full name">
                    <input
                      name="admin_name"
                      className="field"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </Field>
                  <Field label="Administrator sign-in email">
                    <input
                      name="admin_email"
                      type="email"
                      className="field"
                      required
                      maxLength={254}
                      autoComplete="off"
                    />
                  </Field>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Academic year">
                    <input
                      name="academic_year"
                      className="field"
                      required
                      pattern="[0-9]{4}/[0-9]{4}"
                      defaultValue={w.school.academic_year}
                      placeholder="2026/2027"
                    />
                  </Field>
                  <Field label="First term">
                    <select
                      name="current_term"
                      className="field"
                      defaultValue="1"
                    >
                      <option value="1">Term 1</option>
                      <option value="2">Term 2</option>
                      <option value="3">Term 3</option>
                    </select>
                  </Field>
                  <Field label="Workspace access">
                    <select name="active" className="field" defaultValue="true">
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </Field>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">
                School contact details do not change staff sign-in emails.
                Academic years and terms are managed through the school’s
                Academic terms page.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                className="btn-secondary"
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
              <button disabled={busy} className="btn-primary">
                {busy
                  ? "Saving…"
                  : editor === "NEW"
                    ? "Create school & administrator"
                    : "Save school details"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {action && (
        <Modal
          title={`${labels[action.operation]} ${action.school.name}`}
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          <form className="space-y-5" onSubmit={changeStatus}>
            <p className="text-sm leading-7 text-muted">
              {action.operation === "DEACTIVATE"
                ? "All school staff will lose access to school records, including existing signed-in sessions. Records and accounts will be preserved until you reactivate the school."
                : action.operation === "DELETE"
                  ? "This removes the school from the current directory and blocks staff access. Records and accounts are preserved in Deleted schools, where you can restore them."
                  : action.operation === "RESTORE"
                    ? "The school will return to the directory as Inactive. Its records and accounts will remain intact. Activate it separately when it should go live."
                    : "Active staff accounts will regain access using their existing sign-in details and assigned roles."}
            </p>
            {action.school.id === w.school.id &&
              (action.operation === "DEACTIVATE" ||
                action.operation === "DELETE") && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  This is your own school workspace. Your platform
                  administration will remain available.
                </p>
              )}
            <Field
              label={`Reason${action.operation === "DELETE" || action.operation === "DEACTIVATE" ? " (required)" : " (optional)"}`}
            >
              <textarea
                name="reason"
                className="field"
                rows={3}
                maxLength={500}
                minLength={
                  action.operation === "DELETE" ||
                  action.operation === "DEACTIVATE"
                    ? 5
                    : undefined
                }
                required={
                  action.operation === "DELETE" ||
                  action.operation === "DEACTIVATE"
                }
              />
            </Field>
            {action.operation === "DELETE" && (
              <Field label={`Type “${action.school.name}” to confirm`}>
                <input
                  className="field"
                  name="confirmation"
                  required
                  autoComplete="off"
                  maxLength={150}
                />
              </Field>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : `${labels[action.operation]} school`}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {credentials && (
        <Modal
          title="School administrator sign-in"
          onClose={() => setCredentials(null)}
        >
          <p className="text-sm leading-7 text-muted">
            Save these details and share them privately with the verified
            administrator. They must change this password on first sign-in.
          </p>
          <div className="my-5 space-y-3 rounded-xl bg-paper p-4">
            <p className="break-all">
              Email: <strong>{credentials.email}</strong>
            </p>
            <p className="break-all">
              Initial password: <code>{credentials.temporaryPassword}</code>
            </p>
          </div>
          <button className="btn-primary" onClick={() => setCredentials(null)}>
            I have saved the details
          </button>
        </Modal>
      )}
      {history && (
        <Modal
          title={`History: ${history.school.name}`}
          onClose={() => setHistory(null)}
        >
          <p className="mb-4 text-sm text-muted">
            Most recent 50 platform changes. History starts when school
            management was enabled.
          </p>
          <div className="space-y-4">
            {history.events.length ? (
              history.events.map((entry) => (
                <div key={entry.id} className="rounded-xl bg-paper p-4">
                  <p className="text-sm font-semibold">
                    {entry.action.toLowerCase()} · {entry.actor_name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(entry.created_at).toLocaleString("en-GB")}
                  </p>
                  {entry.reason && (
                    <p className="mt-2 text-sm">{entry.reason}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">
                No platform changes recorded yet.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
