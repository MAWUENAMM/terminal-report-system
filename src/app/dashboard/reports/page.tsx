"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Modal, Empty, Restricted } from "@/components/ui";
import { browserClient } from "@/lib/supabase/client";
import { fullName, isLeader, type Student } from "@/lib/models";
import { currentSnapshot, downloadReport } from "@/lib/reporting";
export default function Reports() {
  const { data: w, run, busy } = useWorkspace(),
    [classId, setClassId] = useState(""),
    [archive, setArchive] = useState(false),
    [archiveTerm, setArchiveTerm] = useState(""),
    [student, setStudent] = useState<Student | null>(null),
    [notes, setNotes] = useState<Record<string, string | number>>({});
  const leader = isLeader(w.profile.role),
    classes = w.classes.filter(
      (c) => leader || c.class_teacher_id === w.profile.id,
    ),
    selected = classes.some((c) => c.id === classId)
      ? classId
      : classes[0]?.id || "",
    own =
      w.profile.role === "ADMIN" ||
      classes.find((c) => c.id === selected)?.class_teacher_id === w.profile.id;
  if (!leader && !classes.length) return <Restricted />;
  const open = w.terms.some(
      (t) =>
        t.academic_year === w.school.academic_year &&
        t.term === w.school.current_term &&
        t.status === "OPEN",
    ),
    students = w.students.filter(
      (s) => s.class_id === selected && s.status === "ACTIVE",
    ),
    archives = w.archives.filter(
      (a) =>
        (!selected || a.class_id === selected) &&
        (!archiveTerm || `${a.academic_year}:${a.term}` === archiveTerm),
    );
  function edit(s: Student) {
    const x = currentSnapshot(w, s);
    setStudent(s);
    setNotes({
      days_present: x.attendance?.days_present || 0,
      total_days: x.attendance?.total_days || 0,
      conduct: x.affective?.conduct || "",
      interest: x.affective?.interest || "",
      attitude: x.affective?.attitude || "",
      talents: x.affective?.talents || "",
      class_teacher_remark: x.remarks?.class_teacher_remark || "",
      headteacher_remark: x.remarks?.headteacher_remark || "",
    });
  }
  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Reports & attendance"
        description="Review marks, record attendance and add remarks. Closed-term reports keep a snapshot of the learner, school details and results."
      />
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-2 rounded-full border border-line bg-white p-1">
          <button
            className={archive ? "btn-secondary !border-0" : "btn-primary"}
            onClick={() => setArchive(false)}
          >
            Current term
          </button>
          <button
            className={archive ? "btn-primary" : "btn-secondary !border-0"}
            onClick={() => setArchive(true)}
          >
            Report archive
          </button>
        </div>
        <div className="min-w-48">
          <Field label="Class">
            <select
              className="field"
              value={selected}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {archive && (
          <Field label="Archived term">
            <select
              className="field"
              value={archiveTerm}
              onChange={(e) => setArchiveTerm(e.target.value)}
            >
              <option value="">All archived terms</option>
              {w.terms
                .filter((t) => t.status === "CLOSED")
                .map((t) => (
                  <option key={t.id} value={`${t.academic_year}:${t.term}`}>
                    {t.academic_year} · Term {t.term}
                  </option>
                ))}
            </select>
          </Field>
        )}
      </div>
      {archive ? (
        archives.length ? (
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Academic year</th>
                  <th>Term</th>
                  <th>Archived</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {archives.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">
                      {fullName(a.snapshot.student)}
                    </td>
                    <td>{a.academic_year}</td>
                    <td>{a.term}</td>
                    <td>
                      {new Date(a.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td>
                      <button
                        className="font-semibold text-[var(--g-green)]"
                        onClick={() =>
                          void run(async () => {
                            const { data, error } = await browserClient()
                              .from("report_archives")
                              .select("snapshot")
                              .eq("id", a.id)
                              .single();
                            if (error) throw new Error(error.message);
                            await downloadReport(data.snapshot);
                          }, "Archived PDF downloaded.")
                        }
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No archived reports in this view. Closing a term creates its
            permanent report snapshots.
          </Empty>
        )
      ) : students.length ? (
        <>
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Subjects scored</th>
                  <th>Average of entered scores</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const snap = currentSnapshot(w, s),
                    average = snap.scores.length
                      ? snap.scores.reduce((n, sc) => n + Number(sc.total), 0) /
                        snap.scores.length
                      : null;
                  return (
                    <tr key={s.id}>
                      <td className="font-medium">{fullName(s)}</td>
                      <td>{snap.scores.length}</td>
                      <td>
                        {average === null ? "—" : `${average.toFixed(1)}%`}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-4">
                          <button
                            className="font-semibold text-[var(--g-green)]"
                            onClick={() => edit(s)}
                          >
                            {open ? "Attendance & remarks" : "View details"}
                          </button>
                          <button
                            disabled={!snap.scores.length || busy}
                            onClick={() =>
                              void run(
                                () => downloadReport(snap),
                                "PDF downloaded.",
                              )
                            }
                          >
                            Download PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-6 text-muted">
            Current-term PDFs reflect saved entries. Check that all required
            subjects have scores before closing the term.
          </p>
        </>
      ) : (
        <Empty>No active learners in this class.</Empty>
      )}
      {student && (
        <Modal
          title={`Attendance & remarks — ${fullName(student)}`}
          onClose={() => setStudent(null)}
        >
          <form
            method="post"
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const payload: Record<string, string | number> = {};
              if (own)
                for (const k of [
                  "days_present",
                  "total_days",
                  "conduct",
                  "interest",
                  "attitude",
                  "talents",
                  "class_teacher_remark",
                ])
                  payload[k] = notes[k];
              if (leader) payload.headteacher_remark = notes.headteacher_remark;
              const ok = await run(async () => {
                const { error } = await browserClient().rpc(
                  "save_report_notes",
                  { learner_id: student.id, notes: payload },
                );
                if (error) throw new Error(error.message);
              }, "Attendance and remarks saved.");
              if (ok) setStudent(null);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {["days_present", "total_days"].map((k) => (
                <Field
                  key={k}
                  label={
                    k === "days_present" ? "Days present" : "Total school days"
                  }
                >
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={366}
                    step={1}
                    required
                    disabled={!own || !open}
                    value={notes[k]}
                    onChange={(e) =>
                      setNotes({ ...notes, [k]: Number(e.target.value) })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {["conduct", "interest", "attitude", "talents"].map((k) => (
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                  <input
                    className="field"
                    disabled={!own || !open}
                    maxLength={150}
                    value={notes[k]}
                    onChange={(e) =>
                      setNotes({ ...notes, [k]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
            <Field label="Class teacher’s remark">
              <textarea
                className="field"
                rows={3}
                disabled={!own || !open}
                maxLength={500}
                value={notes.class_teacher_remark}
                onChange={(e) =>
                  setNotes({ ...notes, class_teacher_remark: e.target.value })
                }
              />
            </Field>
            <Field label="Headmaster’s remark">
              <textarea
                className="field"
                rows={3}
                disabled={!leader || !open}
                maxLength={500}
                value={notes.headteacher_remark}
                onChange={(e) =>
                  setNotes({ ...notes, headteacher_remark: e.target.value })
                }
              />
            </Field>
            {open && (
              <button disabled={busy} className="btn-primary">
                Save attendance & remarks
              </button>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
