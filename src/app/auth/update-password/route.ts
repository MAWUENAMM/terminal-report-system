import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new NextResponse("Invalid origin.", { status: 403 });
  }

  const form = await request.formData();
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm_password") || "");

  if (
    password.length < 8 ||
    password.length > 128 ||
    password !== confirm
  ) {
    return NextResponse.redirect(
      new URL("/update-password?error=invalid", request.url),
      303,
    );
  }

  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?error=expired", request.url),
      303,
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.redirect(
      new URL("/update-password?error=invalid", request.url),
      303,
    );
  }

  await supabase.auth.signOut();

  const response = NextResponse.redirect(
    new URL("/login?updated=1", request.url),
    303,
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
