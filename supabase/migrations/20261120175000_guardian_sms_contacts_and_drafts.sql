-- Guardian communications foundation. No existing payment SMS tables or production flags are modified.
-- The staging deployment remains send-disabled; this migration never calls Arkesel.
create table if not exists public.guardian_sms_contacts (
  student_id uuid primary key references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  guardian_name text not null check(char_length(btrim(guardian_name)) between 2 and 120),
  phone_e164 text not null check(phone_e164 ~ '^\+233[25][0-9]{8}$'),
  consent_status text not null default 'PENDING'
    check(consent_status in ('PENDING','OPTED_IN','OPTED_OUT')),
  consent_source text,
  consent_recorded_at timestamptz,
  consent_recorded_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (consent_status <> 'OPTED_IN' or
    (nullif(btrim(consent_source),'') is not null and
     consent_recorded_at is not null and consent_recorded_by is not null))
);
create index if not exists guardian_sms_contacts_school_phone
  on public.guardian_sms_contacts (school_id,phone_e164);

create or replace function private.guardian_sms_guard_contact()
returns trigger language plpgsql set search_path = '' as $$
declare actual_school uuid;
begin
  select school_id into actual_school from public.students where id=new.student_id;
  if actual_school is null or new.school_id<>actual_school then
    raise exception 'Guardian contact must belong to the learner school';
  end if;
  if tg_op='UPDATE' and new.phone_e164 is distinct from old.phone_e164 then
    new.consent_status:='PENDING';
    new.consent_source:=null;
    new.consent_recorded_at:=null;
    new.consent_recorded_by:=null;
  end if;
  new.updated_at:=now();
  return new;
end $$;
drop trigger if exists guardian_sms_contact_integrity on public.guardian_sms_contacts;
create trigger guardian_sms_contact_integrity
before insert or update on public.guardian_sms_contacts for each row
execute function private.guardian_sms_guard_contact();

create table if not exists public.guardian_sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  request_key uuid not null unique,
  created_by uuid not null references auth.users(id),
  sender_id text not null check(sender_id in ('EDUREPORT','Ark Academy')),
  message_body text not null check(char_length(btrim(message_body)) between 1 and 320),
  segment_estimate integer not null check(segment_estimate between 1 and 6),
  recipient_count integer not null default 0 check(recipient_count between 0 and 500),
  status text not null default 'DRAFT'
    check(status in ('DRAFT','QUEUED','PROCESSING','COMPLETE','PARTIAL','CANCELLED')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guardian_sms_campaign_school_created
  on public.guardian_sms_campaigns (school_id,created_at desc);

create table if not exists public.guardian_sms_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.guardian_sms_campaigns(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  phone_e164 text not null check(phone_e164 ~ '^\+233[25][0-9]{8}$'),
  student_ids uuid[] not null,
  status text not null default 'DRAFT'
    check(status in ('DRAFT','QUEUED','PROCESSING','SUBMITTED','DELIVERED','FAILED','UNKNOWN')),
  provider_message_id text,
  credits_used integer not null default 0 check(credits_used between 0 and 100),
  credits_verified boolean not null default false,
  last_error text,
  send_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,phone_e164),
  check(cardinality(student_ids) between 1 and 500)
);
create index if not exists guardian_sms_recipients_school_status
  on public.guardian_sms_recipients (school_id,status,created_at);

-- Closed tables. All requests go through the authenticated, school-scoped Edge Function.
alter table public.guardian_sms_contacts enable row level security;
alter table public.guardian_sms_campaigns enable row level security;
alter table public.guardian_sms_recipients enable row level security;
revoke all on public.guardian_sms_contacts from public, anon, authenticated;
revoke all on public.guardian_sms_campaigns from public, anon, authenticated;
revoke all on public.guardian_sms_recipients from public, anon, authenticated;
grant select,insert,update,delete on public.guardian_sms_contacts to service_role;
grant select,insert,update,delete on public.guardian_sms_campaigns to service_role;
grant select,insert,update,delete on public.guardian_sms_recipients to service_role;

