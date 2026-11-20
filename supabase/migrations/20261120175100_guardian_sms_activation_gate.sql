-- Controlled activation of guardian campaigns; separate from existing finance SMS.
-- Activation can only be called by the new authenticated Edge gateway using service_role.
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
revoke all on function public.guardian_sms_authorize_campaign(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.guardian_sms_authorize_campaign(uuid,uuid)
  to service_role;
