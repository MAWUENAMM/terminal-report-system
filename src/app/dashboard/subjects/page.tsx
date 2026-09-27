"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Modal, Restricted, Empty } from "@/components/ui";
import { saveRows, updateRow, deleteRow } from "@/lib/api";
import type { Subject } from "@/lib/models";
export default function Subjects() {
  const { data: w, run, busy } = useWorkspace(),
    [draft, setDraft] = useState<Partial<Subject> | null>(null),
    [classId, setClassId] = useState(""),
    [subjectId, setSubjectId] = useState(""),
    [teacherId, setTeacherId] = useState("");
  if (w.profile.role !== "ADMIN") return <Restricted />;
  const cls = w.classes.find((c) => c.id === classId);
  return (
    <>
      <PageHeader
        eyebrow="Curriculum"
        title="Subjects & teaching assignments"
        description="Choose subjects for KG, Primary and JHS, then connect each subject to its class and teacher."
      >
        <button
          className="btn-primary"
          onClick={() =>
            setDraft({
              name: "",
              level: "ALL",
              active: true,
              is_core: false,
              display_order: 1,
            })
          }
        >
          Add subject
        </button>
      </PageHeader>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Subject catalogue</h2>
          {w.subjects.length ? (
            w.subjects.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 border-b border-line py-3"
              >
                <div>
                  <div className="font-medium">
                    {s.name}{" "}
                    {!s.active && (
                      <span className="text-xs text-muted">(inactive)</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {s.level} · {s.code || "No code"}
                    {s.is_core ? " · Core" : ""}
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <button
                    className="font-semibold text-[var(--g-green)]"
                    onClick={() => setDraft(s)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-muted"
                    onClick={() =>
                      void run(
                        () =>
                          updateRow("subjects", s.id, { active: !s.active }),
                        s.active
                          ? "Subject deactivated. Existing reports are retained."
                          : "Subject activated.",
                      )
                    }
                  >
                    {s.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Add your first subject.</p>
          )}
        </section>
        <section className="surface rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Assign a subject</h2>
          <form
            method="post"
            className="mt-5 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const existing = w.assignments.find(
                (a) => a.class_id === classId && a.subject_id === subjectId,
              );
              if (
                await run(
                  () =>
                    saveRows(
                      "class_subjects",
                      [
                        {
                          ...(existing ? { id: existing.id } : {}),
                          school_id: w.school.id,
                          class_id: classId,
                          subject_id: subjectId,
                          teacher_id: teacherId || null,
                        },
                      ],
                      "class_id,subject_id",
                    ),
                  "Teaching assignment saved.",
                )
              ) {
                setSubjectId("");
                setTeacherId("");
              }
            }}
          >
            <Field label="Class">
              <select
                className="field"
                required
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSubjectId("");
                }}
              >
                <option value="">Select class</option>
                {w.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subject">
              <select
                className="field"
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">Select subject</option>
                {w.subjects
                  .filter(
                    (s) =>
                      s.active && (s.level === "ALL" || s.level === cls?.level),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Subject teacher">
              <select
                className="field"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              >
                <option value="">Class teacher handles this subject</option>
                {w.staff
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              className="btn-primary"
              disabled={busy || !classId || !subjectId}
            >
              Save assignment
            </button>
          </form>
        </section>
      </div>
      <section className="surface rounded-2xl p-6">
        <h2 className="text-lg font-semibold">Current assignments</h2>
        {w.assignments.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {w.assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{w.classes.find((c) => c.id === a.class_id)?.name}</td>
                    <td>
                      {w.subjects.find((s) => s.id === a.subject_id)?.name}
                    </td>
                    <td>
                      {w.staff.find((s) => s.id === a.teacher_id)?.full_name ||
                        "Class teacher"}
                    </td>
                    <td>
                      <button
                        className="text-sm text-red-700"
                        onClick={() => {
                          if (
                            confirm(
                              "Remove this teaching assignment? Saved results remain available.",
                            )
                          )
                            void run(
                              () => deleteRow("class_subjects", a.id),
                              "Assignment removed.",
                            );
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No teaching assignments yet.</Empty>
        )}
      </section>
      {draft && (
        <Modal title="Subject details" onClose={() => setDraft(null)}>
          <form
            method="post"
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(
                  () =>
                    saveRows("subjects", [
                      { ...draft, school_id: w.school.id },
                    ]),
                  "Subject saved.",
                )
              )
                setDraft(null);
            }}
          >
            <Field label="Subject name">
              <input
                className="field"
                required
                maxLength={100}
                value={draft.name || ""}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Code">
              <input
                className="field"
                maxLength={15}
                value={draft.code || ""}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </Field>
            <Field label="Class level">
              <select
                className="field"
                value={draft.level}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    level: e.target.value as Subject["level"],
                  })
                }
              >
                {["ALL", "KG", "PRIMARY", "JHS"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_core || false}
                onChange={(e) =>
                  setDraft({ ...draft, is_core: e.target.checked })
                }
              />{" "}
              Core subject
            </label>
            <button className="btn-primary" disabled={busy}>
              Save subject
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
