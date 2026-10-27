import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

// ONE-TIME staging setup. This route must be deleted immediately after provisioning.
// Does not store or expose service-role credentials. The existing Edge Function enforces
// the one-use bootstrap hash and the authenticated school-admin permission checks.
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function reply(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.NEXT_PUBLIC_EDUREPORT_TESTING !== "true")
    return reply("Not found.", 404);
  const expected = process.env.EDUREPORT_STAGING_TRIGGER || "";
  if (!safeEqual(request.nextUrl.searchParams.get("key") || "", expected))
    return reply("Not found.", 404);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const setup = process.env.EDUREPORT_STAGING_SETUP_TOKEN || "";
  if (!url.startsWith("https://ymoyqresvsxetvnkwsxq.supabase.co") ||
      !key || setup.length < 40)
    return reply("Testing backend not configured.", 503);

  const endpoint = url + "/functions/v1/school-admin";
  const adminEmail = "finance.admin@edureport-demo.test";
  const accountantEmail = "finance.accountant@edureport-demo.test";

  try {
    if (request.nextUrl.searchParams.get("mode") === "accountant") {
      const adminTemp = process.env.EDUREPORT_STAGING_ADMIN_TEMP_PASSWORD || "";
      if (adminTemp.length < 20) return reply("Testing admin credential not configured.", 503);
      const tokenRes = await fetch(url + "/auth/v1/token?grant_type=password", {
        method:"POST",
        headers:{"Content-Type":"application/json",apikey:key},
        body:JSON.stringify({email:adminEmail,password:adminTemp}),
        cache:"no-store"
      });
      const token = await tokenRes.json();
      if(!tokenRes.ok || !token.access_token)
        return reply("Test admin sign-in failed: "+String(token.error_description||token.msg||token.error||"No session"),502);
      const created=await fetch(endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json",apikey:key,Authorization:"Bearer "+token.access_token},
        body:JSON.stringify({
          action:"create_staff",
          full_name:"Finance Test Accountant",
          email:accountantEmail,
          role:"ACCOUNTANT",
          active:true
        }),
        cache:"no-store"
      });
      const data=await created.json();
      if(!created.ok) return reply("Accountant creation failed: "+String(data.error||created.status),created.status);
      return NextResponse.json({success:true,accountant:{email:accountantEmail,password:data.temporaryPassword}},
        {headers:{"Cache-Control":"no-store"}});
    }
    const bootstrap = await fetch(endpoint, {
      method: "POST",
      headers: {"Content-Type":"application/json",apikey:key,"x-setup-token":setup},
      body: JSON.stringify({
        action:"bootstrap",
        full_name:"Finance Test Administrator",
        school_name:"EduReport Finance Testing School"
      }),
      cache:"no-store"
    });
    const admin = await bootstrap.json();
    if (!bootstrap.ok) return reply("Bootstrap failed: "+(admin.error||bootstrap.status),bootstrap.status);

    const sessionResponse = await fetch(url + "/auth/v1/token?grant_type=password",{
      method:"POST",
      headers:{"Content-Type":"application/json",apikey:key},
      body:JSON.stringify({email:adminEmail,password:admin.temporaryPassword}),
      cache:"no-store"
    });
    const session = await sessionResponse.json();
    if (!sessionResponse.ok || !session.access_token)
      return NextResponse.json({
        warning:"Admin was created; the accountant still needs creation.",
        admin:{email:adminEmail,password:admin.temporaryPassword},
        detail:String(session.error_description||session.msg||session.error||"Login failed")
      },{headers:{"Cache-Control":"no-store"}});

    const staffResponse = await fetch(endpoint,{
      method:"POST",
      headers:{"Content-Type":"application/json",apikey:key,Authorization:"Bearer "+session.access_token},
      body:JSON.stringify({action:"create_staff",full_name:"Finance Test Accountant",email:accountantEmail,role:"ACCOUNTANT",active:true}),
      cache:"no-store"
    });
    const staff = await staffResponse.json();
    if (!staffResponse.ok)
      return NextResponse.json({
        warning:"Admin created; accountant creation needs attention.",
        admin:{email:adminEmail,password:admin.temporaryPassword},
        detail:String(staff.error||staffResponse.status)
      },{headers:{"Cache-Control":"no-store"}});

    return NextResponse.json({
      success:true,
      staging:true,
      admin:{email:adminEmail,password:admin.temporaryPassword},
      accountant:{email:accountantEmail,password:staff.temporaryPassword}
    },{headers:{"Cache-Control":"no-store"}});
  }catch(e){
    return reply("Staging setup could not complete: "+(e instanceof Error?e.message:"request error"),502);
  }
}
