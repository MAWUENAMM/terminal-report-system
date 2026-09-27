// Privileged Auth operations stay inside Supabase. No service key is returned to the app.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
const url = Deno.env.get("SUPABASE_URL")!;
const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-setup-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const roles = ["ADMIN", "HEADTEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"];
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
function check(error: any) {
  if (error) throw new Error(error.message);
}
function value(x: unknown, min = 1, max = 150) {
  if (typeof x !== "string" || x.trim().length < min || x.trim().length > max)
    throw new Error("A required field is missing or invalid.");
  return x.trim();
}
function email(x: unknown) {
  const e = value(x, 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    throw new Error("Enter a valid email address.");
  return e;
}
function password() {
  return "Edu!" + crypto.randomUUID().replaceAll("-", "").slice(0, 20);
}
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function createIdentity(address: string, name: string) {
  const temporaryPassword = password();
  const { data, error } = await service.auth.admin.createUser({
    email: address,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  check(error);
  if (!data.user) throw new Error("Account could not be created.");
  return { user: data.user, temporaryPassword };
}
async function createSchool(
  address: string,
  contact: string,
  schoolName: string,
  operator = false,
) {
  const identity = await createIdentity(address, contact);
  let schoolId: string | undefined;
  try {
    const { data: school, error } = await service
      .from("schools")
      .insert({
        name: schoolName,
        email: address,
        academic_year: "2026/2027",
        current_term: 1,
      })
      .select()
      .single();
    check(error);
    schoolId = school.id;
    const { error: staffError } = await service
      .from("school_users")
      .insert({
        auth_user_id: identity.user.id,
        school_id: schoolId,
        email: address,
        full_name: contact,
        role: "ADMIN",
        must_change_password: true,
      });
    check(staffError);
    const { error: termError } = await service
      .from("academic_terms")
      .insert({ school_id: schoolId, academic_year: "2026/2027", term: 1 });
    check(termError);
    if (operator) {
      const { error } = await service
        .from("platform_operators")
        .insert({ auth_user_id: identity.user.id });
      check(error);
    }
    return {
      schoolId,
      email: address,
      temporaryPassword: identity.temporaryPassword,
    };
  } catch (e) {
    if (schoolId) await service.from("schools").delete().eq("id", schoolId);
    await service.auth.admin.deleteUser(identity.user.id);
    throw e;
  }
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "POST required." }, 405);
  try {
    const raw = await request.text();
    if (raw.length > 20000) return reply({ error: "Request too large." }, 413);
    const body = JSON.parse(raw);
    const action = body.action;
    if (action === "bootstrap") {
      // Out-of-band one-use secret is the authentication for initial owner setup.
      const token = request.headers.get("x-setup-token") || "";
      if (token.length < 40)
        return reply({ error: "Setup token required." }, 401);
      const { count } = await service
        .from("platform_operators")
        .select("*", { count: "exact", head: true });
      if (count !== 0)
        return reply(
          { error: "Initial setup has already been completed." },
          409,
        );
      const { data: address, error } = await service.rpc(
        "consume_setup_token",
        { hash: await hash(token) },
      );
      check(error);
      if (!address)
        return reply({ error: "Setup token is invalid or expired." }, 401);
      return reply(
        await createSchool(
          address,
          value(body.full_name),
          value(body.school_name),
          true,
        ),
      );
    }
    // JWT verification is implemented here to support both current signing keys and legacy keys.
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer "))
      return reply({ error: "Sign in to continue." }, 401);
    const token = authorization.slice(7);
    const {
      data: { user },
      error: authError,
    } = await service.auth.getUser(token);
    if (authError || !user)
      return reply({ error: "Your session has expired. Sign in again." }, 401);
    const { data: profile, error: profileError } = await service
      .from("school_users")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();
    if (profileError || !profile || !profile.active)
      return reply(
        {
          error: "Your school account is inactive or has not been provisioned.",
        },
        403,
      );
    if (action === "set_password") {
      const nextPassword = value(body.password, 12, 128);
      const { error } = await service.auth.admin.updateUserById(user.id, {
        password: nextPassword,
      });
      check(error);
      const { error: clear } = await service
        .from("school_users")
        .update({ must_change_password: false })
        .eq("id", profile.id);
      check(clear);
      return reply({ success: true });
    }
    if (profile.must_change_password)
      return reply(
        { error: "Choose your own password before continuing." },
        403,
      );
    if (action === "update_profile") {
      const { error } = await service
        .from("school_users")
        .update({
          full_name: value(body.full_name),
          phone: typeof body.phone === "string" ? body.phone.slice(0, 35) : "",
        })
        .eq("id", profile.id);
      check(error);
      return reply({ success: true });
    }
    if (["approve_request", "resolve_request"].includes(action)) {
      const { data: operator } = await service
        .from("platform_operators")
        .select("auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!operator)
        return reply({ error: "Platform owner access required." }, 403);
      const { data: entry, error } = await service
        .from("school_requests")
        .select("*")
        .eq("id", value(body.request_id))
        .eq("status", "PENDING")
        .single();
      check(error);
      if (action === "resolve_request") {
        const { error } = await service
          .from("school_requests")
          .update({
            status: entry.kind === "CONTACT" ? "RESOLVED" : "DECLINED",
          })
          .eq("id", entry.id)
          .eq("status", "PENDING");
        check(error);
        return reply({ success: true });
      }
      if (entry.kind !== "ACCESS")
        return reply(
          { error: "This is a contact message, not a school application." },
          400,
        );
      const result = await createSchool(
        entry.email,
        entry.contact_name,
        entry.school_name,
      );
      const { error: update } = await service
        .from("school_requests")
        .update({ status: "APPROVED", school_id: result.schoolId })
        .eq("id", entry.id)
        .eq("status", "PENDING");
      check(update);
      return reply(result);
    }
    if (profile.role !== "ADMIN")
      return reply(
        { error: "Only a school administrator can manage staff." },
        403,
      );
    if (action === "create_staff") {
      const address = email(body.email),
        name = value(body.full_name),
        role = value(body.role);
      if (!roles.includes(role)) throw new Error("Choose a valid staff role.");
      const identity = await createIdentity(address, name);
      const { error } = await service
        .from("school_users")
        .insert({
          auth_user_id: identity.user.id,
          school_id: profile.school_id,
          full_name: name,
          email: address,
          role,
          must_change_password: true,
        });
      if (error) {
        await service.auth.admin.deleteUser(identity.user.id);
        check(error);
      }
      return reply({
        email: address,
        temporaryPassword: identity.temporaryPassword,
      });
    }
    const { data: target, error } = await service
      .from("school_users")
      .select("*")
      .eq("id", value(body.staff_id))
      .eq("school_id", profile.school_id)
      .single();
    check(error);
    if (action === "update_staff") {
      const role = value(body.role);
      if (!roles.includes(role) || typeof body.active !== "boolean")
        throw new Error("Invalid role or account status.");
      if (target.id === profile.id && (role !== "ADMIN" || !body.active))
        throw new Error("Another administrator must change your own access.");
      const { error } = await service
        .from("school_users")
        .update({ full_name: value(body.full_name), role, active: body.active })
        .eq("id", target.id)
        .eq("school_id", profile.school_id);
      check(error);
      return reply({ success: true });
    }
    if (action === "reset_staff_password") {
      if (target.id === profile.id)
        throw new Error("Change your own password from My profile.");
      const temporaryPassword = password();
      const { error: lock } = await service
        .from("school_users")
        .update({ must_change_password: true })
        .eq("id", target.id);
      check(lock);
      const { error } = await service.auth.admin.updateUserById(
        target.auth_user_id,
        { password: temporaryPassword },
      );
      check(error);
      return reply({ email: target.email, temporaryPassword });
    }
    return reply({ error: "Unknown action." }, 400);
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : "Request failed." },
      400,
    );
  }
});
