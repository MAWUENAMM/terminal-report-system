import { PublicPage } from "@/components/public-layout";
import { RequestForm } from "@/components/request-form";
export default function RequestAccess() {
  return (
    <PublicPage
      title="Bring your school onboard"
      intro="Tell us about your school. We’ll review your request before creating a workspace and its first administrator account."
    >
      <RequestForm />
      <p className="text-muted">
        Already approved? Your administrator can create your individual staff
        account and assign your classes.
      </p>
    </PublicPage>
  );
}
