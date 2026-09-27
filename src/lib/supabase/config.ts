import project from "./project.json";
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || project.url;
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || project.publishableKey;
