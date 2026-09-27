import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { WorkspaceProvider } from "@/components/workspace";
import { DashboardShell } from "@/components/layout/DashboardShell";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await client
    .from("school_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile?.active) redirect("/login?error=inactive");
  if (profile.must_change_password) redirect("/account/password");
  return (
    <WorkspaceProvider profile={profile}>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceProvider>
  );
}
