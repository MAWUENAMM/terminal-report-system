import { createClient } from "npm:@supabase/supabase-js@2.117.2";

// STAGING ONLY. This function must never be deployed to the production project.
// Payment SMS remains disabled. One Arkesel attempt may be authorized for the
// existing opted-in staging pilot recipient via a private, single-use permit.
const STAGING_URL = "https://ymoyqresvsxetvnkwsxq.supabase.co";
const url = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const providerKey = Deno.env.get("ARKESEL_API_KEY") || "";
const pilotSchool = Deno.env.get("ARKESEL_SMS_PILOT_SCHOOL_ID") || "";
const pilotPhones = new Set((Deno.env.get("ARKESEL_SMS_PILOT_RECIPIENTS") || "")
  .split(",").map((value) => value.trim()).filter(Boolean));
const sender = "Ark Academy";
const validUuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(value);
const normalizePhone = (value: unknown) =>
  String(value || "").replace(/[\s()-]/g, "")
    .replace(/^0([25]\d{8})$/, "+233$1")
    .replace(/^233([25]\d{8})$/, "+233$1");
const allowedOrigin = (value: string) =>
  /^https:\/\/terminal-report-system(?:-[a-z0-9-]+-mawuenam)?\.vercel\.app$/.test(value) ||
  value === "http://localhost:3000";
