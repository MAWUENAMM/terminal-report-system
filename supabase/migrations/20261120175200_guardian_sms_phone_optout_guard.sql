-- Revocation applies across all siblings sharing a guardian phone in one school.
-- Replaces only guardian-specific functions; finance SMS is untouched.
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
      and not exists (
        select 1 from public.guardian_sms_contacts blocked
        where blocked.school_id=c.school_id and blocked.phone_e164=c.phone_e164
          and blocked.consent_status='OPTED_OUT'
      )
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
      and not exists (
        select 1 from public.guardian_sms_contacts blocked
        where blocked.school_id=c.school_id and blocked.phone_e164=c.phone_e164
          and blocked.consent_status='OPTED_OUT'
      )
  group by c.phone_e164;
  return jsonb_build_object('id',campaign_id,'duplicate',false,
    'recipient_count',eligible_count,'sender_id',p_sender_id);
end $$;

create or replace function public.guardian_sms_authorize_campaign(
  p_campaign_id uuid, p_actor uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.guardian_sms_campaigns%rowtype;
  cfg public.sms_central_settings%rowtype;
  operator_ok boolean;
  already_used integer;
  school_used integer;
  active_guardians integer;
begin
  if p_campaign_id is null or p_actor is null then raise exception 'Missing campaign or actor'; end if;
  select * into c from public.guardian_sms_campaigns where id=p_campaign_id for update;
  if not found then raise exception 'Campaign does not exist'; end if;
  select exists(
    select 1 from public.platform_operators p
    join public.school_users u on u.auth_user_id=p.auth_user_id
    where p.auth_user_id=p_actor and u.active and not u.must_change_password
  ) into operator_ok;
  if not operator_ok and not exists(
    select 1 from public.school_users u join public.schools s on s.id=u.school_id
    where u.auth_user_id=p_actor and u.school_id=c.school_id and u.role='ADMIN'
      and u.active and not u.must_change_password and s.active and s.deleted_at is null
  ) then raise exception 'Not permitted to send for this school' using errcode='42501'; end if;
  if c.created_by <> p_actor and not operator_ok then
    raise exception 'Only the draft creator can authorize this campaign' using errcode='42501';
  end if;
  if c.status <> 'DRAFT' then
    return jsonb_build_object('id',c.id,'duplicate',true,'status',c.status);
  end if;
  select * into cfg from public.sms_central_settings where singleton=true;
  if not found or cfg.sending_enabled=false then
    raise exception 'Guardian SMS sending remains disabled';
  end if;
  if not exists(select 1 from public.schools where id=c.school_id and active and deleted_at is null) then
    raise exception 'School has been deactivated';
  end if;
  if not(c.sender_id=private.sms_sender_for_school(c.school_id) or
    (operator_ok and c.sender_id='EDUREPORT')) then
    raise exception 'Sender ID requires current school authorization';
  end if;
  if c.sender_id='Ark Academy' and not exists(
    select 1 from public.schools s
    where s.id=c.school_id and s.name='THE ARK ACADEMY'
  ) then raise exception 'Ark Academy Sender ID school mismatch'; end if;
  -- Recheck every selected recipient; no unchecked contact or stale opt-in is sent.
  select count(*) into active_guardians
  from public.guardian_sms_recipients r
  where r.campaign_id=c.id
    and exists(
      select 1 from public.guardian_sms_contacts contact
      join public.students st on st.id=contact.student_id
        and st.school_id=contact.school_id
      where contact.school_id=c.school_id
        and contact.student_id=any(r.student_ids)
        and contact.phone_e164=r.phone_e164 and contact.consent_status='OPTED_IN'
        and contact.consent_recorded_at is not null and st.status='ACTIVE'
        and not exists (
          select 1 from public.guardian_sms_contacts blocked
          where blocked.school_id=contact.school_id
            and blocked.phone_e164=contact.phone_e164
            and blocked.consent_status='OPTED_OUT'
        )
    );
  if active_guardians<>c.recipient_count or active_guardians=0 then
    raise exception 'Guardian contacts or consent changed; create a new preview';
  end if;

  -- Reserve the budget as a transaction, counting already-queued messages.
  perform pg_advisory_xact_lock(7382923145::bigint);
  select count(*) into already_used from (
    select id from public.sms_outbox
    where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
      and status in ('QUEUED','PROCESSING','SUBMITTED','DELIVERED','FAILED','UNKNOWN')
    union all
    select id from public.sms_test_outbox
    where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
      and status in ('QUEUED','PROCESSING','SUBMITTED','DELIVERED','FAILED','UNKNOWN')
    union all
    select id from public.guardian_sms_recipients
    where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
      and status<>'DRAFT'
  ) requests;
  select count(*) into school_used from (
    select id from public.sms_outbox
    where school_id=c.school_id and
      created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
      and status in ('QUEUED','PROCESSING','SUBMITTED','DELIVERED','FAILED','UNKNOWN')
    union all
    select id from public.guardian_sms_recipients
    where school_id=c.school_id and
      created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
      and status<>'DRAFT'
  ) requests;
  if already_used+c.recipient_count>cfg.global_daily_limit or
     school_used+c.recipient_count>cfg.school_daily_limit then
    raise exception 'SMS daily message allowance would be exceeded';
  end if;
  update public.guardian_sms_recipients
    set status='QUEUED',updated_at=now()
    where campaign_id=c.id and status='DRAFT';
  update public.guardian_sms_campaigns
    set status='QUEUED',confirmed_at=now(),updated_at=now()
    where id=c.id;
  return jsonb_build_object('id',c.id,'duplicate',false,
    'queued',c.recipient_count,'sender_id',c.sender_id);
end $$;
