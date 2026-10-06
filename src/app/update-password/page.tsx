import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import UpdatePasswordForm from "@/components/update-password-form";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?error=expired");

  const params = await searchParams;
  return <UpdatePasswordForm errorCode={params.error} />;
}
