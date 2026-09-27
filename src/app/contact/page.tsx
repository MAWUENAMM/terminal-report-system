import { PublicPage } from "@/components/public-layout";
import { RequestForm } from "@/components/request-form";
export default function Contact() {
  return (
    <PublicPage
      title="Contact EduReport"
      intro="Ask about school access, report a problem or request help with your information. For staff password resets, contact your school administrator first."
    >
      <RequestForm kind="CONTACT" />
    </PublicPage>
  );
}
