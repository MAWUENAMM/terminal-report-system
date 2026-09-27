import LoginForm from "@/components/login-form";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const params = await searchParams;
  return (
    <LoginForm
      errorCode={params.error}
      updated={params.updated !== undefined}
    />
  );
}
