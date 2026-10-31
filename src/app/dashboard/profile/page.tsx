"use client";
import Link from "next/link";
import { useState } from "react";
import { BellRing, ShieldCheck } from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Field } from "@/components/ui";
import { staffAction } from "@/lib/api";
import { roleNames } from "@/lib/models";
export default function Profile() {
  const { data: w, run, busy } = useWorkspace(),
    [name, setName] = useState(w.profile.full_name),
    [phone, setPhone] = useState(w.profile.phone || ""),
    [smsPhone, setSmsPhone] = useState(w.profile.phone || ""),
    [smsEnabled, setSmsEnabled] = useState(Boolean(w.profile.sms_opt_in));
  const canReceiveSMS = w.profile.role === "ADMIN" || w.profile.role === "ACCOUNTANT";
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
      {canReceiveSMS && (
        <section className="surface mt-5 max-w-2xl rounded-2xl border border-emerald-200 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800"><BellRing size={22}/></div>
            <div>
              <h2 className="text-lg font-bold">Payment SMS notifications</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Receive an SMS when your school records a payment and an authorized
                finance staff member presses Notify. EduReport currently pays for these
                messages centrally. No SMS will be sent until the service is activated.
              </p>
            </div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            const saved = await run(async () => {
              const { error } = await browserClient().rpc("sms_save_my_preferences", {
                p_phone: smsPhone,
                p_opt_in: smsEnabled,
              });
              if (error) throw new Error(error.message);
            }, smsEnabled
              ? "Phone number and SMS preference saved."
              : "Payment SMS notifications switched off.");
            if (saved) setPhone(smsPhone);
          }}>
            <Field label="Your Ghana mobile number">
              <input className="field" type="tel" autoComplete="tel"
                placeholder="0241234567 or +233241234567"
                maxLength={35} value={smsPhone}
                onChange={e => setSmsPhone(e.target.value)}/>
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4"
                checked={smsEnabled} onChange={e=>setSmsEnabled(e.target.checked)}/>
              <span>
                <strong>Enable payment SMS alerts on my phone</strong>
                <span className="mt-1 block leading-5 text-muted">
                  I confirm that this number belongs to me or that I am authorized to receive
                  EduReport payment alerts on it. I can turn these alerts off at any time.
                </span>
              </span>
            </label>
            <div className="flex items-center gap-2 text-xs text-muted">
              <ShieldCheck size={15}/>
              Your number will not be shown to other schools. SMS verification is not yet enabled.
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              Save SMS preferences
            </button>
          </form>
        </section>
      )}
    </>
  );
}
