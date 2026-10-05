"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  Inbox,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Empty, Restricted, Modal } from "@/components/ui";
import { browserClient } from "@/lib/supabase/client";
import { staffAction } from "@/lib/api";

type SchoolRequest = {
  id: string;
  kind: string;
  school_name: string;
  contact_name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  created_at: string;
  school_id: string | null;
};

type Filter = "PENDING" | "HISTORY" | "ALL";

export default function Requests() {
  const { data: w, run, busy } = useWorkspace();
  const [requests, setRequests] = useState<SchoolRequest[]>([]);
  const [credentials, setCredentials] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("PENDING");

  async function load() {
    setError("");
    const { data, error } = await browserClient()
      .from("school_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRequests(data || []);
  }

  useEffect(() => {
    if (w.operator) void Promise.resolve().then(load);
  }, [w.operator]);

  const pending = useMemo(
    () => requests.filter((request) => request.status === "PENDING"),
    [requests],
  );
  const history = useMemo(
    () => requests.filter((request) => request.status !== "PENDING"),
    [requests],
  );
  const visible = useMemo(
    () =>
      filter === "PENDING" ? pending : filter === "HISTORY" ? history : requests,
    [filter, history, pending, requests],
  );

  if (!w.operator) return <Restricted />;

  async function clearRequest(request: SchoolRequest) {
    if (request.status === "PENDING") return;
    if (
      !confirm(
        `Clear this ${request.status.toLowerCase()} request from history? This cannot be undone.`,
      )
    )
      return;

    await run(async () => {
      await staffAction({
        action: "clear_request",
        request_id: request.id,
      });
      await load();
    }, "Resolved request cleared.");
  }

  async function clearResolved() {
    if (!history.length) return;
    if (
      !confirm(
        `Clear all ${history.length} resolved, declined and approved request records? Pending requests will not be touched.`,
      )
    )
      return;

    await run(async () => {
      await staffAction({ action: "clear_resolved_requests" });
      await load();
    }, "Resolved request history cleared.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Platform administration"
        title="School access & contact requests"
        description="Review new submissions, keep pending items visible, and clear completed request history when you no longer need it."
      >
        <Link href="/dashboard/schools" className="btn-primary">
          Manage approved schools
        </Link>
        <button
          className="btn-secondary"
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
        {history.length > 0 && (
          <button
            className="btn-secondary !border-red-200 !text-red-700 hover:!bg-red-50"
            onClick={() => void clearResolved()}
            disabled={busy}
          >
            <Trash2 size={16} />
            Clear resolved ({history.length})
          </button>
        )}
      </PageHeader>

      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}


      <section className="surface rounded-2xl p-2">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["PENDING", "Pending", pending.length, Clock3],
            ["HISTORY", "Resolved / history", history.length, CheckCircle2],
            ["ALL", "All requests", requests.length, Inbox],
          ].map(([key, label, count, Icon]) => {
            const C = Icon as typeof Inbox;
            const active = filter === key;
            return (
              <button
                key={String(key)}
                onClick={() => setFilter(key as Filter)}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                  active
                    ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                    : "hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl ${
                      active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <C size={17} />
                  </span>
                  <span className="text-sm font-semibold">{String(label)}</span>
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums shadow-sm">
                  {Number(count)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {visible.length ? (
        <div className="space-y-4">
          {visible.map((request) => {
            const pendingRequest = request.status === "PENDING";
            const approved = request.status === "APPROVED";
            const resolved = request.status === "RESOLVED";
            const declined = request.status === "DECLINED";

            return (
              <section
                key={request.id}
                className="surface rounded-2xl p-6 transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="eyebrow">
                        {request.kind === "ACCESS"
                          ? "School access"
                          : "Contact message"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          pendingRequest
                            ? "bg-amber-50 text-amber-700"
                            : approved
                              ? "bg-emerald-50 text-emerald-700"
                              : resolved
                                ? "bg-sky-50 text-sky-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {pendingRequest && <Clock3 size={12} />}
                        {approved && <CheckCircle2 size={12} />}
                        {resolved && <CheckCircle2 size={12} />}
                        {declined && <XCircle size={12} />}
                        {request.status}
                      </span>
                    </div>

                    <h2 className="mt-2 text-lg font-semibold">
                      {request.school_name}
                    </h2>
                    <p className="mt-2 break-words text-sm text-muted">
                      {request.contact_name} · {request.email}
                      {request.phone && ` · ${request.phone}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <time className="text-xs text-muted">
                      {new Date(request.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                    {!pendingRequest && (
                      <button
                        className="rounded-xl border border-red-100 p-2.5 text-red-600 transition hover:bg-red-50"
                        title="Clear this completed request"
                        aria-label="Clear this completed request"
                        onClick={() => void clearRequest(request)}
                        disabled={busy}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
                  {request.message || "No additional message was supplied."}
                </p>

                {pendingRequest && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {request.kind === "ACCESS" && (
                      <button
                        disabled={busy}
                        className="btn-primary"
                        onClick={() => {
                          if (
                            confirm(
                              `Create a school workspace and administrator account for ${request.email}?`,
                            )
                          )
                            void run(async () => {
                              setCredentials(
                                await staffAction({
                                  action: "approve_request",
                                  request_id: request.id,
                                }),
                              );
                              await load();
                            }, "School workspace created.");
                        }}
                      >
                        Approve school access
                      </button>
                    )}
                    <button
                      disabled={busy}
                      className="btn-secondary"
                      onClick={() =>
                        void run(async () => {
                          await staffAction({
                            action: "resolve_request",
                            request_id: request.id,
                          });
                          await load();
                        }, "Request updated.")
                      }
                    >
                      {request.kind === "ACCESS"
                        ? "Decline request"
                        : "Mark resolved"}
                    </button>
                  </div>
                )}

                {request.school_id && (
                  <Link href="/dashboard/schools" className="btn-secondary mt-4">
                    Manage school
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <Empty>
          {filter === "PENDING"
            ? "No pending requests. New website submissions will appear here."
            : filter === "HISTORY"
              ? "No resolved request history."
              : "No school or contact requests yet."}
        </Empty>
      )}

      {credentials && (
        <Modal
          title="School administrator sign-in"
          onClose={() => setCredentials(null)}
        >
          <p className="text-sm leading-6 text-muted">
            Share these details privately with the verified school
            representative. They must change their password before using school
            records.
          </p>
          <div className="my-5 space-y-3 rounded-xl bg-paper p-4">
            <p className="break-all">
              Email: <strong>{credentials.email}</strong>
            </p>
            <p className="break-all">
              Initial password: <code>{credentials.temporaryPassword}</code>
            </p>
          </div>
          <button className="btn-primary" onClick={() => setCredentials(null)}>
            I have saved the details
          </button>
        </Modal>
      )}
    </>
  );
}
