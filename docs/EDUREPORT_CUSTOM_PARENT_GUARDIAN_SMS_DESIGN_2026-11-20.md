# EduReport — Custom Parent/Guardian SMS (Added Requirement)
Date: 2026-11-20
Repository: MAWUENAMM/terminal-report-system
Development: feature/ark-academy-sender-routing-2026-11-20
Status: DESIGN / SCOPE AGREED IN CHAT; NOT IMPLEMENTED; NOT DEPLOYED

## User request
In addition to the four items planned for the Ark Academy Sender ID production release,
add a section where an authorized administrator can compose a custom message and
send it to one or multiple parents/guardians of enrolled learners.

## Current evidence and dependencies
- Screenshot from Arkesel (20 Nov 2026): Ark Academy and EDUREPORT show **Status = Approved**,
  while their **AT whitelisted** field shows **In Progress**. This does not certify all-carrier whitelisting.
- Existing code and schema use `public.students.guardian_name` and `guardian_phone`;
  there is currently no dedicated parent phone book or guardian consent flag.
- Read-only audit on the live THE ARK ACADEMY school (20 Nov 2026):
  208 learners; 204 active; **0** active learners with a guardian phone recorded in
  `students.guardian_phone`. This is a dated snapshot; recheck before launch.
- Existing SMS finance outbox is payment-specific and recipient-staff-specific:
  do not reuse its payment/recipient invariants for guardian messages.
- Existing diagnostic outbox is for operator tests only.
- Existing staging SMS test was delivered with Ark Academy; the single-use test permit is consumed.

## Proposed feature — Custom Parent/Guardian SMS
Placement: Central SMS Management for Platform Administrators, plus a
school-scoped "Parent/Guardian Messages" screen for school ADMIN accounts.
HEADMASTER/other roles require a separate permission decision; never grant
subject/class teachers broad contacts by default.

### Recipient selection
- Select school (operator) or use only own school (school ADMIN).
- Select exactly one learner's guardian, multiple selected learners' guardians,
  one or more classes, or all opted-in guardians in the school.
- Resolve recipients server-side exclusively from active students and recorded
  guardian contacts in the requested school. Do not trust client-provided phone lists.
- Normalize Ghana numbers to E.164 +233; validate contact ownership.
- Deduplicate same normalized guardian number across siblings. Record linked
  student IDs in the audit without exposing extra student data to other schools.
- Show counts: selected learners; eligible guardians; duplicate guardians;
  missing/invalid numbers; non-consented contacts.
- Zero eligible recipients => no sending.

### Consent/contact readiness
- Add a school-scoped guardian consent/communication preferences model with
  confirmed opt-in and timestamp, who recorded it, and opt-out/revocation.
- A guardian phone number by itself is NOT proof of permission to send messages.
- Reset/require reconfirmation on phone-number change.
- Support controlled guardian-contact CSV import/review matched to existing
  learner admission numbers and school IDs; preview and audit changes.
- Never silently populate or fabricate guardian numbers.
- Give school ADMIN a simple record/verify workflow; no bulk default opt-in.

### Composer
- Text message body, optional named saved templates (school announcement,
  meeting reminder, event, fees reminder, emergency closure).
- Render character and estimated segment count; explain GSM 7-bit vs Unicode
  and provider price estimates, not guaranteed charges.
- Provide read-only preview with Sender ID, selected recipients count, exclusions,
  expected credit range and a clear Confirm Send action.
- Per-message confirmation should remain simple; consent is stored in verified
  parent records rather than demanding an essay at send-time.
- Store draft history, final text, edit/send audit and per-recipient status.

### Sender IDs
- THE ARK ACADEMY: use `Ark Academy` only after the school-specific override
  is deliberately enabled and any required network readiness checks completed.
- Other schools: default to `EDUREPORT`.
- Platform Administrator may choose EDUREPORT or Ark Academy **for Ark Academy
  recipients only**; cannot use the school brand to represent other schools.
- School admins cannot arbitrarily select a different school's Sender ID.
- Do not alter the global central Sender ID or rewrite historic messages.

### Secure dispatch
- New parent-message campaigns and recipient outbox; do not change the existing
  payment SMS outbox invariants.
- A separate, admin-authorized action queues messages only after eligibility and
  consent checks, an atomic idempotency key and per-school/global rate/budget limits.
- Atomic claim before provider call; record Arkesel message IDs, submitted/failed/
  unknown, estimated vs verified credit usage; no automatic retry on UNKNOWN.
- No free-form browser POST to Arkesel; access only via authenticated Supabase Edge
  Function with server-side session and school/operator authorization.
- RLS tenant isolation, denied cross-school recipient reads/writes, minimum logging
  of phone PII, budget preview, opt-out and audit/retention policy.
- For bulk sends: batch/queue and throttle with separate explicit activation,
  not an unbounded synchronous browser action; prevent double charging on refresh.

## Acceptance criteria
1. School ADMIN can preview/select only their own school's opted-in guardians.
2. Platform Admin can select school and (subject to brand restriction) sender.
3. Contact imports are validated and never implicitly set consent to true.
4. Missing/non-consented numbers are excluded; siblings sharing a phone receive
   only one copy of the same campaign message.
5. Text cannot be sent to another school's guardian by altering client payload.
6. Preview and audit reflect true eligible count; sender/budget/credits are captured.
7. Existing finance SMS flow stays unchanged, and staging defaults to send disabled.
8. Tests: school isolation, consent changes, phone normalization, dedupe,
   duplicate-request protection, blocked unauthorized roles, provider timeouts,
   and budget enforcement.
9. Run a single opt-in staging pilot only after explicit consent/test approval.
10. Production migration/deploy/activation requires distinct authorization.

## Rollout status
Requirements are recorded on the development branch for implementation and review.
**No production code, database, or Arkesel sender settings are modified by this document.**
