import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./config";
export function browserClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
