# Implementation verification — 27 September 2026

Passed:

- Production compilation and TypeScript checks with Next.js 16.3.6 and React 19.
- Unit checks for fractional grade boundaries, tied ranks, CSV/Excel import validation, duplicate admissions and import limits.
- Transactional checks against Supabase: isolation between two schools, class and subject scope, protected school settings/staff roles, separate teacher/headmaster remarks, calculated scores, invalid attendance, closed-term locking, preserved archives, later-term creation, initial-password restrictions, deactivation and anonymous privacy. All test fixtures rolled back.
- ESLint completed with no errors; advisory warnings remain for deliberate full-page auth transitions and the shared root font stylesheet.
- Real Auth/API checks with four separately provisioned accounts: successful sign-in, rejection of an incorrect password, assigned learner/subject reads, forbidden settings/staff writes, preserved remarks and anonymous privacy.
- Generated and rendered a PDF from the saved demonstration records; checked its scores, subject ranks, attendance and independent remarks.
- Dependency audit after upgrading the framework and PDF packages: zero reported vulnerabilities.
- Supabase security advisor: no database policy/function security warnings. The Auth leaked-password protection advisory remains; that optional paid-plan feature has not been enabled.

Local browser verification was attempted with agent-browser and Playwright. This execution environment denied Unix socket creation; automatic approval also rejected escalation. Therefore an authenticated visual browser walkthrough is still required. The Playwright smoke checks are committed for an environment with browser access. Do not treat build success or SQL checks as proof of visual usability.

The demonstration school uses fictional learners. Initial account passwords are handed over separately; they are not test fixtures or source-controlled data.

## Term recovery and headmaster enrolment follow-up

- Expanded the transactional suite to cover headmaster class/learner create, edit, withdraw, restore and safe deletion; rejected other-school mutations and teacher writes.
- Tested reopening permissions, mandatory reason, class-placement guard, immutable report versions, corrected second closure, blocked older-term reopening, and protected deletion of assessment/archive history. The full suite passed with all fixtures and trial schema changes rolled back.
- Reopening is deliberately limited to the most recent term before a later one is started. No existing closed term is automatically reopened by this migration.

- Follow-up production build and TypeScript passed; ESLint reported no errors and the same five pre-existing navigation/font warnings. Supabase security advisors reported no new database warnings. Authenticated visual browser verification remains unavailable in this execution environment.

## Platform school management follow-up

- Added a paginated platform-only school directory, creation with initial administrator/term, editable contact details, activation/deactivation, reversible deletion and restore, and platform history. Existing approved schools are included automatically.
- `tests/platform-schools.sql` passed against the trial schema. It checks ordinary-admin/teacher/anonymous denials, existing-token suspension, blocked school mutations, preserved staff/learners/archived reports across delete and restore, operator access independent of tenant status, input validation, atomic request approval/provisioning, initial-password enforcement, protected audit records and public statistics. Every test record and trial DDL change was rolled back before applying the final migration.
- The full existing `tests/permissions.sql` suite also passed with the new schema, including term recovery and headmaster enrolment permissions.
- Ten Node tests passed. Five new tests execute the Edge handler with controlled Auth/database adapters to verify identity checks, service-role staff-operation suspension, caller-JWT forwarding for provisioning, platform operations when the owner's tenant is inactive, and Auth identity cleanup on provisioning failure. These are adapter tests, not live Auth round trips.
- Production build and TypeScript passed. ESLint has no errors; seven advisory warnings cover the shared font and full-page transitions used to clear authenticated UI state.
- Authenticated visual browser interaction remains unavailable for the environment limitation described above. No real school was created, suspended, deleted or restored for testing.
- Deployed the finalized Supabase migration and `school-admin` function. Live unauthenticated requests to both the school directory RPC and school creation handler return HTTP 401. Security advisors report no new database findings; the previously documented Auth advisory is unchanged. Both existing schools remain active with their original staff/learner counts and all three archived reports preserved; no platform test identities remain.
