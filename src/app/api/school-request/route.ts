import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/config";
const schema = z.object({
  kind: z.enum(["ACCESS", "CONTACT"]),
  school_name: z.string().trim().min(2).max(150),
  contact_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(35).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  consent: z.literal("on"),
  website: z.string().max(200).optional(),
});
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Please submit the form from this website." },
      { status: 403 },
    );
  const raw = await request.text();
  if (raw.length > 12000)
    return NextResponse.json(
      { error: "Request is too large." },
      { status: 413 },
    );
  let input;
  try {
    input = schema.safeParse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!input.success)
    return NextResponse.json(
      { error: "Check the required fields and consent checkbox." },
      { status: 400 },
    );
  const { consent, website, ...fields } = input.data;
  if (website) return NextResponse.json({ success: true });
  const { error } = await createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })
    .from("school_requests")
    .insert({ ...fields, email: fields.email.toLowerCase() });
  if (error && error.code !== "23505")
    return NextResponse.json(
      {
        error: error.message.includes("Request limit")
          ? "Too many requests. Please try again later."
          : "Your request could not be saved. Please try again.",
      },
      { status: 429 },
    );
  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
