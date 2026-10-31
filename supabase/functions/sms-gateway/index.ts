import { createClient } from "npm:@supabase/supabase-js@2.117.2";

/**
 * EduReport central Arkesel gateway.
 * Explicitly disabled until the Platform Administrator authorizes real sends,
 * the EDUREPORT Sender ID is approved, and secrets are configured.
 * All user actions are authenticated and authorized by RLS-aware RPCs.
 */
const url = Deno.env.get("SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const allowedOrigins = (origin: string) =>
  /^https:\/\/terminal-report-system(?:-[a-z0-9-]+-mawuenam)?\.vercel\.app$/.test(origin) ||
  origin === "http://localhost:3000";
const headersFor = (origin: string) => ({
  "Access-Control-Allow-Origin": allowedOrigins(origin) ? origin : "https://terminal-report-system.vercel.app",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "Content-Type": "application/json",
});
const reply = (origin: string, code: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: code, headers: headersFor(origin) });

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(origin) });
  if (request.method !== "POST") return reply(origin, 405, { error: "POST only" });
  if (origin && !allowedOrigins(origin)) return reply(origin, 403, { error: "Origin not allowed" });
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token || !url || !anon || !serviceRole) return reply(origin, 401, { error: "Not signed in" });

  let body: { action?: string; payment_id?: string };
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) throw new Error("Request too large");
    body = await request.json();
  } catch { return reply(origin, 400, { error: "Invalid request" }); }

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const user = await userClient.auth.getUser(token);
  if (user.error || !user.data.user) return reply(origin, 401, { error: "Session expired" });
  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.action === "balance") {
    // This is a platform-only endpoint; the RPC checks platform_operators.
    const { data, error } = await userClient.rpc("sms_platform_dashboard");
    if (error) return reply(origin, 403, { error: "Platform Administrator access required" });
    const key = Deno.env.get("ARKESEL_API_KEY");
    if (!key) return reply(origin, 200, { dashboard: data, balance: null, connected: false });
    try {
      const response = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
        method: "GET", headers: { "api-key": key },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return reply(origin, 200, { dashboard: data, balance: null, connected: false });
      const value = await response.json();
      return reply(origin, 200, { dashboard: data, balance: value, connected: true });
    } catch {
      return reply(origin, 200, { dashboard: data, balance: null, connected: false });
    }
  }

  if (body.action !== "notify" || !/^[0-9a-fA-F-]{36}$/.test(body.payment_id || "")) {
    return reply(origin, 400, { error: "Invalid payment or action" });
  }

  // Privileged queuing happens in PostgreSQL, not from untrusted browser values.
  const { data: queue, error: qError } = await userClient.rpc("sms_request_payment", {
    p_payment_id: body.payment_id,
  });
  if (qError) return reply(origin, 403, { error: qError.message });
  if (queue?.mode !== "READY") return reply(origin, 200, queue);

  // Send is explicitly disabled separately from SQL until sender approval.
  const key = Deno.env.get("ARKESEL_API_KEY");
  const live = Deno.env.get("ARKESEL_SMS_LIVE_ENABLED") === "true";
  if (!live || !key) return reply(origin, 200, {
    mode: "CONFIG_PENDING", eligible: queue.eligible, queued: queue.queued || 0,
    message: "SMS queued but Arkesel sending is not yet activated."
  });
  const ids = Array.isArray(queue.ids) ? queue.ids.filter((id: unknown) =>
    typeof id === "string" && /^[0-9a-fA-F-]{36}$/.test(id)) : [];
  if (!ids.length) return reply(origin, 200, {
    mode: "READY", queued: 0, sent: 0, message: "No new SMS to send. Earlier notifications are not duplicated."
  });

  // Atomic claim: only one process can send each queued recipient. Timeouts are
  // UNKNOWN (no automatic retry), because a provider may have accepted the SMS.
  const { data: claimed, error: claimError } = await admin.from("sms_outbox")
    .update({ status: "PROCESSING", send_started_at: new Date().toISOString() })
    .in("id", ids).eq("status", "QUEUED")
    .select("id,school_id,phone_e164,body,sender_id");
  if (claimError) return reply(origin, 500, { error: "Could not safely claim outgoing messages" });
  let submitted = 0, failed = 0, unknown = 0;
  for (const item of claimed || []) {
    try {
      if (item.sender_id !== "EDUREPORT") throw new Error("Invalid sender ID");
      const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST", signal: AbortSignal.timeout(12000),
        headers: { "Content-Type": "application/json", "api-key": key },
        body: JSON.stringify({
          sender: item.sender_id,
          message: item.body,
          recipients: [item.phone_e164],
        }),
      });
      const value = await response.json().catch(() => null);
      const accepted = response.ok && value?.status === "success";
      const status = accepted ? "SUBMITTED" : "FAILED";
      if (accepted) submitted++; else failed++;
      await admin.from("sms_outbox").update({
        status,
        provider_message_id: accepted ? String(value?.data?.id || "") || null : null,
        credits_used: accepted ? Math.max(0, Number(value?.data?.credits_used || 0)) : 0,
        last_error: accepted ? null : "Arkesel rejected the request. Check its dashboard.",
        updated_at: new Date().toISOString(),
      }).eq("id", item.id).eq("status", "PROCESSING");
    } catch {
      unknown++;
      await admin.from("sms_outbox").update({
        status: "UNKNOWN",
        last_error: "Delivery result unknown; check Arkesel before any retry.",
        updated_at: new Date().toISOString(),
      }).eq("id", item.id).eq("status", "PROCESSING");
    }
  }
  return reply(origin, 200, {
    mode: "LIVE", queued: ids.length, submitted, failed, unknown,
    message: "SUBMITTED means accepted by Arkesel, not delivered to the handset."
  });
});
