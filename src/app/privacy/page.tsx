import Link from "next/link";
import { PublicPage } from "@/components/public-layout";
export default function Privacy() {
  return (
    <PublicPage
      title="Privacy notice"
      intro="This notice describes the information used by the EduReport pilot. Last updated 27 September 2026."
    >
      <section>
        <h2 className="font-semibold text-lg">Information used</h2>
        <p>
          School requests contain contact details and your message. Staff
          accounts contain a name, email, role and teaching assignments. School
          records can include learner names, admission numbers, class placement,
          guardian contacts, scores, attendance and report remarks. Submit only
          information your school is authorised to provide.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-lg">Purpose and access</h2>
        <p>
          Information is used to review access requests, operate school
          workspaces and prepare reports. School access rules restrict staff to
          their permitted records. The service operator reviews access and
          support requests and maintains the service. The public homepage
          displays aggregate counts, not learner names or individual results.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-lg">
          Service providers and sessions
        </h2>
        <p>
          Supabase provides authentication and database storage. Vercel hosts
          the website. The connected pilot database is hosted in Ireland;
          hosting, support or delivery infrastructure may process information in
          other locations. Essential sign-in cookies keep staff sessions active.
          Google Fonts supplies the typefaces and receives the technical
          information needed to deliver them. The application does not include
          advertising trackers.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-lg">Retention and requests</h2>
        <p>
          Closing a term preserves report snapshots; it does not delete records.
          During the pilot, records remain until the school and service operator
          arrange deletion. Ask your school administrator about school records.
          For access, correction or deletion requests, use the{" "}
          <Link href="/contact" className="underline">
            contact form
          </Link>
          . Do not include passwords or full learner records in an initial
          support message.
        </p>
      </section>
    </PublicPage>
  );
}
