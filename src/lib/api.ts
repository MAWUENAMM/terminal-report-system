import { browserClient } from "./supabase/client";
import { supabaseKey, supabaseUrl } from "./supabase/config";
export async function staffAction(body: Record<string, unknown>) {
  const client = browserClient();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) throw new Error("Sign in again to continue.");
  const response = await fetch(`${supabaseUrl}/functions/v1/school-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The request could not be completed.");
  return data;
}
export async function saveRows(
  table: string,
  rows: Record<string, unknown>[],
  onConflict?: string,
) {
  if (!rows.length) return;
  const { data, error } = await browserClient()
    .from(table)
    .upsert(rows, { onConflict })
    .select("id");
  if (error) throw new Error(error.message);
  if (data?.length !== rows.length)
    throw new Error(
      "Some records could not be saved. Refresh and check your permissions.",
    );
}
export async function updateRow(
  table: string,
  id: string,
  values: Record<string, unknown>,
) {
  const { data, error } = await browserClient()
    .from(table)
    .update(values)
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length)
    throw new Error(
      "This record could not be changed. Check your access and refresh.",
    );
}
export async function deleteRow(table: string, id: string) {
  const { data, error } = await browserClient()
    .from(table)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("This record could not be removed.");
}
