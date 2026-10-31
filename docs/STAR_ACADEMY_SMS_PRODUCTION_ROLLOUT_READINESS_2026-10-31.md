# EduReport — Star academy restricted SMS launch readiness

> **Status:** PREPARATION ONLY — no production mutation, no production paid sending authorization.  
> **As of:** 2026-10-31 · **Existing PR:** [Draft PR #5](https://github.com/MAWUENAMM/terminal-report-system/pull/5)

## Verified target and state

| Item | Confirmed value |
|---|---|
| Existing school | **Star academy** |
| Production school UUID | `9af47605-e793-44ea-a5d8-8d5ab039f971` |
| Production Supabase | `fvlceilryjrejylhdtfr` |
| Testing Supabase | `ymoyqresvsxetvnkwsxq` |
| GitHub | `MAWUENAMM/terminal-report-system` |
| Development branch | `feature/edureport-central-sms-2026-10-31` |
| Live Vercel | `terminal-report-system.vercel.app` |

Production Star academy at the verified preflight: active, **one** active School Administrator, **zero** active Accountants, **two** students, **zero** non-voided finance payments. This means any real SMS demonstration using a payment requires a newly recorded **authorized actual payment**, or a separately approved nonfinancial demonstration approach. Do not fabricate production receipts or alter school balances to create a demo.

Production currently has **no** `sms_outbox`, `sms_central_settings`, `sms_request_payment` or deployed `sms-gateway`. It does have the existing Finance RPCs, including `finance_record_payment`, `finance_record_item_payment`, `finance_sell_item_paid`, `finance_notify_payment`, and item payment corrections. The live Finance functions **must remain intact**.

Testing successfully sent and received **one real** EDUREPORT SMS. The one-use staging lock is exhausted. Staging send switch is currently off. Its test API subkey was capped to five sends. Never reuse that limited key as the intended production API key.

## Required code and SQL

The existing draft PR contains the custom-recipient UI, staff opt-in, SMS dashboard, restricted gateway, and these incremental SMS migrations in order (only on explicit deployment approval):

1. `supabase/migrations/20261031120000_central_payment_sms.sql`
2. `supabase/migrations/20261031144947_sms_payment_student_name_and_method.sql`
3. `supabase/migrations/20261031153011_sms_custom_payment_recipient_and_credit_estimate.sql`
4. `supabase/migrations/20261031153447_sms_extra_recipient_reason_not_null.sql`

**Do not replay** unrelated production Finance foundation migrations. Production has a separate migration history, including `item_payments_and_corrections`; compare current production schema and preserved functions before changing anything. Do not reset production or copy staging data over production. Run upgrades in a disposable clone/production-shaped migration rehearsal before approval.

## Strict gates prior to any deployment

- [ ] SMS CI and Finance CI both green, including disposable RLS/recipient isolation/duplicate-send tests
- [ ] Review latest Vercel preview for responsive Finance payment Notify, School Administrator custom-recipient consent controls, staff opt-in, central monitoring
- [ ] Back up existing production schema, Finance data and deployed function metadata; verify recovery
- [ ] Re-run **read-only** production health preflight to confirm school UUID, enabled status, correct existing finance RPC signatures, and that no SMS tables/functions already exist
- [ ] Prepare a dedicated **production** Arkesel SMS API key with limit and balance appropriate for the funded package; store in production Supabase Edge Function secrets only, never GitHub, chat, client code, or public Vercel vars
- [ ] Sender EDUREPORT must be confirmed usable via Arkesel's intended approved channels; successful staging handset test is evidence on that network, not proof across all networks
- [ ] Verify the school's Administrator personally opts in to receive payment SMS with a valid normalized Ghana number; no default opt-ins
- [ ] Confirm custom-recipient handling: School Administrator only, explicit consent/authorization reason, one extra phone per payment, school RLS and duplicate prevention
- [ ] Choose conservative initial provider-credit and per-day usage budget (proposed **maximum 6 SMS requests/day globally and for Star academy only**); each opted-in Admin/Accountant/custom handset may consume an individual credit
- [ ] Obtain separate explicit written **production deployment** approval; approval for the staging one-SMS test does not cover production

## Preflight queries (READ-ONLY; do not modify data)

```sql
select id,name,active,deleted_at from public.schools
 where id='9af47605-e793-44ea-a5d8-8d5ab039f971'::uuid;
select role,count(*) from public.school_users
 where school_id='9af47605-e793-44ea-a5d8-8d5ab039f971'::uuid and active
 group by role order by role;
select count(*) from public.finance_payments
 where school_id='9af47605-e793-44ea-a5d8-8d5ab039f971'::uuid
 and voided_at is null;
select to_regclass('public.sms_outbox') as sms_outbox,
 to_regclass('public.sms_central_settings') as sms_settings;
```

## Authorized **inactive** release sequence (AFTER production deployment approval only)

1. Take and verify a restorable production backup, map live Vercel environment to the production Supabase project, and record the current production Git SHA and deployment ID.
2. Rehearse the exact SMS-only migration chain against an isolated production-shaped test environment. Do not alter existing Finance tables beyond the approved SMS opt-in columns.
3. Apply the SMS migrations to the correct production project only. Assert `sms_central_settings.sending_enabled=false`, `sms_outbox` empty, opt-in defaults `false`, and private functions have narrow grants.
4. Deploy the reviewed `sms-gateway` to production with `ARKESEL_SMS_LIVE_ENABLED=false`, `EDUREPORT_SMS_LIVE_APPROVED=false`, and `EDUREPORT_SMS_OPERATION_MODE=ONE_USE_PILOT` (default fail-closed). Record version/hash. Do not use the staging pilot phone allowlist or its API key.
5. With a separately approved GitHub merge and Vercel release, expose the Finance/Admin SMS UI, but leave all live sending disabled. Verify existing Finance / school / auth / report pages and receipts still work.
6. Let Star academy's School Administrator configure their own opt-in and review privacy notices. Test the **preview-only** notification path on an authorized payment (if one exists).
7. Recheck school access, multi-tenant isolation, original Finance functionality, dashboard reporting, credits and no outgoing requests. Stop if any discrepancy occurs.

## Production SMS activation — SEPARATE EXPLICIT AUTHORIZATION REQUIRED

Do not silently activate after the inactive release. Before allowing paid delivery, obtain specific approval naming Star academy, the permitted recipients, initial credit caps and at least one real paid test message.

Only after that approval and readiness checks should the following production gates ever be considered:

- `EDUREPORT_SMS_OPERATION_MODE=RESTRICTED_LIVE`
- `EDUREPORT_SMS_LIVE_APPROVED=true`
- `EDUREPORT_SMS_APPROVED_SCHOOL_IDS=9af47605-e793-44ea-a5d8-8d5ab039f971` (no other school)
- `ARKESEL_SMS_LIVE_ENABLED=true`
- `ARKESEL_API_KEY` = dedicated secured **production** key
- `sms_central_settings.sending_enabled=true` and approved daily limits
- Confirm Star academy's own opted-in staff and any independently authorized custom recipient; do not send to others

**Multiple failsafes must remain in force.** Before making these gates live, require acceptance that Arkesel submitted ≠ delivered and that provider credits may lag in response. Implement authenticated delivery receipts/callbacks and provider reconciliation as follow-up release criteria.

## Emergency stop and rollback

If any unexpected SMS, wrong recipient/school, credit depletion, duplicate, provider errors, or security issue: **first** set production `sms_central_settings.sending_enabled=false` and `ARKESEL_SMS_LIVE_ENABLED=false`. Verify no new outgoing rows. Do not retry UNKNOWN SMS automatically. Disable rollout flags and roll back only the reviewed application/Edge Function release. Do not drop audit/outbox or Finance tables; take backup snapshots and reconcile credits before subsequent changes.

## Unresolved items as of this checkpoint

- Latest durable SMS CI outcome / production-shaped database rehearsal
- Separate production Arkesel API key and bundle purchase, not yet verified
- EDUREPORT Sender ID final cross-carrier approval
- Delivery status callback and precise credit reconciliation
- Consent/recipient confirmation with Star academy's School Administrator
- **Explicit production deployment authorization**, followed separately by **explicit paid production sending authorization**
