"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { Field, PageHeader, Restricted } from "@/components/ui";
import { updateRow } from "@/lib/api";
import {
  removeSchoolLogo,
  resolveSchoolLogoUrl,
  uploadSchoolLogo,
} from "@/lib/school-branding";

export default function Settings() {
  const { data: w, run, busy } = useWorkspace();
  const [school, setSchool] = useState(w.school);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!dirty) setSchool(w.school);
    });
    let active = true;
    void resolveSchoolLogoUrl(w.school.logo_url).then((url) => {
      if (active) setLogoUrl(url);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      active = false;
    };
  }, [w.school, dirty]);

  useEffect(() => {
    const url = logoFile ? URL.createObjectURL(logoFile) : null;
    const frame = window.requestAnimationFrame(() => setLogoPreview(url));
    return () => {
      window.cancelAnimationFrame(frame);
      if (url) URL.revokeObjectURL(url);
    };
  }, [logoFile]);

  if (w.profile.role !== "ADMIN") return <Restricted />;

  const locked = w.scores.some(
    (s) =>
      s.academic_year === w.school.academic_year &&
      s.term === w.school.current_term,
  );

  async function saveLogo() {
    if (!logoFile) return;
    const ok = await run(async () => {
      const signed = await uploadSchoolLogo(w.school.id, logoFile);
      setLogoUrl(signed);
      setLogoFile(null);
    }, "School logo updated. It now appears across learner profiles and reports.");
    if (!ok) return;
  }

  async function deleteLogo() {
    if (!confirm("Remove the school logo from profiles and future reports?")) return;
    const ok = await run(async () => {
      await removeSchoolLogo(w.school.id);
      setLogoUrl(null);
      setLogoFile(null);
    }, "School logo removed.");
    if (!ok) return;
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="School settings"
        description="Manage school identity, branding and assessment settings. Your logo automatically carries into learner profiles and terminal reports."
      />

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <form
          method="post"
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(async () => {
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
                sba_input_max,
                next_term_begins,
                term_total_days,
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
                sba_input_max,
                next_term_begins: next_term_begins || null,
                term_total_days: term_total_days ?? null,
              });
            }, "School settings saved.");
            if (ok) setDirty(false);
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
                  onChange={(e) => {
                    setDirty(true);
                    setSchool({ ...school, [key]: e.target.value });
                  }}
                />
              </Field>
            ))}
          </section>

          <section className="surface rounded-2xl p-6">
            <h2 className="font-semibold">Attendance: total school days this term</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Set the official total number of days for {w.school.academic_year},
              Term {w.school.current_term}. This applies to all learner reports and
              synchronizes existing attendance records for the current open term.
              It never fills in or guesses an individual learner’s days present.
            </p>
            <Field label="Total school days (1–366)">
              <input type="number" min={1} max={366} step={1}
                className="field mt-3" disabled={!w.terms.some((t)=>t.academic_year===w.school.academic_year &&
                  t.term===w.school.current_term && t.status==="OPEN")}
                value={school.term_total_days ?? ""}
                placeholder="e.g. 63"
                onChange={(event)=>{
                  const value=event.target.value;
                  setDirty(true);
                  setSchool({...school,term_total_days:value===""?null:Number(value)});
                }}
              />
            </Field>
            <p className="mt-2 text-xs text-muted">
              This value clears at the start of the next term. Prior archived reports stay unchanged.
              Teachers still record each learner’s actual days present separately.
            </p>
          </section>
          <section className="surface rounded-2xl p-6">
            <h2 className="font-semibold">Next term begins</h2>
            <p className="mt-1 text-sm text-muted">
              Choose the official reopening date. It appears on all new report PDFs for this term.
              It automatically clears when a new term starts.
            </p>
            <Field label="Next term begins (date)">
              <input className="field mt-3" type="date"
                value={school.next_term_begins || ""}
                onChange={(e) => { setDirty(true); setSchool({...school,next_term_begins:e.target.value || null}); }}
              />
            </Field>
          </section>
          <section className="surface rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">Assessment weights</h2>
                <p className="mt-1 text-sm text-muted">
                  Configure the percentage split used to calculate learner totals.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {w.school.academic_year} · Term {w.school.current_term}
              </span>
            </div>
            <div className="mt-4">
              <Field label="SBA raw marks are entered out of">
                <select className="field mt-2" value={school.sba_input_max || 100}
                  disabled={locked}
                  onChange={(e) => {
                    setDirty(true);
                    setSchool({...school,sba_input_max:Number(e.target.value)});
                  }}>
                  <option value={60}>60 marks</option>
                  <option value={100}>100 marks (legacy)</option>
                </select>
              </Field>
              <p className="mt-2 text-xs text-muted">
                Your SBA maximum is independent of the weighting: for example, 48/60 becomes 40/50
                when SBA carries 50% of the final score.
                This selection locks after the first marks are entered in a term.
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Field label="SBA %">
                <input
                  className="field"
                  type="number"
                  min={0}
                  max={100}
                  required
                  disabled={locked}
                  value={school.sba_weight}
                  onChange={(e) => {
                    setDirty(true);
                    setSchool({
                      ...school,
                      sba_weight: Number(e.target.value),
                      exam_weight: 100 - Number(e.target.value),
                    });
                  }}
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
                  onChange={(e) => {
                    setDirty(true);
                    setSchool({
                      ...school,
                      exam_weight: Number(e.target.value),
                      sba_weight: 100 - Number(e.target.value),
                    });
                  }}
                />
              </Field>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted">
              {locked
                ? "Weights are locked because marks have been entered this term."
                : "Weights must add up to 100%. They become locked once marks are entered."}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <Link href="/dashboard/terms" className="text-sm font-semibold text-[var(--g-green)]">
                Manage academic terms →
              </Link>
              <div className="flex items-center gap-3">
                {dirty ? (
                  <span className="text-xs font-semibold text-amber-700">Unsaved changes</span>
                ) : (
                  <span className="text-xs text-muted">All changes saved</span>
                )}
                <button disabled={busy || !dirty} className="btn-primary">
                  Save school settings
                </button>
              </div>
            </div>
          </section>
        </form>

        <aside className="space-y-5">
          <section className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-line p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">School branding</h2>
                  <p className="mt-1 text-sm text-muted">Logo & report watermark</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="relative grid min-h-56 place-items-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                {(logoPreview || logoUrl) ? (
                  <>
                    <img
                      src={logoPreview || logoUrl || ""}
                      alt={`${w.school.name} logo preview`}
                      className="max-h-40 max-w-[80%] object-contain"
                    />
                    <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-[0.04]">
                      <img
                        src={logoPreview || logoUrl || ""}
                        alt=""
                        className="h-4/5 w-4/5 object-contain grayscale"
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-400">
                    <ImageIcon className="mx-auto h-12 w-12" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">No school logo uploaded</p>
                    <p className="mt-1 text-xs">Upload one to brand profiles and reports.</p>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Choose logo</span>
                  <input
                    className="field"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={busy}
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="text-xs leading-5 text-muted">
                  PNG, JPG, WEBP or SVG. Maximum 2 MB. Transparent PNG/SVG usually works best for report watermarks.
                </p>

                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={!logoFile || busy}
                  onClick={() => void saveLogo()}
                >
                  <Upload className="mr-2 inline h-4 w-4" />
                  {w.school.logo_url ? "Replace school logo" : "Upload school logo"}
                </button>

                {w.school.logo_url && (
                  <button
                    type="button"
                    className="btn-secondary w-full !text-red-700"
                    disabled={busy}
                    onClick={() => void deleteLogo()}
                  >
                    <Trash2 className="mr-2 inline h-4 w-4" /> Remove logo
                  </button>
                )}
              </div>

              <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-xs leading-6 text-emerald-900">
                Once saved, this logo automatically appears in the learner profile header, as the profile watermark, and in generated terminal reports.
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
