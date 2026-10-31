-- Platform Administrator repeatable Arkesel SMS test history.
-- Real finance notification idempotency is unaffected.
create table public.sms_test_outbox (
 id uuid primary key default gen_random_uuid(),
 request_key uuid not null unique,
 requested_by uuid not null references auth.users(id),
 phone_e164 text not null check (phone_e164 ~ '^\\+233[25][0-9]{8}$'),
 sender_id text not null default 'EDUREPORT' check (sender_id='EDUREPORT'),
 message text not null check (char_length(message) between 1 and 160),
 status text not null default 'QUEUED'
   check (status in ('QUEUED','PROCESSING','SUBMITTED','FAILED','UNKNOWN','DELIVERED')),
 provider_message_id text,
 credits_used integer not null default 0 check (credits_used>=0),
 credits_verified boolean not null default false,
 last_error text,
 created_at timestamptz not null default now(),
 send_started_at timestamptz,
 updated_at timestamptz not null default now()
);
create index sms_test_outbox_recent on public.sms_test_outbox(created_at desc);
alter table public.sms_test_outbox enable row level security;
revoke all on public.sms_test_outbox from public,anon,authenticated;
comment on table public.sms_test_outbox is
 'Private audit of explicit Platform Administrator diagnostic Arkesel SMS sends; NEVER student payment transactions.';
