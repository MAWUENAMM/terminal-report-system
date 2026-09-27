# EduReport — school workspaces

A working pilot for Ghanaian basic schools, built with Next.js 16, React 19, Supabase Auth/Postgres and PDF reports. The green and gold presentation design is retained. School records are shared through Supabase; the former browser-only store and public demo credentials have been removed.

## Accounts and responsibilities

| Account         | Access                                                                                                     | Who grants it                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Administrator   | School settings, staff accounts, learner register/imports, classes, subjects, assignments, marks and terms | Platform owner creates the first school administrator; an administrator can add colleagues |
| Headmaster      | Learner register/imports, classes, school-wide reports, headmaster remarks and term management             | School administrator                                                                       |
| Class teacher   | Marks, attendance, class remarks and reports for assigned classes                                          | School administrator assigns the class                                                     |
| Subject teacher | Marks for assigned class/subject combinations                                                              | School administrator assigns the subject and class                                         |

One staff account can also hold teaching assignments beyond its primary role. The platform owner has a separate, database-controlled permission for reviewing new school requests; being a school administrator alone does not grant it. Staff cannot grant themselves roles through their profile or Auth metadata.

The provisioned school is explicitly named **Unity Basic School — Demonstration**, with fictional `DEMO` learners. Initial passwords are supplied privately, never in this repository or on the login page. All initial/reset passwords require replacement before school data is available. Staff management generates a password for private handover; it does **not** send invitations or password emails. Use actual staff email addresses when onboarding a real school.

## Main workflows

1. A representative submits **Request school access**. The platform owner reviews the representative, approves the request and privately gives the first administrator their account details.
2. The administrator creates staff and subjects and assigns subject teachers. Administrators and headmasters can create/edit classes, assign class teachers, and manage learner registration and imports. Subjects can be restricted to KG, Primary, JHS or all levels.
3. Register learners or import CSV/Excel `.xlsx`. Download the template from Students. Create the referenced classes first. Admission numbers must be unique within a school; format numeric identifiers as text in Excel to preserve leading zeros. Preview errors must be resolved before saving. Each import is one atomic database operation, limited to 1,000 learners and 2 MB.
4. Teachers save raw SBA and examination marks out of 100. The database calculates weighted totals and grades; clients cannot forge them. The default scale is A ≥ 80, B ≥ 70, C ≥ 60, D ≥ 50, E ≥ 40, F below 40. This is a pilot school scale, not a claim of official approval. Weights become locked after marks are entered for the term.
5. Class teachers enter attendance and their remarks. Headmasters add their own remarks without overwriting the teacher's. Download PDFs from Reports & attendance.
6. Leadership checks completeness, then types `CLOSE` to close a term. Records become read-only and report snapshots preserve school details, learner placement and results. Start a later term to get empty mark sheets while keeping learners and assignments. If closure was accidental, administrators and headmasters can reopen the most recent closed term before a later term has started, giving a reason and typing `REOPEN`. Learner class placement must still match the closed term. Reclosing creates a new numbered report version; every earlier snapshot remains available in Report archive. Term activity records the actor and reopening reason. Archived snapshots are loaded individually when downloaded.

Administrators and headmasters can delete unused classes and learners. Database guards prevent deleting any learner with marks, attendance, remarks, behaviour records or archived reports, and prevent deleting classes with learners, subject assignments, marks or report history. Use **Withdraw** to retain a learner’s history and **Restore** to return them to the active list. School settings, subject administration and staff account/role management remain administrator-only.

Public totals come from a dedicated aggregate table. Public visitors cannot read learners, staff or requests. The landing page and open workspaces refresh on focus and every 30 seconds; a save refreshes the current workspace immediately. Totals include the explicitly labelled demonstration school.

## Local development

Use Node 22 or newer:

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

The checked-in `src/lib/supabase/project.json` contains only this pilot's **publishable** key and project URL. Public keys are intended for browser use; database policies enforce access. For a separate deployment, set both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as shown in `.env.example`. Never place a service-role/secret key in a `NEXT_PUBLIC_` variable.

## Database and privileged account operations

`supabase/migrations/` contains the original schema and all applied migrations in their server order. Apply them with the Supabase CLI to a separate project, or inspect them in the SQL editor. Do not reapply migrations already recorded in the existing pilot project.

`supabase/functions/school-admin/index.ts` handles account creation, password setup/reset and approved school provisioning. It uses Supabase's built-in server-only service credentials. Deploy it as `school-admin` with gateway JWT verification disabled: the function explicitly validates bearer tokens with Auth `getUser`, checks the live staff profile, and restricts each action. The initial bootstrap action instead requires a hashed, expiring, one-use setup token and refuses to run once a platform operator exists.

For a fresh project's first owner, create a cryptographically random setup token **outside source control**, store its SHA-256 hash, the intended owner email and a short expiry in `private.setup_tokens`, then call `school-admin` with `action: bootstrap`, the owner's name, school name and `x-setup-token`. Save the returned initial password privately and delete the raw setup token. The existing project is already bootstrapped.

Authenticated data operations use the user's Supabase session and Row Level Security. Policies enforce school, class and subject boundaries independently of navigation. Database triggers validate score ranges, attendance, subject levels, same-school relationships, term locks and separate remark ownership. Deactivating a staff profile removes its data permissions. School records cannot be accessed until initial password setup is complete. Report archives are immutable to application users.

## Verification and deployment

- `tests/core.test.ts`: grade boundaries, ranking ties, import identifiers, duplicates and invalid files.
- `tests/permissions.sql`: transaction-scoped role, school isolation, forbidden mutations, attendance validation, password setup/deactivation and term/archive tests. Run with a database administrator; it rolls back every fixture. Do not remove the final rollback.
- `tests/public.spec.ts`: desktop/mobile public navigation and protected route smoke checks using Playwright. `npm run test:browser` requires a running production build's browser dependencies; the config starts the app automatically.
- `docs/verification.md`: checks performed for this implementation and remaining visual verification limits.

The GitHub-connected Vercel project builds with `npm run build`. Feature branches produce a review deployment; merging the reviewed branch to `main` updates production. Supabase migrations and the account function are deployed separately. No paid plan or email provider was enabled by this change.

## Pilot boundaries

Review grading rules, report wording and Privacy/Terms with each participating school before issuing official reports. The school should approve access and the use of learner data. PDF averages use entered subjects, so verify completeness before closing a term. This pilot does not yet provide automatic learner promotion, institution-specific grading scales, an audit-event UI, or a self-service email recovery flow. Keep appropriate independent exports/backups and choose an email provider before enabling invitation/recovery email. Free hosting/database quotas and availability still apply.
