"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Restricted } from "@/components/ui";
import { browserClient } from "@/lib/supabase/client";
import { isLeader } from "@/lib/models";
export default function Terms() {
  const { data: w, run, busy } = useWorkspace(),
    [year, setYear] = useState(
      w.school.current_term === 3
        ? `${Number(w.school.academic_year.slice(0, 4)) + 1}/${Number(w.school.academic_year.slice(5)) + 1}`
        : w.school.academic_year,
    ),
    [term, setTerm] = useState(
      w.school.current_term === 3 ? 1 : w.school.current_term + 1,
    ),
    [confirmClose, setConfirmClose] = useState("");
  if (!isLeader(w.profile.role)) return <Restricted />;
  const open = w.terms.find((t) => t.status === "OPEN");
  return (
    <>
      <PageHeader
        eyebrow="Academic calendar"
        title="Terms & report archive"
        description="Close a completed term to lock its records and preserve reports. New terms start with an empty assessment sheet while retaining the school’s learner roster."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">
            {open
              ? `Term ${open.term} · ${open.academic_year}`
              : "No term is currently open"}
          </h2>
          {open ? (
            <>
              <p className="text-sm leading-6 text-muted">
                Closing saves report snapshots for all active learners,
                including their current school details, results and remarks.
                Marks and attendance for that term become read-only. Check the
                reports first; this cannot be undone in the application.
              </p>
              <Field label="Type CLOSE to confirm">
                <input
                  className="field"
                  value={confirmClose}
                  onChange={(e) => setConfirmClose(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <button
                className="btn-primary"
                disabled={busy || confirmClose !== "CLOSE"}
                onClick={async () => {
                  if (
                    await run(async () => {
                      const { error } =
                        await browserClient().rpc("close_current_term");
                      if (error) throw new Error(error.message);
                    }, "Term closed. Its reports are now archived.")
                  )
                    setConfirmClose("");
                }}
              >
                Close and archive term
              </button>
            </>
          ) : (
            <p className="text-sm leading-6 text-muted">
              You can now start a new term. Existing archived reports will
              remain unchanged.
            </p>
          )}
        </section>
        <form
          method="post"
          className="surface space-y-4 rounded-2xl p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            await run(async () => {
              const { error } = await browserClient().rpc("start_new_term", {
                academic_year: year,
                term,
              });
              if (error) throw new Error(error.message);
            }, "New term opened. Existing learners and teaching assignments have been retained.");
          }}
        >
          <h2 className="text-lg font-semibold">Start a new term</h2>
          <Field label="Academic year">
            <input
              className="field"
              pattern="[0-9]{4}/[0-9]{4}"
              placeholder="2026/2027"
              required
              disabled={!!open}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </Field>
          <Field label="Term">
            <select
              className="field"
              disabled={!!open}
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
            >
              {[1, 2, 3].map((t) => (
                <option key={t} value={t}>
                  Term {t}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs leading-6 text-muted">
            Starting a new academic year keeps the current class groups.
            Administrators can update learner placement before entering new
            marks.
          </p>
          <button className="btn-primary" disabled={busy || !!open}>
            Start term
          </button>
        </form>
      </div>
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="data-table">
          <thead>
            <tr>
              <th>Academic year</th>
              <th>Term</th>
              <th>Status</th>
              <th>Closed on</th>
            </tr>
          </thead>
          <tbody>
            {[...w.terms]
              .sort(
                (a, b) =>
                  b.academic_year.localeCompare(a.academic_year) ||
                  b.term - a.term,
              )
              .map((t) => (
                <tr key={t.id}>
                  <td>{t.academic_year}</td>
                  <td>{t.term}</td>
                  <td>{t.status}</td>
                  <td>
                    {t.closed_at
                      ? new Date(t.closed_at).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
