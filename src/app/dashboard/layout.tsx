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
  const [{ data: school }, { data: operator }] = await Promise.all([
    client
      .from("schools")
      .select("active,deleted_at")
      .eq("id", profile.school_id)
      .single(),
    client
      .from("platform_operators")
      .select("auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
  ]);
  if ((!school?.active || school.deleted_at) && !operator)
    redirect("/school-inactive");
  return (
    <WorkspaceProvider profile={profile}>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceProvider>
  );
}
