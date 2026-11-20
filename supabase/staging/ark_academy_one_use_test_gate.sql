-- STAGING-ONLY. Do not add to production migrations or execute on production.
-- A single approved diagnostic attempt; it cannot enable school payment SMS.
create table if not exists public.sms_staging_diagnostic_permit (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.sms_staging_diagnostic_permit(singleton, enabled)
values(true, false)
on conflict (singleton) do nothing;
alter table public.sms_staging_diagnostic_permit enable row level security;
revoke all on public.sms_staging_diagnostic_permit from public, anon, authenticated;
comment on table public.sms_staging_diagnostic_permit is
 'Staging-only one-time diagnostic: server-side operator authorization and atomic single-use permit. Not a production SMS activation.';
