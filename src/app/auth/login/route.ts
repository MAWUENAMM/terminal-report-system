import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return new NextResponse("Invalid origin.", { status: 403 });
  const form = await request.formData(),
    email = String(form.get("email") || "").trim(),
    password = String(form.get("password") || "");
  if (!email || !password || email.length > 254 || password.length > 128)
    return NextResponse.redirect(
      new URL("/login?error=invalid", request.url),
      303,
    );
  const { error } = await (
    await serverClient()
  ).auth.signInWithPassword({ email, password });
  const response = NextResponse.redirect(
    new URL(error ? "/login?error=invalid" : "/dashboard", request.url),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
