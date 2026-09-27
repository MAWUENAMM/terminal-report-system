import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url),
    token = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  if (token && ["recovery", "invite", "email"].includes(type || "")) {
    const { error } = await (
      await serverClient()
    ).auth.verifyOtp({ token_hash: token, type: type as EmailOtpType });
    if (!error)
      return NextResponse.redirect(new URL("/account/password", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=expired", url.origin));
}
