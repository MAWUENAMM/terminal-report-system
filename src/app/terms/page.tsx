import Link from "next/link";
import { PublicPage } from "@/components/public-layout";
export default function Terms() {
  return (
    <PublicPage
      title="Pilot use terms"
      intro="These terms describe participation in the EduReport pilot. Last updated 27 September 2026."
    >
      <section>
        <h2 className="font-semibold text-lg">Approved school access</h2>
        <p>
          A request is reviewed before a school workspace is created. School
          administrators authorise staff accounts and assignments. Use your own
          account, keep your password private and report suspected unauthorised
          access.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-lg">School responsibilities</h2>
        <p>
          Schools are responsible for permission to provide learner information,
          correct records and appropriate staff access. Verify grading weights,
          marks and remarks before issuing reports. This independent service
          does not replace school or education-authority assessment policies.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-lg">Pilot limitations</h2>
        <p>
          Features may change during evaluation. The pilot does not promise
          uninterrupted availability, automatic backups or a particular service
          level. Agree operational support and record-retention arrangements
          before relying on the service for official school operations. Keep
          independent copies of issued reports.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-lg">
          Acceptable use and account changes
        </h2>
        <p>
          Do not attempt to access another school’s records, impersonate staff
          or upload harmful material. A school administrator can deactivate
          staff access. School closure, data export and deletion requests should
          be arranged through the{" "}
          <Link href="/contact" className="underline">
            contact form
          </Link>
          .
        </p>
      </section>
    </PublicPage>
  );
}
