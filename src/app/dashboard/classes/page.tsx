"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Modal, Empty } from "@/components/ui";
import { saveRows, deleteRow } from "@/lib/api";
import type { SchoolClass, Level } from "@/lib/models";
export default function Classes() {
  const { data: w, run, busy } = useWorkspace(),
    [draft, setDraft] = useState<Partial<SchoolClass> | null>(null);
  const admin = w.profile.role === "ADMIN";
  return (
    <>
      <PageHeader
        eyebrow="Organisation"
        title="Classes"
        description={
          admin
            ? "Create class groups and assign the teacher responsible for attendance and reports."
            : "Your assigned classes and their learners."
        }
      >
        {admin && (
          <button
            className="btn-primary"
            onClick={() =>
              setDraft({ name: "", level: "PRIMARY", class_teacher_id: null })
            }
          >
            Add class
          </button>
        )}
      </PageHeader>
      {w.classes.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {w.classes.map((c) => (
            <section key={c.id} className="surface rounded-2xl p-6">
              <div className="eyebrow">{c.level}</div>
              <h2 className="mt-3 text-2xl font-semibold">{c.name}</h2>
              <p className="mt-3 text-sm text-muted">
                {
                  w.students.filter(
                    (s) => s.class_id === c.id && s.status === "ACTIVE",
                  ).length
                }{" "}
                active learners
              </p>
              <p className="mt-2 text-sm text-muted">
                Class teacher:{" "}
                {w.staff.find((s) => s.id === c.class_teacher_id)?.full_name ||
                  (c.class_teacher_id ? "Assigned" : "Not assigned")}
              </p>
              {admin && (
                <div className="mt-5 flex gap-4">
                  <button
                    className="text-sm font-semibold text-[var(--g-green)]"
                    onClick={() => setDraft(c)}
                  >
                    Edit class
                  </button>
                  {!w.students.some((s) => s.class_id === c.id) &&
                    !w.assignments.some((a) => a.class_id === c.id) && (
                      <button
                        className="text-sm text-red-700"
                        onClick={() => {
                          if (confirm(`Remove ${c.name}?`))
                            void run(
                              () => deleteRow("classes", c.id),
                              "Class removed.",
                            );
                        }}
                      >
                        Remove
                      </button>
                    )}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Empty>
          No classes yet.{" "}
          {admin
            ? "Add a class to begin."
            : "Ask your administrator to assign your teaching responsibilities."}
        </Empty>
      )}
      {draft && (
        <Modal
          title={draft.id ? "Edit class" : "Add class"}
          onClose={() => setDraft(null)}
        >
          <form
            method="post"
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(
                  () =>
                    saveRows("classes", [
                      {
                        ...draft,
                        school_id: w.school.id,
                        academic_year: w.school.academic_year,
                      },
                    ]),
                  "Class saved.",
                )
              )
                setDraft(null);
            }}
          >
            <Field label="Class name">
              <input
                className="field"
                required
                maxLength={80}
                value={draft.name || ""}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Primary 4"
              />
            </Field>
            <Field label="Level">
              <select
                className="field"
                value={draft.level}
                onChange={(e) =>
                  setDraft({ ...draft, level: e.target.value as Level })
                }
              >
                <option value="KG">Kindergarten</option>
                <option value="PRIMARY">Primary</option>
                <option value="JHS">Junior High School</option>
              </select>
            </Field>
            <Field label="Class teacher">
              <select
                className="field"
                value={draft.class_teacher_id || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    class_teacher_id: e.target.value || null,
                  })
                }
              >
                <option value="">Assign later</option>
                {w.staff
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="text-xs leading-6 text-muted">
              A staff member may supervise a class and teach subjects with the
              same account.
            </p>
            <button disabled={busy} className="btn-primary">
              Save class
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
