"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Modal, Empty } from "@/components/ui";
import { saveRows, deleteRow, updateRow } from "@/lib/api";
import { fullName, isLeader, type Student } from "@/lib/models";
import { readStudentImport, type ImportedStudent } from "@/lib/student-import";
import StudentProfile from "@/components/StudentProfile";
export default function Students() {
  const { data: w, run, busy } = useWorkspace(),
    [query, setQuery] = useState(""),
    [classFilter, setClassFilter] = useState(""),
    [draft, setDraft] = useState<Partial<Student> | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [preview, setPreview] = useState<ImportedStudent[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [reading, setReading] = useState(false),
    [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const canManage = isLeader(w.profile.role),
    visible = w.students.filter(
      (s) =>
        (!classFilter || s.class_id === classFilter) &&
        `${fullName(s)} ${s.admission_number}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const recordedLearners = new Set(
    [
      ...w.scores,
      ...w.attendance,
      ...w.affective,
      ...w.remarks,
      ...w.archives,
    ].map((record) => record.student_id),
  );
  return (
    <>
      <PageHeader
        eyebrow="Learner records"
        title="Learners"
        description={
          canManage
            ? "Register learners, maintain their class placement or import an existing school list."
            : "View the learners in your assigned classes. Your administrator or headmaster manages enrolment."
        }
      >
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setImportOpen(true);
                setPreview([]);
                setErrors([]);
              }}
            >
              Import CSV / Excel
            </button>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                setDraft({
                  first_name: "",
                  last_name: "",
                  admission_number: "",
                  gender: "F",
                  class_id: w.classes[0]?.id || "",
                  status: "ACTIVE",
                })
              }
            >
              Add learner
            </button>
          </div>
        )}
      </PageHeader>
      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Search learners"
          className="field max-w-sm"
          placeholder="Search name or admission number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter class"
          className="field max-w-xs"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">
            {canManage ? "All classes" : "All assigned classes"}
          </option>
          {w.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {visible.length ? (
        <div className="surface overflow-x-auto rounded-2xl">
          <table className="data-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Admission no.</th>
                <th>Class</th>
                <th>Gender</th>
                <th>Status</th>
                {canManage ? <th>Actions</th> : <th>Profile</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const protectedRecords = recordedLearners.has(s.id);
                return (
                  <tr key={s.id}>
                    <td className="font-medium">
                      <button
                        className="text-left font-semibold text-[var(--g-green)] underline-offset-4 hover:underline"
                        onClick={() => setSelectedStudent(s)}
                      >
                        {fullName(s)}
                      </button>
                    </td>
                    <td>{s.admission_number}</td>
                    <td>{w.classes.find((c) => c.id === s.class_id)?.name}</td>
                    <td>{s.gender}</td>
                    <td>{s.status.toLowerCase()}</td>
                    {canManage ? (
                      <td>
                        <div className="flex flex-wrap gap-4">
                          <button
                            className="font-semibold text-[var(--g-green)]"
                            disabled={busy}
                            onClick={() => setDraft(s)}
                          >
                            Edit
                          </button>
                          <button
                            className="font-semibold text-[var(--g-green)]"
                            disabled={busy}
                            onClick={() => {
                              const status =
                                s.status === "ACTIVE" ? "WITHDRAWN" : "ACTIVE";
                              if (
                                confirm(
                                  status === "WITHDRAWN"
                                    ? `Withdraw ${fullName(s)} from the active learner list? Their results and reports will be kept.`
                                    : `Restore ${fullName(s)} to the active learner list?`,
                                )
                              )
                                void run(
                                  () => updateRow("students", s.id, { status }),
                                  status === "ACTIVE"
                                    ? "Learner restored."
                                    : "Learner withdrawn. Their records have been retained.",
                                );
                            }}
                          >
                            {s.status === "ACTIVE" ? "Withdraw" : "Restore"}
                          </button>
                          <button
                            className="text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={busy || protectedRecords}
                            onClick={() => {
                              if (
                                confirm(
                                  `Permanently delete ${fullName(s)}? This cannot be undone. Learners with assessment or report history cannot be deleted.`,
                                )
                              )
                                void run(
                                  () => deleteRow("students", s.id),
                                  "Unused learner record deleted.",
                                );
                            }}
                          >
                            Delete
                          </button>
                        </div>
                        {protectedRecords && (
                          <p className="mt-2 text-xs text-muted">
                            {s.status === "ACTIVE"
                              ? "History retained. Use Withdraw to remove from the active list."
                              : "Assessment and report history is retained."}
                          </p>
                        )}
                      </td>
                    ) : (
                      <td>
                        <button
                          className="font-semibold text-[var(--g-green)]"
                          onClick={() => setSelectedStudent(s)}
                        >
                          View profile
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>
          No learners match this view.{" "}
          {canManage
            ? "Add classes first, then register or import learners."
            : ""}
        </Empty>
      )}
      {selectedStudent && (
        <StudentProfile
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
      {draft && (
        <Modal
          title={draft.id ? "Edit learner" : "Add learner"}
          onClose={() => setDraft(null)}
        >
          <form
            method="post"
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                () =>
                  saveRows("students", [
                    {
                      ...draft,
                      date_of_birth: draft.date_of_birth || null,
                      admission_number: draft.admission_number?.trim(),
                      school_id: w.school.id,
                    },
                  ]),
                "Learner saved.",
              );
              if (ok) setDraft(null);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["admission_number", "Admission number"],
                  ["first_name", "First name"],
                  ["last_name", "Last name"],
                  ["other_names", "Other names"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    className="field"
                    required={key !== "other_names"}
                    maxLength={key === "admission_number" ? 60 : 100}
                    value={draft[key] || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </Field>
              ))}
              <Field label="Gender">
                <select
                  className="field"
                  value={draft.gender}
                  onChange={(e) =>
                    setDraft({ ...draft, gender: e.target.value as "M" | "F" })
                  }
                >
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                </select>
              </Field>
              <Field label="Class">
                <select
                  className="field"
                  required
                  value={draft.class_id}
                  onChange={(e) =>
                    setDraft({ ...draft, class_id: e.target.value })
                  }
                >
                  <option value="">Choose class</option>
                  {w.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date of birth">
                <input
                  className="field"
                  type="date"
                  value={draft.date_of_birth || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, date_of_birth: e.target.value })
                  }
                />
              </Field>
              <Field label="Status">
                <select
                  className="field"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.value as Student["status"],
                    })
                  }
                >
                  {["ACTIVE", "TRANSFERRED", "WITHDRAWN"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Guardian name">
                <input
                  className="field"
                  maxLength={150}
                  value={draft.guardian_name || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, guardian_name: e.target.value })
                  }
                />
              </Field>
              <Field label="Guardian phone">
                <input
                  className="field"
                  type="tel"
                  maxLength={35}
                  value={draft.guardian_phone || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, guardian_phone: e.target.value })
                  }
                />
              </Field>
            </div>
            <button disabled={busy} className="btn-primary">
              Save learner
            </button>
          </form>
        </Modal>
      )}
      {importOpen && (
        <Modal title="Import learners" onClose={() => setImportOpen(false)}>
          <p className="text-sm leading-6 text-muted">
            Use the template headers. Class names must match your existing
            classes. Admission numbers should be stored as text in Excel to
            preserve leading zeros. Each import is validated before any records
            are saved.
          </p>
          <a
            href="/student-import-template.csv"
            download
            className="btn-secondary my-4"
          >
            Download CSV template
          </a>
          <Field label="Choose CSV or Excel file">
            <input
              className="field"
              type="file"
              accept=".csv,.xlsx"
              disabled={reading || busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setReading(true);
                setPreview([]);
                setErrors([]);
                try {
                  const result = await readStudentImport(
                    file,
                    w.classes,
                    w.students,
                  );
                  setPreview(result.rows);
                  setErrors(result.errors);
                } catch (e) {
                  setErrors([
                    e instanceof Error ? e.message : "File could not be read.",
                  ]);
                } finally {
                  setReading(false);
                }
              }}
            />
          </Field>
          {reading && <p className="mt-4 text-sm">Checking your file…</p>}
          {errors.length > 0 && (
            <div
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              <p className="font-semibold">
                Fix these issues and select the file again. Nothing has been
                imported.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.slice(0, 15).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {errors.length > 15 && (
                <p className="mt-2">And {errors.length - 15} more issues.</p>
              )}
            </div>
          )}
          {preview.length > 0 && (
            <>
              <h3 className="mt-5 font-semibold">
                {preview.length} valid learners · preview of first 10
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Admission</th>
                      <th>Name</th>
                      <th>Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((s) => (
                      <tr key={s.admission_number}>
                        <td>{s.admission_number}</td>
                        <td>
                          {s.first_name} {s.last_name}
                        </td>
                        <td>
                          {w.classes.find((c) => c.id === s.class_id)?.name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn-primary mt-5"
                disabled={busy || !!errors.length}
                onClick={async () => {
                  if (
                    await run(
                      () =>
                        saveRows(
                          "students",
                          preview.map((s) => ({
                            ...s,
                            school_id: w.school.id,
                          })),
                        ),
                      `${preview.length} learners imported.`,
                    )
                  )
                    setImportOpen(false);
                }}
              >
                Import {preview.length} learners
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
