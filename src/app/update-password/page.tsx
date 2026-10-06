import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import UpdatePasswordForm from "@/components/update-password-form";

export default async function UpdatePasswordPage() {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?error=expired");

  return <UpdatePasswordForm />;
}
