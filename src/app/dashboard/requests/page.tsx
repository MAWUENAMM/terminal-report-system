"use client";
import { useEffect, useState } from "react";
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
};
export default function Requests() {
  const { data: w, run, busy } = useWorkspace(),
    [requests, setRequests] = useState<SchoolRequest[]>([]),
    [credentials, setCredentials] = useState<{
      email: string;
      temporaryPassword: string;
    } | null>(null),
    [error, setError] = useState("");
  async function load() {
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
  if (!w.operator) return <Restricted />;
  return (
    <>
      <PageHeader
        eyebrow="Platform administration"
        title="School access & contact requests"
        description="Review each representative before approving access. Approval creates a separate school workspace and its initial administrator account."
      >
        <button className="btn-secondary" onClick={() => void load()}>
          Refresh requests
        </button>
      </PageHeader>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {requests.length ? (
        <div className="space-y-4">
          {requests.map((r) => (
            <section key={r.id} className="surface rounded-2xl p-6">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="eyebrow">
                    {r.kind === "ACCESS" ? "School access" : "Contact message"}{" "}
                    · {r.status.toLowerCase()}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold">
                    {r.school_name}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    {r.contact_name} · {r.email} {r.phone && `· ${r.phone}`}
                  </p>
                </div>
                <time className="text-xs text-muted">
                  {new Date(r.created_at).toLocaleDateString("en-GB")}
                </time>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
                {r.message}
              </p>
              {r.status === "PENDING" && (
                <div className="mt-5 flex gap-3">
                  {r.kind === "ACCESS" && (
                    <button
                      disabled={busy}
                      className="btn-primary"
                      onClick={() => {
                        if (
                          confirm(
                            `Create a school workspace and administrator account for ${r.email}?`,
                          )
                        )
                          void run(async () => {
                            setCredentials(
                              await staffAction({
                                action: "approve_request",
                                request_id: r.id,
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
                          request_id: r.id,
                        });
                        await load();
                      }, "Request updated.")
                    }
                  >
                    {r.kind === "ACCESS" ? "Decline request" : "Mark resolved"}
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Empty>
          No requests yet. New submissions from the website appear here.
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
