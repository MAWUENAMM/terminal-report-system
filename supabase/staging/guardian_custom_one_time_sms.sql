-- Staging-only one-use real custom SMS diagnostic.
-- Separate from guardian campaigns, finance payment SMS, and the already consumed
-- Ark Academy staging sender test. Does not grant permission to broadcast.
create table if not exists public.guardian_custom_test_permit (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id),
  request_key uuid unique,
  updated_at timestamptz not null default now()
);
insert into public.guardian_custom_test_permit (singleton,enabled)
values (true,false) on conflict(singleton) do nothing;
alter table public.guardian_custom_test_permit enable row level security;
revoke all on public.guardian_custom_test_permit from public,anon,authenticated;
comment on table public.guardian_custom_test_permit is
  'Staging-only, one paid custom SMS to the existing opted-in pilot number. No parental data or general SMS activation.';
