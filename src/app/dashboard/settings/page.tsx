"use client";
import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field, Restricted } from "@/components/ui";
import { updateRow } from "@/lib/api";
export default function Settings() {
  const { data: w, run, busy } = useWorkspace(),
    [school, setSchool] = useState(w.school);
  if (w.profile.role !== "ADMIN") return <Restricted />;
  const locked = w.scores.some(
    (s) =>
      s.academic_year === w.school.academic_year &&
      s.term === w.school.current_term,
  );
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="School settings"
        description="School identity and assessment weights can only be changed by an administrator."
      />
      <form
        method="post"
        className="grid gap-5 lg:grid-cols-[1.5fr_1fr]"
        onSubmit={async (e) => {
          e.preventDefault();
          await run(async () => {
            if (Number(school.sba_weight) + Number(school.exam_weight) !== 100)
              throw new Error("SBA and exam weights must add up to 100%.");
            const {
              name,
              address,
              phone,
              email,
              headteacher_name,
              district,
              region,
              sba_weight,
              exam_weight,
            } = school;
            await updateRow("schools", school.id, {
              name,
              address,
              phone,
              email,
              headteacher_name,
              district,
              region,
              sba_weight,
              exam_weight,
            });
          }, "School settings saved.");
        }}
      >
        <section className="surface grid gap-5 rounded-2xl p-6 sm:grid-cols-2">
          {(
            [
              ["name", "School name"],
              ["address", "Address"],
              ["district", "District"],
              ["region", "Region"],
              ["phone", "Phone"],
              ["email", "School email"],
              ["headteacher_name", "Headmaster’s name"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                className="field"
                required={key === "name"}
                type={key === "email" ? "email" : "text"}
                maxLength={150}
                value={school[key] || ""}
                onChange={(e) =>
                  setSchool({ ...school, [key]: e.target.value })
                }
              />
            </Field>
          ))}
        </section>
        <section className="surface space-y-5 rounded-2xl p-6">
          <h2 className="font-semibold">Assessment weights</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="SBA %">
              <input
                className="field"
                type="number"
                min={0}
                max={100}
                required
                disabled={locked}
                value={school.sba_weight}
                onChange={(e) =>
                  setSchool({
                    ...school,
                    sba_weight: Number(e.target.value),
                    exam_weight: 100 - Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Exam %">
              <input
                className="field"
                type="number"
                min={0}
                max={100}
                required
                disabled={locked}
                value={school.exam_weight}
                onChange={(e) =>
                  setSchool({
                    ...school,
                    exam_weight: Number(e.target.value),
                    sba_weight: 100 - Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
          <p className="text-xs leading-6 text-muted">
            {locked
              ? "Weights are locked because marks have been entered this term."
              : "Weights must add up to 100%. They become locked once marks are entered."}
          </p>
          <p className="border-t border-line pt-4 text-sm">
            {w.school.academic_year} · Term {w.school.current_term}
          </p>
          <Link
            href="/dashboard/terms"
            className="block text-sm font-semibold text-[var(--g-green)]"
          >
            Manage academic terms →
          </Link>
          <button disabled={busy} className="btn-primary w-full">
            Save school settings
          </button>
        </section>
      </form>
    </>
  );
}