const headers = (origin: string) => ({
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "Access-Control-Allow-Origin": allowedOrigin(origin) ? origin : "https://terminal-report-system.vercel.app",
  "Access-Control-Allow-Headers": "authorization,apikey,x-client-info,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
});
const response = (origin: string, status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: headers(origin) });

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== "POST") return response(origin, 405, { error: "POST required" });
  if (origin && !allowedOrigin(origin)) return response(origin, 403, { error: "Origin rejected" });
  if (url !== STAGING_URL || !anon || !serviceRole) {
    return response(origin, 503, { error: "Isolated staging project required" });
  }
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return response(origin, 401, { error: "Sign in as Platform Administrator" });
  let body: { action?: string; test_phone?: string; test_request_id?: string;
    test_confirmed?: boolean; test_sender_id?: string };
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) throw new Error("Request too large");
    body = await request.json();
  } catch {
    return response(origin, 400, { error: "Invalid request" });
  }
  const authClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: identity, error: authError } = await authClient.auth.getUser(token);
  if (authError || !identity.user) return response(origin, 401, { error: "Invalid session" });
  // The existing RPC enforces platform_operators, not school staff role labels.
  const { error: operatorError } = await authClient.rpc("sms_platform_dashboard");
  if (operatorError) return response(origin, 403, { error: "Platform Administrator required" });
  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const configured = validUuid(pilotSchool) && pilotPhones.size === 1 &&
    [...pilotPhones].every((v) => /^\+233[25][0-9]{8}$/.test(v)) &&
    Boolean(providerKey);
  const { data: permit, error: permitError } = await admin
    .from("sms_staging_diagnostic_permit")
    .select("enabled,consumed_at").eq("singleton", true).maybeSingle();
  const { data: config, error: configError } = await admin
    .from("sms_central_settings")
    .select("sending_enabled,sender_id,global_daily_limit,school_daily_limit")
    .eq("singleton", true).maybeSingle();
  const { data: override, error: overrideError } = await admin
    .from("sms_school_sender_ids")
    .select("sender_id,enabled_for_school_sms")
    .eq("school_id",pilotSchool).maybeSingle();
  const { data: staff, error: staffError } = await admin
    .from("school_users").select("phone")
    .eq("school_id", pilotSchool).eq("active",true)
    .eq("must_change_password",false).eq("sms_opt_in",true)
    .in("role",["ADMIN","ACCOUNTANT"]);
  const { data: school, error: schoolError } = await admin
    .from("schools").select("active,deleted_at")
    .eq("id",pilotSchool).maybeSingle();
  const { count: existingTests, error: testCountError } = await admin
    .from("sms_test_outbox").select("id",{count:"exact",head:true});
  const ready = configured && !permitError && !!permit?.enabled && !permit.consumed_at &&
    !configError && config?.sending_enabled === false &&
    config.sender_id === "EDUREPORT" &&
    config.global_daily_limit === 1 && config.school_daily_limit === 1 &&
    !overrideError && override?.sender_id === sender && override.enabled_for_school_sms === false &&
    !staffError && Array.isArray(staff) && staff.length === 1 &&
    pilotPhones.has(staff[0].phone) && !schoolError &&
    school?.active === true && school.deleted_at === null &&
    !testCountError && existingTests === 0;
  if (body.action === "status") {
    return response(origin,200,{
      staging_only:true, available:ready, used:!!permit?.consumed_at,
      sender_id:sender, sms_payment_sending_enabled:config?.sending_enabled === true,
      requirement:"One consenting, opted-in staging pilot recipient. One paid test maximum.",
      message:ready ? "One authorized Ark Academy staging test is ready. Payment SMS stays disabled." :
        "Staging test is unavailable, incomplete, or already used. No SMS was sent.",
    });
  }
  if (body.action !== "test_send") return response(origin,400,{error:"Unknown action"});
  if (!ready) return response(origin,409,{
    error:"The one-time staging test is not available or was already used.",
  });
  if (body.test_sender_id !== sender || body.test_confirmed !== true ||
      !validUuid(body.test_request_id)) {
    return response(origin,400,{error:"Explicitly confirm one Ark Academy paid staging test"});
  }
  const phone=normalizePhone(body.test_phone);
  if (!/^\+233[25][0-9]{8}$/.test(phone) || !pilotPhones.has(phone)) {
    return response(origin,403,{
      error:"Use the already-opted-in, authorized staging pilot phone number only.",
    });
  }
  // Single conditional database update: at most ONE concurrent request may claim.
  // A request timeout or an outbox failure still consumes the permit, preventing retries.
  const { data: claimed, error: claimError } = await admin
    .from("sms_staging_diagnostic_permit")
    .update({ consumed_at:new Date().toISOString(), consumed_by:identity.user.id,
      updated_at:new Date().toISOString() })
    .eq("singleton",true).eq("enabled",true).is("consumed_at",null)
    .select("singleton").maybeSingle();
  if (claimError || !claimed) {
    return response(origin,409,{error:"Staging test permit already claimed or unavailable"});
  }
  const message="Ark Academy: EduReport staging SMS test. No student or payment records were changed.";
  const { data: testRecord, error: auditError } = await admin.from("sms_test_outbox")
    .insert({ request_key:body.test_request_id, requested_by:identity.user.id,
      phone_e164:phone, sender_id:sender, message, status:"PROCESSING",
      send_started_at:new Date().toISOString() })
    .select("id").maybeSingle();
  if (auditError || !testRecord) {
    return response(origin,500,{
      error:"Unable to record the staging attempt. Permit consumed; no SMS submitted.",
    });
  }
  let status="UNKNOWN", providerId: string|null=null, credits=0, verified=false;
  let lastError: string|null="Arkesel outcome uncertain. Do not retry.";
  try {
    const call=await fetch("https://sms.arkesel.com/api/v2/sms/send",{
      method:"POST", signal:AbortSignal.timeout(12000),
      headers:{"Content-Type":"application/json","api-key":providerKey},
      body:JSON.stringify({sender,message,recipients:[phone]}),
    });
    const payload=await call.json().catch(()=>null);
    const item=Array.isArray(payload?.data)?payload.data[0]:payload?.data;
    const accepted=call.ok && payload?.status==="success" &&
      typeof item?.id==="string" && item.id.length>0;
    const ambiguous=call.ok && payload?.status==="success" && !accepted;
    status=accepted?"SUBMITTED":ambiguous?"UNKNOWN":"FAILED";
    providerId=accepted?item.id:null;
    lastError=accepted?null:ambiguous?"Provider acknowledged without message ID":
      "Provider rejected request; inspect Arkesel before any new test.";
    const used=item?.credits_used ?? payload?.credits_used;
    verified=accepted && used!==undefined && used!==null &&
      (typeof used==="number" || (typeof used==="string" && /^\d+$/.test(used))) &&
      Number.isSafeInteger(Number(used)) && Number(used)>=0;
    credits=accepted?(verified?Number(used):1):0;
  } catch {
    // UNKNOWN is intentional; never automatically retry a potentially delivered SMS.
  }
  const { error: writeError } = await admin.from("sms_test_outbox")
    .update({status,provider_message_id:providerId,credits_used:credits,
      credits_verified:verified,last_error:lastError,updated_at:new Date().toISOString()})
    .eq("id",testRecord.id).eq("status","PROCESSING");
  if (writeError) return response(origin,200,{
    mode:"UNKNOWN",message:"Arkesel result cannot be verified. Check provider before any follow-up.",
  });
  return response(origin,200,{
    mode:status==="SUBMITTED"?"TEST_SUBMITTED":status==="FAILED"?"TEST_FAILED":"UNKNOWN",
    sender_id:sender,submitted:status==="SUBMITTED"?1:0,
    message:status==="SUBMITTED"?"Arkesel accepted the staging test. Verify handset receipt.":
      status==="FAILED"?"Arkesel rejected the request. One-time test consumed.":
      "Response uncertain. Do not retry; check Arkesel logs and handset.",
  });
});
