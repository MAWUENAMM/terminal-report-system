import Link from "next/link";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
export const dynamic = "force-dynamic";
export default async function SchoolInactive() {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await client
    .from("school_users")
    .select("school_id,active,must_change_password")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile?.active) redirect("/login?error=inactive");
  if (profile.must_change_password) redirect("/account/password");
  const [{ data: school }, { data: operator }] = await Promise.all([
    client
      .from("schools")
      .select("name,active,deleted_at")
      .eq("id", profile.school_id)
      .single(),
    client
      .from("platform_operators")
      .select("auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
  ]);
  if (operator) redirect("/dashboard/schools");
  if (school?.active && !school.deleted_at) redirect("/dashboard");
  return (
    <main className="grid min-h-screen place-items-center bg-paper p-6">
      <section className="surface w-full max-w-xl rounded-2xl p-8">
        <div className="eyebrow">EduReport</div>
        <h1 className="page-title mt-3">School workspace inactive</h1>
        <p className="mt-4 leading-7 text-muted">
          Access to {school?.name || "your school"} is currently paused. Your
          records are preserved. Contact your school administrator or platform
          support to arrange reactivation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/contact" className="btn-primary">
            Contact support
          </Link>
          <Link href="/dashboard" prefetch={false} className="btn-secondary">
            Check access again
          </Link>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
