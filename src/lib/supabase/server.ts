import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./config";
export async function serverClient() {
  const jar = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Middleware persists refresh cookies for Server Components. */
        }
      },
    },
  });
}
