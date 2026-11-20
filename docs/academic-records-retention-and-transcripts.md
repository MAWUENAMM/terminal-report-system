# EduReport — Long-Term Academic Records and Transcript Operations

## Scope
EduReport identifies a learner by the **same immutable student UUID** throughout class progression. Academic scores, attendance, remarks and archived terminal reports carry school, academic year and term information. Close each term to seal a report snapshot (including class and subject names at that time). Corrected term closures create a **new revision** rather than replacing earlier reports.

This release adds: school-scoped alumni search, `GRADUATED` with a graduation timestamp, in-profile archived-term marks, PDF transcripts produced from the latest *finalized* revision of each term, and school-leadership-only issuance logs. No GPA is invented from Basic School grades. An unarchived/current term does **not** qualify for a school-issued transcript.

## Long-term retention is not the same as backup retention
The database schema does not impose a ten-year expiry on archived reports. That does **not** mean a ten-year recovery guarantee currently exists. Supabase's standard daily backup recovery window is far shorter than a decade (typically seven days on Pro). A school that needs ten-year retrieval must approve a documented retention schedule and an **independently protected backup strategy**.

Operations required *before claiming a ten-year recovery guarantee*:
1. Record each school's legal/operational retention policy, accountable controller and relevant Ghana Data Protection Act basis. Retain academic material for the approved period; minimize guardian contact, payment and photos separately.
2. Set up encrypted, access-controlled offsite exports of the production PostgreSQL academic tables plus their dependencies, schema and migration history (ideally a daily recovery copy and periodic long-lived immutable snapshots). Avoid storing private learner data in source code, public GitHub or unauthenticated web storage.
3. Set a storage lifecycle of **at least the approved minimum** for the archival copy, after consulting the school's legal/compliance advisor. Track storage growth, ongoing costs, change of hosting provider and termination of the SaaS service.
4. Test restoration into a *separate isolated project* at least quarterly: restore a cohort, verify archived term counts, transcript revision selections, historical class names, issuance references and file integrity. Never test restore into production.
5. Keep an encrypted, independently accessible backup/restore runbook and a second authorized custodian. Review access whenever staff leave. Audit downloads, issuance, exceptional erasure and access.
6. Verify monthly that every closed term has an archive for each learner with academic activity, including transferred/withdrawn students. Investigate zero-score or missing-subject cases; do not fabricate missing marks.
7. Log all approved transcript requests. The PDF includes an issuance reference and signature/stamp space but **is not digitally signed**. A school official must authenticate a physical copy if required.
8. Handle lawful access/correction/erasure requests through a dedicated reviewed workflow. Do **not** bypass archive-protection triggers casually; any exceptional modification must be audited and reflected in a new record revision or a documented legal erasure process.

## Secure school workflow
- Term 1, 2, 3: enter marks, attendance and remarks; approve scores; **close and archive the term**.
- Basic 1 → Basic 2 → ...: update the same learner's class assignment; do not delete/recreate the student. Archived class names remain bound to the historic snapshot.
- Graduation: close the final term, then mark `GRADUATED`. The learner stays searchable under the Alumni filter.
- Retrieval years later: Learners → search name/admission number → profile → Report history → View marks / download old report. Admin or headteacher may generate the multi-term transcript.
- If a term is reopened for correction, close it again to create a higher archive revision; the official transcript selects the latest revision. All prior revisions remain in the archive for audit.

## Database controls
- Historical report snapshots are insert-only via the authorized term-closing function. Browser users do not have direct archive update/delete rights. The database trigger rejects accidental archive deletion or overwriting.
- Student deletion is blocked if linked historical academic activity or transcript logs exist.
- School deletion is blocked once archives or transcript issuance logs exist. Deactivate instead.
- Term closure includes learners with academic activity even when marked withdrawn/transferred/graduated.
- Transcript-issuance RPC revalidates school leadership, student ownership and each archived report ID; it rejects duplicates or superseded revisions and writes an immutable issuance reference.
- School-specific RLS restricts archive reads to authorized staff. Transcript generation buttons are shown to school administration/headteachers only.

## Current limitations
- Only **terms that have already been closed and archived** can be included in transcripts. Old activity that was never recorded or archived cannot be manufactured retroactively.
- Offsite backups, ten-year backup retention and restoration drills require an authorized destination, policy and credentials. They are not silently enabled by this code change.
- The print-ready PDF is an academic transcript generated by the school, not an automatic third-party verification credential or cryptographic e-signature.

## Deployment and rollback
- Apply schema changes to staging first and run rollback-only synthetic fixtures.
- Test the full UI and GitHub CI build before applying additive migrations to production.
- Take a verified production backup/snapshot before schema release.
- Verify that student, score, archive counts, school-scoped access and term closure remain correct. Keep the new feature disabled from use if the matching migration is absent.
- Do not downgrade the new student status check if any live `GRADUATED` rows exist.
