-- EduReport: school Administrator-consented, one-off extra payment SMS recipient.
-- This does not enable sending. Never move to production without rollout approval.
alter table public.sms_outbox
  alter column recipient_staff_id drop not null,
  add column recipient_kind text not null default 'STAFF',
  add column recipient_reason text,
  add column consent_confirmed_at timestamptz,
  add column credits_verified boolean not null default false;

alter table public.sms_outbox add constraint sms_recipient_kind_valid check (
  (recipient_kind='STAFF' and recipient_staff_id is not null and consent_confirmed_at is null)
  or
  (recipient_kind='CUSTOM' and recipient_staff_id is null
   and consent_confirmed_at is not null and recipient_reason is not null
   and char_length(btrim(recipient_reason)) between 8 and 120)
);
create unique index sms_outbox_one_payment_phone
  on public.sms_outbox(payment_id,phone_e164);
create unique index sms_outbox_one_custom_per_payment
  on public.sms_outbox(payment_id) where recipient_kind='CUSTOM';

-- Estimated one credit for an accepted single-segment message only when the
-- provider's send reply omitted credit usage. Do not mark this provider-verified.
update public.sms_outbox
  set credits_used=1,credits_verified=false
  where status='SUBMITTED' and credits_used=0 and provider_message_id is not null
    and char_length(body)<=160;

CREATE OR REPLACE FUNCTION public.sms_request_payment_extra(p_payment_id uuid, p_extra_phone text, p_extra_consent boolean, p_extra_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sid uuid := private.member_school();
  actor uuid := private.member_id();
  ph text;
  note text := btrim(coalesce(p_extra_reason,''));
  original jsonb;
  cfg public.sms_central_settings%rowtype;
  payment public.finance_payments%rowtype;
  total_daily integer;
  school_daily integer;
  inserted uuid;
begin
  if private.member_role() <> 'ADMIN' or sid is null or actor is null then
    raise exception 'Only your school Administrator may add a custom payment SMS recipient'
      using errcode='42501';
  end if;
  if p_extra_consent is distinct from true then
    raise exception 'Confirm the recipient has expressly consented to receive this student payment notification';
  end if;
  if char_length(note) not between 8 and 120 then
    raise exception 'State why this recipient is authorized (8 to 120 characters)';
  end if;
  ph:=private.sms_normalize_ghana_phone(p_extra_phone);
  if ph is null then raise exception 'Enter a valid Ghana mobile number'; end if;
  -- Staff opt-in is managed through their profiles; cannot override it with a custom send.
  if exists(select 1 from public.school_users u where u.school_id=sid and u.phone=ph) then
    raise exception 'This phone belongs to a school staff account; manage its own SMS opt-in instead';
  end if;
  select * into payment from public.finance_payments
    where id=p_payment_id and school_id=sid and voided_at is null;
  if not found then raise exception 'Payment not found in your school' using errcode='42501'; end if;
  -- Existing RPC performs finance authorization, student lookup, staff opt-ins,
  -- queue locking and daily limits; it is left intact.
  original := public.sms_request_payment(p_payment_id);
  if original->>'mode'<>'READY' then
    return original || jsonb_build_object('custom_recipient','PREVIEW','custom_queued',false);
  end if;
  select * into cfg from public.sms_central_settings where singleton=true for update;
  if cfg.sending_enabled is distinct from true then
    raise exception 'SMS sending is not enabled';
  end if;
  -- One extra recipient per payment. Retries must never send to a new custom number.
  if exists (select 1 from public.sms_outbox o
    where o.payment_id=p_payment_id and o.recipient_kind='CUSTOM') then
    return original || jsonb_build_object('custom_recipient','ALREADY_RECORDED','custom_queued',false);
  end if;
  if exists(select 1 from public.sms_outbox o
    where o.payment_id=p_payment_id and o.phone_e164=ph) then
    return original || jsonb_build_object('custom_recipient','ALREADY_RECORDED','custom_queued',false);
  end if;
  select count(*) into total_daily from public.sms_outbox
    where created_at>=date_trunc('day',now())
      and status in ('QUEUED','PROCESSING','SUBMITTED','DELIVERED','UNKNOWN');
  select count(*) into school_daily from public.sms_outbox
    where school_id=sid and created_at>=date_trunc('day',now())
      and status in ('QUEUED','PROCESSING','SUBMITTED','DELIVERED','UNKNOWN');
  if total_daily>=cfg.global_daily_limit or school_daily>=cfg.school_daily_limit then
    raise exception 'Daily SMS limit reached; no additional recipient SMS queued';
  end if;
  insert into public.sms_outbox
    (school_id,payment_id,recipient_staff_id,recipient_kind,phone_e164,
     body,sender_id,requested_by,recipient_reason,consent_confirmed_at)
  select sid,payment.id,null,'CUSTOM',ph,
    private.sms_payment_body(concat_ws(' ',nullif(btrim(st.first_name),''),
      nullif(btrim(st.last_name),'')),payment.amount,payment.method,payment.receipt_number),
    cfg.sender_id,actor,note,now()
  from public.students st
  where st.id=payment.student_id and st.school_id=sid
  on conflict do nothing
  returning id into inserted;
  if inserted is null then
    raise exception 'Additional SMS recipient was not queued. Check for a duplicate recipient';
  end if;
  return jsonb_set(original,'{ids}',
    coalesce(original->'ids','[]'::jsonb)||jsonb_build_array(inserted),true)
    || jsonb_build_object('custom_recipient','QUEUED','custom_queued',true,
      'queued',coalesce((original->>'queued')::integer,0)+1);
end $function$;

revoke all on function public.sms_request_payment_extra(uuid,text,boolean,text) from public,anon;
grant execute on function public.sms_request_payment_extra(uuid,text,boolean,text) to authenticated;