-- Transactional draft creation verifies all selected learners, consent and sender
-- again on the database side; the browser cannot supply arbitrary phone numbers.
create or replace function public.guardian_sms_prepare_draft(
  p_school_id uuid, p_request_key uuid, p_actor uuid,
  p_sender_id text, p_message text, p_segment_estimate integer,
  p_student_ids uuid[]
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  target_school record;
  campaign_id uuid;
  eligible_count integer;
  count_selected integer;
  current_sender text;
  is_platform boolean;
begin
  if p_school_id is null or p_request_key is null or p_actor is null
     or p_student_ids is null or cardinality(p_student_ids) not between 1 and 500
     or char_length(btrim(coalesce(p_message,''))) not between 1 and 320
     or p_segment_estimate not between 1 and 6 then
    raise exception 'Invalid guardian SMS draft request';
  end if;
  select id,name into target_school from public.schools
  where id=p_school_id and active and deleted_at is null;
  if not found then raise exception 'Target school is inactive'; end if;
  select exists(select 1 from public.platform_operators o
       join public.school_users u on u.auth_user_id=o.auth_user_id
       where o.auth_user_id=p_actor and u.active and not u.must_change_password)
    into is_platform;
  if not is_platform and not exists(
      select 1 from public.school_users u
      where u.auth_user_id=p_actor and u.school_id=p_school_id
        and u.active and not u.must_change_password and u.role='ADMIN'
  ) then raise exception 'Not authorized to compose for this school' using errcode='42501'; end if;
  current_sender:=private.sms_sender_for_school(p_school_id);
  if not (p_sender_id=current_sender or
    (is_platform and p_sender_id='EDUREPORT')) then
    raise exception 'Sender ID is not available for this school' using errcode='42501';
  end if;
  if p_sender_id='Ark Academy' and target_school.name <> 'THE ARK ACADEMY' then
    raise exception 'Ark Academy Sender ID belongs only to THE ARK ACADEMY';
  end if;
  select count(distinct id) into count_selected from public.students
    where id=any(p_student_ids) and school_id=p_school_id and status='ACTIVE';
  if count_selected <> (select count(distinct x) from unnest(p_student_ids) as x) then
    raise exception 'One or more selected learners are not active in this school';
  end if;
  select count(*) into eligible_count
  from (select distinct c.phone_e164 from public.guardian_sms_contacts c
    join public.students s on s.id=c.student_id and s.school_id=c.school_id
    where c.school_id=p_school_id and s.status='ACTIVE'
      and c.student_id=any(p_student_ids) and c.consent_status='OPTED_IN'
      and c.consent_recorded_at is not null
  ) recipients;
  if eligible_count=0 then raise exception 'No opted-in guardians available'; end if;
  -- Idempotent: retrying an already created draft never creates a second batch.
  insert into public.guardian_sms_campaigns
    (school_id,request_key,created_by,sender_id,message_body,segment_estimate,recipient_count)
  values (p_school_id,p_request_key,p_actor,p_sender_id,btrim(p_message),
          p_segment_estimate,eligible_count)
  on conflict(request_key) do nothing returning id into campaign_id;
  if campaign_id is null then
    select c.id into campaign_id from public.guardian_sms_campaigns c
    where c.request_key=p_request_key and c.school_id=p_school_id
      and c.created_by=p_actor;
    if campaign_id is null then raise exception 'Request ID already used'; end if;
    return jsonb_build_object('id',campaign_id,'duplicate',true);
  end if;
  insert into public.guardian_sms_recipients
    (campaign_id,school_id,phone_e164,student_ids)
  select campaign_id,p_school_id,c.phone_e164,
    array_agg(distinct c.student_id order by c.student_id)
  from public.guardian_sms_contacts c
  join public.students s on s.id=c.student_id and s.school_id=c.school_id
  where c.school_id=p_school_id and s.status='ACTIVE'
    and c.student_id=any(p_student_ids) and c.consent_status='OPTED_IN'
    and c.consent_recorded_at is not null
  group by c.phone_e164;
  return jsonb_build_object('id',campaign_id,'duplicate',false,
    'recipient_count',eligible_count,'sender_id',p_sender_id);
end $$;
revoke all on function public.guardian_sms_prepare_draft(uuid,uuid,uuid,text,text,integer,uuid[])
  from public,anon,authenticated;
grant execute on function public.guardian_sms_prepare_draft(uuid,uuid,uuid,text,text,integer,uuid[])
  to service_role;

create or replace function public.guardian_sms_claim_batch(p_campaign_id uuid,p_max integer)
returns setof public.guardian_sms_recipients
language plpgsql security definer set search_path='' as $$
begin
  if p_max not between 1 and 10 then raise exception 'Invalid batch size'; end if;
  return query
  with picked as (
    select r.id from public.guardian_sms_recipients r
    where r.campaign_id=p_campaign_id and r.status='QUEUED'
    order by r.created_at,r.id
    limit p_max for update skip locked
  ) update public.guardian_sms_recipients r
    set status='PROCESSING',send_started_at=now(),updated_at=now()
    from picked where r.id=picked.id
    returning r.*;
end $$;
revoke all on function public.guardian_sms_claim_batch(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.guardian_sms_claim_batch(uuid,integer)
  to service_role;

comment on table public.guardian_sms_contacts is
 'Guardian contacts are explicitly school-scoped. An imported phone never implies SMS consent.';
comment on table public.guardian_sms_campaigns is
 'Parent/guardian SMS drafts and history; sending is gated separately in an Edge Function.';
