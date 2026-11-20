# EduReport — THE ARK ACADEMY branded SMS sender rollout (20 Nov 2026)

## Intent
- Default for every school remains `EDUREPORT`.
- THE ARK ACADEMY may use `Ark Academy` (11 characters, including the space).
- Platform Administrators may explicitly choose either Sender ID for an existing *diagnostic test* message, without student/payment data.
- SMS billing stays central with the existing Arkesel API key, budget limits, consent and audit.
- UI/Edge Function/frontend/migration are developed on `feature/ark-academy-sender-routing-2026-11-20`, not `main`.

## Current evidence and limits
- An authorized user reported receiving two SMS messages under Ark Academy from Arkesel's website on 20 Nov 2026.
- Carrier-wide whitelisting and API behavior are **not yet confirmed**. The screenshot is not proof of delivery across carriers or from EduReport's API.
- Production has active school `THE ARK ACADEMY`; stage has a separate testing school.
- **Do not run an EduReport paid test until separately authorized.**
- **Do not merge to main, deploy frontend/Edge Function, apply production migration, or enable a production school sender override without separate authorization.**

## Configuration
The migration adds:
`public.sms_school_sender_ids(school_id, sender_id, enabled_for_school_sms)`, with RLS enabled and no client privileges/policies.
When THE ARK ACADEMY exists and is active, a row for `Ark Academy` is inserted with `enabled_for_school_sms = false`.

- PENDING: `enabled_for_school_sms = false`; all payment SMS continue using EDUREPORT.
- ENABLED: only the matching active school's queued *new* payment SMS use Ark Academy; other schools stay EDUREPORT.
- The Platform Admin can choose Ark Academy for an explicit diagnostic test even while pending. The API endpoint checks operator authorization and validates that the school owns the configured Sender ID.
- The test audit table now accepts exactly `EDUREPORT` or `Ark Academy` and records the selected sender.
- Existing finance notifications and extra consented recipients route via the same school-resolved sender, retaining duplicate protection.
- Existing outbox rows and historic sender IDs are not rewritten.

## Safe acceptance checks
1. Run GitHub SMS workflow on the development branch (disposable database, never production).
2. Check all existing finance/SMS tests plus `tests/sms-sender-routing.sql`: default EDUREPORT, pending fails closed, explicit enable affects only one school, branded body within 160 chars, authenticated users denied direct config mutation.
3. Check frontend lint/unit tests and browser review of test sender dropdown; run Next.js build check.
4. Check no client can submit arbitrary Sender IDs, change school ownership, or set `enabled_for_school_sms`.
5. Verify staging frontend + Edge Function + DB compatibility without paid SMS; ensure any staging migration is separately approved for the existing test environment.
6. Obtain an explicit authorization for *one paid API test* to an opted-in recipient; test Ark Academy and inspect Arkesel acceptance, handset delivery and credit deduction. Never blindly retry UNKNOWN.
7. Separately authorize the coordinated production release after backup/rollback verification. Deployment must leave new override false.
8. After satisfactory cross-carrier and API verification and explicit operator approval, switch THE ARK ACADEMY's own row to true. Verify new school SMS has Ark Academy sender, unrelated school still EDUREPORT, and billing/audits remain intact.

## Rollback
- Immediate school-level fallback: set only THE ARK ACADEMY row `enabled_for_school_sms = false` **under explicit production approval**. New payment queues then resolve EDUREPORT.
- Existing submitted/UNKNOWN outbox rows must not be erased or requeued to switch sender identity.
- If a code rollback is required, use the pre-release Vercel deployment and previous Edge Function artifact after evaluating migration compatibility. Database recovery requires a real verified backup; GitHub/Vercel rollback is not a DB restore.

## Scope boundaries
This work improves school-specific payment SMS and the existing Platform Administrator *diagnostic test* sender choice. It does not create a new bulk/general-purpose marketing composer or change unrelated school roles.
