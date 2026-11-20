// Fail closed when environment variables are missing: previews must never
// silently fall back to the production Supabase project.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

if (
  process.env.NEXT_PUBLIC_EDUREPORT_TESTING === "true" &&
  supabaseUrl !== "https://ymoyqresvsxetvnkwsxq.supabase.co"
) {
  throw new Error("EduReport testing preview must use the isolated staging Supabase project.");
}
