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
// SMS pilot is opt-in at THREE layers: database flag, Edge Function flag,
// and an allowlisted school/phone list. Empty or invalid secrets fail CLOSED.
const pilotSchool = Deno.env.get("ARKESEL_SMS_PILOT_SCHOOL_ID") || "";
const allowedPilotPhones = new Set(
  (Deno.env.get("ARKESEL_SMS_PILOT_RECIPIENTS") || "")
    .split(",").map((phone) => phone.trim()).filter(Boolean),
);
const pilotConfigured =
  /^[0-9a-fA-F-]{36}$/.test(pilotSchool) &&
  allowedPilotPhones.size > 0 &&
  [...allowedPilotPhones].every((phone) => /^\+233[25][0-9]{8}$/.test(phone));
const providerKey = Deno.env.get("ARKESEL_API_KEY") || "";
const edgeLiveEnabled = Deno.env.get("ARKESEL_SMS_LIVE_ENABLED") === "true";
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
    const readiness = {
      api_key_configured: Boolean(providerKey),
      edge_live_enabled: edgeLiveEnabled,
      pilot_restrictions_configured: pilotConfigured,
      database_sending_enabled: data?.sending_enabled === true,
      sender_id: data?.sender_id || "EDUREPORT",
      // A balance check NEVER proves sender ID/carrier approval or delivery.
      sender_approval_verified: false,
    };
    if (!providerKey) return reply(origin, 200, { dashboard: data, balance: null, connected: false, readiness });
    try {
      const response = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
        method: "GET", headers: { "api-key": providerKey },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return reply(origin, 200, { dashboard: data, balance: null, connected: false, readiness });
      const value = await response.json();
      return reply(origin, 200, { dashboard: data, balance: value, connected: true, readiness });
    } catch {
      return reply(origin, 200, { dashboard: data, balance: null, connected: false, readiness });
    }
  }

  if (body.action !== "notify" || !/^[0-9a-fA-F-]{36}$/.test(body.payment_id || "")) {
    return reply(origin, 400, { error: "Invalid payment or action" });
  }

  // Read configuration before queuing so missing secrets cannot produce
  // orphaned outbox rows that might later be sent unexpectedly.
  const { data: config, error: configError } = await admin.from("sms_central_settings")
    .select("sending_enabled,sender_id").eq("singleton", true).single();
  if (configError || !config) return reply(origin, 503, { error: "SMS configuration unavailable" });
  if (config.sender_id !== "EDUREPORT") return reply(origin, 409, { error: "Expected EDUREPORT sender configuration" });

  if (config.sending_enabled) {
    if (!edgeLiveEnabled || !providerKey || !pilotConfigured) {
      return reply(origin, 200, {
        mode: "CONFIG_PENDING", queued: 0,
        message: "SMS is paused. API key, pilot school/recipients and two activation gates are required.",
      });
    }
    // This is a temporary, explicit pilot ONLY. Authenticated staff must still
    // pass the existing school/finance authorization inside sms_request_payment.
    const { data: payment, error: paymentError } = await admin.from("finance_payments")
      .select("school_id").eq("id", body.payment_id).maybeSingle();
    if (paymentError || !payment || payment.school_id !== pilotSchool) {
      return reply(origin, 403, { error: "Live SMS is restricted to the authorized pilot school" });
    }
    const { data: recipients, error: recipientsError } = await admin.from("school_users")
      .select("phone").eq("school_id", pilotSchool).eq("active", true)
      .eq("must_change_password", false).eq("sms_opt_in", true)
      .in("role", ["ADMIN", "ACCOUNTANT"]);
    if (recipientsError) return reply(origin, 503, { error: "Unable to verify pilot recipients" });
    // Fail the whole attempt rather than silently sending some recipients or
    // queueing phone numbers outside the authorized pilot allowlist.
    if ((recipients || []).some((r) => !allowedPilotPhones.has(r.phone))) {
      return reply(origin, 409, {
        error: "An opted-in staff phone is not on the pilot allowlist. No SMS was queued.",
      });
    }
  }

  // Privileged queuing happens in PostgreSQL, not from browser-provided phones.
  const { data: queue, error: qError } = await userClient.rpc("sms_request_payment", {
    p_payment_id: body.payment_id,
  });
  if (qError) return reply(origin, 403, { error: qError.message });
  if (queue?.mode !== "READY") return reply(origin, 200, queue);

  const ids = Array.isArray(queue.ids) ? queue.ids.filter((id: unknown) =>
    typeof id === "string" && /^[0-9a-fA-F-]{36}$/.test(id)) : [];
  if (!ids.length) return reply(origin, 200, {
    mode: "READY", queued: 0, submitted: 0,
    message: "No new SMS to send. Earlier notifications are not duplicated.",
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
      if (item.sender_id !== "EDUREPORT" || item.school_id !== pilotSchool ||
          !allowedPilotPhones.has(item.phone_e164)) {
        // Never silently convert an unauthorized destination into a live send.
        throw new Error("Pilot restriction failed");
      }
      const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST", signal: AbortSignal.timeout(12000),
        headers: { "Content-Type": "application/json", "api-key": providerKey },
        body: JSON.stringify({
          sender: item.sender_id,
          message: item.body,
          recipients: [item.phone_e164],
        }),
      });
      const value = await response.json().catch(() => null);
      // Arkesel responses may contain a per-recipient array or a single item.
      const providerItem = Array.isArray(value?.data) ? value.data[0] : value?.data;
      const accepted = response.ok && value?.status === "success" &&
        typeof providerItem?.id === "string" && providerItem.id.length > 0;
      const ambiguous = response.ok && value?.status === "success" && !accepted;
      const status = accepted ? "SUBMITTED" : ambiguous ? "UNKNOWN" : "FAILED";
      if (accepted) submitted++; else if (ambiguous) unknown++; else failed++;
      const rawCredits = Number(providerItem?.credits_used ?? value?.credits_used ?? 0);
      await admin.from("sms_outbox").update({
        status,
        provider_message_id: accepted ? providerItem.id : null,
        credits_used: accepted && Number.isFinite(rawCredits) ? Math.min(100, Math.max(0, rawCredits)) : 0,
        last_error: accepted ? null : ambiguous
          ? "Provider response accepted but message ID missing; verify in Arkesel before retry."
          : "Arkesel rejected the request. Check its dashboard.",
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
