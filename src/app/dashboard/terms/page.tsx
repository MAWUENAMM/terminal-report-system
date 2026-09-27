"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Modal, Restricted } from "@/components/ui";
import { browserClient } from "@/lib/supabase/client";
import { isLeader, type Term } from "@/lib/models";
export default function Terms() {
  const { data: w, run, busy } = useWorkspace();
  const [year, setYear] = useState<string | null>(null);
  const [term, setTerm] = useState<number | null>(null);
  const [confirmClose, setConfirmClose] = useState("");
  const [reopening, setReopening] = useState<Term | null>(null);
  const [reason, setReason] = useState("");
  const [confirmReopen, setConfirmReopen] = useState("");
  if (!isLeader(w.profile.role)) return <Restricted />;
  const open = w.terms.find((t) => t.status === "OPEN");
  const ordered = [...w.terms].sort(
    (a, b) => b.academic_year.localeCompare(a.academic_year) || b.term - a.term,
  );
  const latest = ordered[0];
  const recoverable = !open && latest?.status === "CLOSED" ? latest : null;
  const suggestedYear =
    w.school.current_term === 3
      ? `${Number(w.school.academic_year.slice(0, 4)) + 1}/${Number(w.school.academic_year.slice(5)) + 1}`
      : w.school.academic_year;
  const suggestedTerm =
    w.school.current_term === 3 ? 1 : w.school.current_term + 1;
  const events = [...w.termEvents].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  function beginReopen(t: Term) {
    setReason("");
    setConfirmReopen("");
    setReopening(t);
  }
  return (
    <>
      <PageHeader
        eyebrow="Academic calendar"
        title="Terms & report archive"
        description="Close a term to preserve its reports. If it was closed by mistake, reopen the most recent term before starting a later one."
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
                Closing locks marks and attendance and saves report snapshots
                for active learners.
                {open.archive_revision > 0
                  ? ` This closure will save report version ${open.archive_revision + 1}; all earlier versions remain available.`
                  : " Check the reports before closing."}
              </p>
              <Field label="Type CLOSE to confirm">
                <input
                  className="field"
                  value={confirmClose}
                  onChange={(e) => setConfirmClose(e.target.value)}
                  autoComplete="off"
                  disabled={busy}
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
                    }, "Term closed. A new version of its reports has been archived.")
                  )
                    setConfirmClose("");
                }}
              >
                Close and archive term
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-muted">
                Closed by mistake? Reopen the latest term to continue entering
                marks, attendance and remarks. Existing archived report copies
                will be preserved.
              </p>
              {recoverable && (
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => beginReopen(recoverable)}
                >
                  Reopen Term {recoverable.term} · {recoverable.academic_year}
                </button>
              )}
            </>
          )}
        </section>
        <form
          method="post"
          className="surface space-y-4 rounded-2xl p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await run(async () => {
                const { error } = await browserClient().rpc("start_new_term", {
                  academic_year: year ?? suggestedYear,
                  term: term ?? suggestedTerm,
                });
                if (error) throw new Error(error.message);
              }, "New term opened. Learners and teaching assignments have been retained.")
            ) {
              setYear(null);
              setTerm(null);
            }
          }}
        >
          <h2 className="text-lg font-semibold">Start a new term</h2>
          <Field label="Academic year">
            <input
              className="field"
              pattern="[0-9]{4}/[0-9]{4}"
              placeholder="2026/2027"
              required
              disabled={!!open || busy}
              value={year ?? suggestedYear}
              onChange={(e) => setYear(e.target.value)}
            />
          </Field>
          <Field label="Term">
            <select
              className="field"
              disabled={!!open || busy}
              value={term ?? suggestedTerm}
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
            Starting a later term keeps your learners and classes, and prevents
            reopening earlier terms. If the previous term was closed
            accidentally, reopen it first.
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
              <th>Report versions</th>
              <th>Last closed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((t) => (
              <tr key={t.id}>
                <td>{t.academic_year}</td>
                <td>{t.term}</td>
                <td>{t.status}</td>
                <td>{t.archive_revision || "—"}</td>
                <td>
                  {t.closed_at
                    ? new Date(t.closed_at).toLocaleString("en-GB")
                    : "—"}
                </td>
                <td>
                  {t.status === "CLOSED" ? (
                    <div className="space-y-1">
                      <button
                        className="font-semibold text-[var(--g-green)] disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={busy || recoverable?.id !== t.id}
                        onClick={() => beginReopen(t)}
                      >
                        Reopen term
                      </button>
                      {recoverable?.id !== t.id && (
                        <p className="text-xs text-muted">
                          A later term has already started.
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted">Open for entries</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length > 0 && (
        <section className="surface rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Recent term activity</h2>
          <ul className="mt-4 divide-y divide-line">
            {events.slice(0, 10).map((event) => {
              const t = w.terms.find((t) => t.id === event.term_id);
              return (
                <li key={event.id} className="py-3 text-sm">
                  <p className="font-medium">
                    {event.actor_name}{" "}
                    {event.action === "REOPENED" ? "reopened" : "closed"} Term{" "}
                    {t?.term} · {t?.academic_year}
                  </p>
                  {event.reason && (
                    <p className="mt-1 text-muted">{event.reason}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {new Date(event.created_at).toLocaleString("en-GB")}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {reopening && (
        <Modal
          title={`Reopen Term ${reopening.term} · ${reopening.academic_year}`}
          onClose={() => {
            if (!busy) setReopening(null);
          }}
        >
          <form
            method="post"
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (confirmReopen !== "REOPEN") return;
              if (
                await run(async () => {
                  const { error } = await browserClient().rpc("reopen_term", {
                    term_id: reopening.id,
                    reason: reason.trim(),
                  });
                  if (error) throw new Error(error.message);
                }, "Term reopened. Entries can be edited again; earlier report versions are preserved.")
              ) {
                setReopening(null);
                setConfirmClose("");
              }
            }}
          >
            <p className="text-sm leading-6 text-muted">
              Teachers will be able to update this term’s marks, attendance and
              remarks again. Closing it again will create a new report version.
              Earlier archived copies remain available.
            </p>
            <Field label="Reason for reopening">
              <textarea
                className="field"
                required
                minLength={5}
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
                placeholder="For example: Term was closed accidentally."
              />
            </Field>
            <Field label="Type REOPEN to confirm">
              <input
                className="field"
                value={confirmReopen}
                onChange={(e) => setConfirmReopen(e.target.value)}
                autoComplete="off"
                disabled={busy}
              />
            </Field>
            <div className="flex gap-3">
              <button
                className="btn-primary"
                disabled={
                  busy || confirmReopen !== "REOPEN" || reason.trim().length < 5
                }
              >
                Reopen term
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setReopening(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
