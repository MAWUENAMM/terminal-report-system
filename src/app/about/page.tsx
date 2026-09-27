import Link from "next/link";
import { PublicPage } from "@/components/public-layout";
export default function About() {
  return (
    <PublicPage
      title="Clear reports. Shared responsibility."
      intro="EduReport is a pilot platform for Ghanaian basic schools to organise learner records, assessment and terminal reports."
    >
      <p>
        Each school has its own workspace. Administrators organise staff,
        classes and subjects. Teachers enter information for assigned classes,
        and headmasters review school-wide results and add their remarks.
      </p>
      <p>
        The platform supports CSV and Excel learner imports, weighted SBA and
        examination scores, PDF reports and closed-term archives. School leaders
        remain responsible for reviewing assessment rules and report accuracy.
      </p>
      <p>
        EduReport is an independent service. It does not claim endorsement by
        the Ghana Education Service or another education authority.
      </p>
      <Link href="/request-access" className="btn-primary">
        Request school access
      </Link>
    </PublicPage>
  );
}
