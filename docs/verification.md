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
