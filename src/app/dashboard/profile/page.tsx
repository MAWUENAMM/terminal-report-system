"use client";
import Link from "next/link";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field } from "@/components/ui";
import { staffAction } from "@/lib/api";
import { roleNames } from "@/lib/models";
export default function Profile() {
  const { data: w, run, busy } = useWorkspace(),
    [name, setName] = useState(w.profile.full_name),
    [phone, setPhone] = useState(w.profile.phone || "");
  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="My profile"
        description="Update your name and contact number. Your administrator manages your role and teaching assignments."
      />
      <form
        method="post"
        className="surface max-w-2xl space-y-5 rounded-2xl p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          await run(
            () =>
              staffAction({ action: "update_profile", full_name: name, phone }),
            "Profile updated.",
          );
        }}
      >
        <Field label="Full name">
          <input
            className="field"
            required
            value={name}
            maxLength={150}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className="field"
            value={phone}
            maxLength={35}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <p className="text-sm">
          Email: <strong>{w.profile.email}</strong>
        </p>
        <p className="text-sm">
          Role: <strong>{roleNames[w.profile.role]}</strong>
        </p>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className="btn-primary">
            Save profile
          </button>
          <Link href="/account/password" className="btn-secondary">
            Change password
          </Link>
        </div>
      </form>
    </>
  );
}
