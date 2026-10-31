# School Finance rollout & recovery

**Status: ISOLATED DRAFT; DO NOT MERGE OR APPLY TO LIVE SUPABASE YET.**

## Production baseline
- GitHub restore point: `restore/pre-finance-module-2026-10-27`
- Existing main HEAD when started: `f43e4266177f9fcde6e7ab4266864e3b0a6c900c`
- Finance development branch: `feature/accountant-finance-foundation`
- Supabase production project: `fvlceilryjrejylhdtfr` (King Joe's Mawuenam organization)
- Vercel production: `terminal-report-system.vercel.app`

## Non-negotiable release checks
1. Confirm a disposable local Supabase database can apply ALL versioned migrations, especially `20261027190000_accountant_finance_foundation.sql`.
2. Run `tests/finance-permissions.sql` against only that disposable database; all fixtures must roll back, no test user or school can remain.
3. Confirm Accountant can read only their school's students and finance ledger; academic grading/attendance editing remains denied.
4. Verify Admin can provision Accountant in an isolated Auth environment and Accountant reaches their dedicated finance portal.
5. Verify fee Apply is idempotent, assign-to-class vs all, no duplicate or unintended prior-term charges.
6. Verify two concurrent partial payments cannot over-allocate, offline retries use their request IDs, and overpayments fail without leftover payment records.
7. Verify a reversed payment keeps its receipt/evidence, restores the balance, and notifies Admin/Accountant.
8. Verify inventory sales atomically update stock and create a charge once. Prevent negative stock, check mixed-school IDs.
9. Verify privately stored item photo access and item deletion restrictions.
10. Verify receipt visual layout on A4 with real-looking test school logo/student photo, enough subjects/charges for long breakdown, amount in words, a unique receipt number, and VOID marking.
11. Verify old EduReport academic workflows and report PDFs remain unaffected, including mobile views and dark mode.
12. Inspect Supabase security/performance advisors and Vercel runtime logs on a non-production environment.
13. Preserve and compare approved production migration list before applying any schema change.
14. Only then plan coordinated database, Edge Function, and frontend release. Production fees must not be created during smoke tests.

## Rollback caution
Reverting GitHub commits restores UI/server code. A database migration is NOT automatically undone by reverting source. Financial records must never be dropped to “roll back.” If a released feature fails, disable finance writes or roll back the frontend while retaining ledger data, then issue a forward-only correction migration.

## Accounting decisions
- Ghana cedis; values in numeric(12,2) and converted to integer pesewas in browser summaries.
- Charges are assigned to an academic year and term; past arrears carry forward as a visible outstanding balance.
- Payment allocation applies oldest debt first. Unapplied overpayments are rejected, not silently stored as untracked credit.
- Payments and receipts are append-only; corrections happen through reversible voids with reasons.
- Finished item sales cannot be erased by deleting an inventory item.
- Finance activity is shared through the existing bell with per-recipient read tracking.
- Student photos and school logo use the existing private school-assets storage.
- Finance item images use the new private finance-items bucket, isolated by school.
- Forgot Password is a separate unresolved issue and must not be changed in this rollout.
