"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Modal, Restricted } from "@/components/ui";
import { staffAction } from "@/lib/api";
import { roleNames, type Profile, type Role } from "@/lib/models";
export default function Staff() {
  const { data: w, run, busy } = useWorkspace(),
    [draft, setDraft] = useState<Partial<Profile> | null>(null),
    [credentials, setCredentials] = useState<{
      email: string;
      temporaryPassword: string;
    } | null>(null);
  if (w.profile.role !== "ADMIN") return <Restricted />;
  return (
    <>
      <PageHeader
        eyebrow="People & access"
        title="Staff accounts"
        description="Give each staff member an individual account. Class and subject assignments determine their teaching responsibilities."
      >
        <button
          className="btn-primary"
          onClick={() =>
            setDraft({
              full_name: "",
              email: "",
              role: "CLASS_TEACHER",
              active: true,
            })
          }
        >
          Add staff member
        </button>
      </PageHeader>
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {w.staff.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.full_name}</td>
                <td>{s.email}</td>
                <td>{roleNames[s.role]}</td>
                <td>
                  {!s.active
                    ? "Inactive"
                    : s.must_change_password
                      ? "Password setup needed"
                      : "Active"}
                </td>
                <td>
                  <div className="flex gap-4">
                    <button
                      className="font-semibold text-[var(--g-green)]"
                      onClick={() => setDraft(s)}
                    >
                      Edit
                    </button>
                    {s.id !== w.profile.id && (
                      <button
                        className="text-muted"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              `Reset the password for ${s.full_name}? Their previous password will stop working.`,
                            )
                          )
                            void run(
                              async () =>
                                setCredentials(
                                  await staffAction({
                                    action: "reset_staff_password",
                                    staff_id: s.id,
                                  }),
                                ),
                              "Initial password created.",
                            );
                        }}
                      >
                        Reset password
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft && (
        <Modal
          title={draft.id ? "Edit staff member" : "Create staff account"}
          onClose={() => setDraft(null)}
        >
          <form
            method="post"
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const saved = await run(
                async () => {
                  const result = await staffAction({
                    action: draft.id ? "update_staff" : "create_staff",
                    staff_id: draft.id,
                    full_name: draft.full_name,
                    email: draft.email,
                    role: draft.role,
                    active: draft.active,
                  });
                  if (result.temporaryPassword) setCredentials(result);
                },
                draft.id ? "Staff account updated." : "Staff account created.",
              );
              if (saved) setDraft(null);
            }}
          >
            <Field label="Full name">
              <input
                className="field"
                required
                maxLength={150}
                value={draft.full_name || ""}
                onChange={(e) =>
                  setDraft({ ...draft, full_name: e.target.value })
                }
              />
            </Field>
            <Field label="Email">
              <input
                className="field"
                type="email"
                required
                maxLength={254}
                disabled={!!draft.id}
                value={draft.email || ""}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Field>
            <Field label="Primary role">
              <select
                className="field"
                value={draft.role}
                onChange={(e) =>
                  setDraft({ ...draft, role: e.target.value as Role })
                }
              >
                {Object.entries(roleNames).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            {draft.id && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.checked })
                  }
                />{" "}
                Account active
              </label>
            )}
            <p className="text-sm leading-6 text-muted">
              An initial password is shown once. Share it privately with the
              staff member after checking their identity. They must choose a new
              password at first sign-in.
            </p>
            <button disabled={busy} className="btn-primary">
              {draft.id ? "Save changes" : "Create account"}
            </button>
          </form>
        </Modal>
      )}
      {credentials && (
        <Modal
          title="Initial sign-in details"
          onClose={() => setCredentials(null)}
        >
          <p className="text-sm leading-6 text-muted">
            Share these directly with the intended staff member. They are not
            sent by email. This password is not shown again after you close this
            window.
          </p>
          <div className="mt-5 space-y-3 rounded-xl border border-line bg-paper p-4">
            <p className="break-all">
              <strong>Email:</strong> {credentials.email}
            </p>
            <p className="break-all">
              <strong>Initial password:</strong>{" "}
              <code>{credentials.temporaryPassword}</code>
            </p>
          </div>
          <button
            className="btn-primary mt-5"
            onClick={() => setCredentials(null)}
          >
            I have saved the details
          </button>
        </Modal>
      )}
    </>
  );
}
