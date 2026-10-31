"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, BellRing, Building2, CircleAlert, CreditCard, KeyRound, RefreshCcw, Send, ShieldCheck, Wallet } from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { Empty, PageHeader, Restricted } from "@/components/ui";
import { browserClient } from "@/lib/supabase/client";

type Usage = {
  school_id: string;
  school_name: string;
  messages: number;
  submitted: number;
  queued: number;
  credits_used: number;
  opted_in_staff: number;
};
type Readiness = {
  api_key_configured: boolean;
  edge_live_enabled: boolean;
  pilot_restrictions_configured: boolean;
  database_sending_enabled: boolean;
  sender_id: string;
  sender_approval_verified: boolean;
};
type Dashboard = {
  provider: string;
  sender_id: string;
  billing_mode: "CENTRAL" | "SCHOOL";
  sending_enabled: boolean;
  global_daily_limit: number;
  school_daily_limit: number;
  totals: {
    messages: number;
    submitted: number;
    delivered: number;
    queued: number;
    failed: number;
    credits_used: number;
  };
  schools: Usage[];
};
function readableCredits(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const obj = response as Record<string, unknown>;
  const nested = obj.data && typeof obj.data === "object"
    ? obj.data as Record<string, unknown> : obj;
  const balance = nested.sms_balance ?? nested.smsBalance ?? nested.credits;
  if (typeof balance === "number" && Number.isFinite(balance)) return balance.toLocaleString("en-GB");
  if (typeof balance === "string" && /^[0-9]+(?:\.[0-9]+)?$/.test(balance)) return balance;
  return null;
}
export default function CentralSMS() {
  const { data: workspace } = useWorkspace();
  const [info, setInfo] = useState<Dashboard | null>(null);
  const [credits, setCredits] = useState<string | null>(null);
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!workspace.operator) return;
    setLoading(true); setError("");
    try {
      const db = browserClient();
      const { data: dashboard, error: dbError } = await db.rpc("sms_platform_dashboard");
      if (dbError) throw new Error(dbError.message);
      setInfo(dashboard as Dashboard);
      // Balance is fetched server-side, never exposing the Arkesel API key.
      const { data: gateway, error: gatewayError } = await db.functions.invoke("sms-gateway", {
        body: { action: "balance" },
      });
      setReadiness(!gatewayError ? (gateway?.readiness ?? null) : null);
      if (!gatewayError && gateway?.connected) {
        setGatewayConnected(true);
        setCredits(readableCredits(gateway.balance));
      } else {
        setGatewayConnected(false);
        setCredits(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "SMS dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [workspace.operator]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  if (!workspace.operator) return <Restricted/>;

  const total = info?.totals;
  const checks = [
    { label: "Arkesel API key", ready: readiness?.api_key_configured ?? false },
    { label: "Arkesel balance API responds", ready: gatewayConnected },
    { label: "Pilot school and phone allowlist", ready: readiness?.pilot_restrictions_configured ?? false },
    { label: "Edge Function live-send switch", ready: readiness?.edge_live_enabled ?? false },
    { label: "Database sending switch", ready: readiness?.database_sending_enabled ?? false },
  ];
  const cards = [
    { title: "SMS credits remaining", value: credits ?? "—", sub: gatewayConnected ? "Provider balance" : "Connect Arkesel securely to display this", icon: Wallet },
    { title: "Requests submitted", value: total?.submitted ?? 0, sub: "Accepted by Arkesel, not necessarily delivered", icon: Send },
    { title: "Credits recorded", value: total?.credits_used ?? 0, sub: "Confirmed reported usage by provider", icon: CreditCard },
    { title: "Opted-in finance staff", value: info?.schools.reduce((n, s)=>n+Number(s.opted_in_staff),0) ?? 0, sub: "School Admins and Accountants who opted in", icon: BellRing },
  ];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform administration · Messaging" title="Central SMS Management"
        description="Only Platform Administrators can monitor EduReport-wide SMS traffic, Arkesel credit usage and school-by-school activity.">
        <button type="button" className="btn-secondary" disabled={loading} onClick={()=>void load()}>
          <RefreshCcw size={16}/>Refresh
        </button>
      </PageHeader>
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-[#064d39] to-[#08765a] px-5 py-5 text-white sm:px-7">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-3"><ShieldCheck size={26}/></div>
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-100">Central billing · EduReport</p>
              <h2 className="mt-1 text-xl font-bold">Arkesel SMS Gateway</h2>
              <p className="mt-1 text-sm text-emerald-50">Sender ID: {info?.sender_id || "EDUREPORT"}</p>
            </div>
          </div>
          <div className={"rounded-full px-3 py-2 text-xs font-bold "+(info?.sending_enabled?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-900")}>
            {info?.sending_enabled ? "Sending enabled" : "PREVIEW ONLY · No live SMS"}
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({title,value,sub,icon:Icon})=><article key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Icon className="text-emerald-700" size={20}/>
            <p className="mt-3 text-xs font-medium text-slate-600">{title}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{sub}</p>
          </article>)}
        </div>
      </section>
      {!info?.sending_enabled&&<div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <CircleAlert size={20} className="shrink-0"/>
        <div><strong>Live SMS is not activated.</strong>
          <p className="mt-1 leading-6">EDUREPORT sender-ID network whitelisting is pending. A message arriving through the Arkesel dashboard does not prove API approval on all networks. Provider credentials and a restricted pilot activation are needed before phone delivery can be tested. Notify still creates the in-app alert without spending SMS credits.</p>
        </div>
      </div>}
      <section className="surface rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="shrink-0 text-emerald-700"/>
          <div>
            <h2 className="text-lg font-bold">Provider connection and pilot readiness</h2>
            <p className="mt-1 text-sm text-muted">Read-only checks from the secure server. API credentials and pilot phone numbers are never displayed here.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {checks.map(check => <div key={check.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
            <span>{check.label}</span>
            <span className={"shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold "+(check.ready?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-900")}>
              {check.ready?"Ready":"Not ready"}
            </span>
          </div>)}
        </div>
        <p className="mt-3 text-xs leading-5 text-amber-800">
          These checks cannot confirm sender-ID whitelisting or handset delivery. Sending requires verified recipient consent, a staged test, and explicit production authorization.
        </p>
      </section>
      <section className="surface rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-lg font-bold"><Building2 size={20} className="text-emerald-700"/>School-by-school SMS usage</h2>
            <p className="mt-1 text-sm text-muted">Each school has a separate usage record even while EduReport pays the Arkesel costs centrally.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
            {info?.schools.length ?? 0} schools
          </span>
        </div>
        {loading?<p className="mt-5 text-sm text-muted">Loading SMS usage…</p>:null}
        {error?<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>:null}
        {info && <div className="mt-5 overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>School</th><th>Opted-in staff</th><th>SMS requests</th><th>Submitted</th><th>Credits used</th></tr></thead>
            <tbody>{info.schools.map(s=><tr key={s.school_id}>
              <td className="font-semibold">{s.school_name}</td>
              <td>{s.opted_in_staff}</td><td>{s.messages}</td><td>{s.submitted}</td><td>{s.credits_used}</td>
            </tr>)}</tbody>
          </table>
          {!info.schools.length && <Empty>No school SMS activity to report yet.</Empty>}
        </div>}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2"><Activity size={19} className="text-emerald-700"/><h3 className="font-bold">Daily sending protection</h3></div>
          <p className="mt-3 text-sm text-muted">Current server-enforced limits protect EduReport&apos;s central SMS budget.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-muted">Across all schools/day</p><p className="mt-1 text-xl font-bold">{info?.global_daily_limit ?? "—"}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-muted">Per school/day</p><p className="mt-1 text-xl font-bold">{info?.school_daily_limit ?? "—"}</p></div>
          </div>
        </section>
        <section className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2"><KeyRound size={19} className="text-emerald-700"/><h3 className="font-bold">Security and future billing</h3></div>
          <p className="mt-3 text-sm leading-6 text-muted">The Arkesel API key stays on the server and is never shown to schools. We will later support purchased school credits using this same central gateway and separate school usage records.</p>
          <p className="mt-3 text-xs font-semibold text-amber-800">School wallet purchasing is not active yet.</p>
        </section>
      </div>
    </div>
  );
}
