-- School-specific sender selection, inert until the Platform Administrator explicitly
-- enables the school override after a controlled Arkesel API/carrier test.
-- Default sender remains EDUREPORT. No SMS is sent by this migration.
-- Staging may have no THE ARK ACADEMY row; no production IDs are transplanted.

create table if not exists public.sms_school_sender_ids (
  school_id uuid primary key references public.schools(id) on delete cascade,
  sender_id text not null
    check (sender_id ~ '^[A-Za-z][A-Za-z0-9 ]{2,10}$' and sender_id !~ '  '),
  enabled_for_school_sms boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sms_school_sender_ids enable row level security;
revoke all on public.sms_school_sender_ids from public, anon, authenticated;
comment on table public.sms_school_sender_ids is
  'Operator-controlled SMS sender overrides. Pending sender IDs never affect school payment SMS until explicitly enabled.';

-- Register THE ARK ACADEMY as PENDING when that verified school exists.
-- Never alter other schools or the central sender ID.
insert into public.sms_school_sender_ids (school_id, sender_id, enabled_for_school_sms)
select s.id, 'Ark Academy', false
from public.schools s
where s.name = 'THE ARK ACADEMY' and s.active and s.deleted_at is null
on conflict (school_id) do nothing;

create or replace function private.sms_sender_for_school(p_school_id uuid)
returns text language sql stable set search_path = '' as $$
  select coalesce(
    (select setting.sender_id
       from public.sms_school_sender_ids setting
       join public.schools school on school.id = setting.school_id
       where setting.school_id = p_school_id
         and setting.enabled_for_school_sms = true
         and school.active = true and school.deleted_at is null),
    (select c.sender_id from public.sms_central_settings c where c.singleton = true)
  );
$$;
revoke all on function private.sms_sender_for_school(uuid) from public, anon, authenticated;

create or replace function private.sms_school_payment_body(
  p_school_id uuid, p_student_name text, p_amount numeric, p_method text, p_receipt_number text)
returns text language plpgsql stable set search_path = '' as $$
declare sms_body text;
begin
  sms_body := private.sms_payment_body(p_student_name,p_amount,p_method,p_receipt_number);
  if private.sms_sender_for_school(p_school_id) <> 'Ark Academy' then
    return sms_body;
  end if;
  sms_body := regexp_replace(sms_body,'^EDUREPORT: ','Ark Academy: ');
  sms_body := replace(sms_body,' Check EduReport.','');
  if char_length(sms_body)>160 then
    sms_body := private.sms_payment_body(left(p_student_name,40),p_amount,p_method,p_receipt_number);
    sms_body := regexp_replace(sms_body,'^EDUREPORT: ','Ark Academy: ');
    sms_body := replace(sms_body,' Check EduReport.','');
  end if;
  if char_length(sms_body)>160 then
    raise exception 'School-branded SMS would exceed 160 characters';
  end if;
  return sms_body;
end $$;
revoke all on function private.sms_school_payment_body(uuid,text,numeric,text,text) from public,anon,authenticated;

-- The diagnostic test outbox retains sender identities for both brands.
alter table public.sms_test_outbox drop constraint if exists sms_test_outbox_sender_id_check;
alter table public.sms_test_outbox add constraint sms_test_outbox_sender_id_check
  check (sender_id in ('EDUREPORT','Ark Academy'));

-- Retain existing finance permission checks, consent and duplicate protection.
-- Only the queued sender and body become school-aware.

CREATE OR REPLACE FUNCTION public.sms_request_payment(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid := private.member_school();
declare actor uuid := private.member_id();
declare cfg public.sms_central_settings%rowtype;
declare pay public.finance_payments%rowtype;
declare student_name text;
declare txt text;
declare recipient record;
declare daily integer;
declare school_daily integer;
declare recipient_count integer := 0;
declare queued_ids uuid[] := '{}';
declare new_id uuid;
begin
  if not private.finance_access() then raise exception 'School finance access required' using errcode='42501'; end if;
  select * into pay from public.finance_payments
  where id=p_payment_id and school_id=sid and voided_at is null;
  if not found then raise exception 'An active payment was not found in your school'; end if;
  select btrim(concat_ws(' ', nullif(btrim(first_name),''), nullif(btrim(last_name),'')))
    into student_name from public.students
  where id=pay.student_id and school_id=sid;
  if coalesce(student_name,'')='' then raise exception 'Student name not found'; end if;
  select * into cfg from public.sms_central_settings where singleton=true for update;
  if cfg.billing_mode <> 'CENTRAL' then raise exception 'School SMS wallet mode is not active yet'; end if;
  select count(*) into recipient_count from public.school_users u
  where u.school_id=sid and u.active and not u.must_change_password
    and u.role in ('ADMIN','ACCOUNTANT') and u.sms_opt_in
    and u.phone ~ '^\+233[25][0-9]{8}$';
  if not cfg.sending_enabled then
    return jsonb_build_object('mode','PREVIEW','eligible',recipient_count,'queued',0,
      'message','SMS is inactive until EDUREPORT sender approval and API setup.');
  end if;
  select count(*) into daily from public.sms_outbox
    where created_at>=date_trunc('day',now()) and status in ('QUEUED','PROCESSING','SUBMITTED','DELIVERED','UNKNOWN');
  select count(*) into school_daily from public.sms_outbox
    where school_id=sid and created_at>=date_trunc('day',now())
    and status in ('QUEUED','PROCESSING','SUBMITTED','DELIVERED','UNKNOWN');
  txt := private.sms_school_payment_body(sid,student_name,pay.amount,pay.method,pay.receipt_number);
  for recipient in
    select u.id,u.phone from public.school_users u
    where u.school_id=sid and u.active and not u.must_change_password
      and u.role in ('ADMIN','ACCOUNTANT') and u.sms_opt_in
      and u.phone ~ '^\+233[25][0-9]{8}$'
  loop
    select id into new_id from public.sms_outbox
      where payment_id=pay.id and recipient_staff_id=recipient.id;
    if new_id is null then
      if daily>=cfg.global_daily_limit or school_daily>=cfg.school_daily_limit then
        raise exception 'Daily SMS limit reached. Contact EduReport Platform Admin.';
      end if;
      insert into public.sms_outbox(school_id,payment_id,recipient_staff_id,
         phone_e164,body,sender_id,requested_by)
        values(sid,pay.id,recipient.id,recipient.phone,txt,private.sms_sender_for_school(sid),actor)
        on conflict(payment_id,recipient_staff_id) do nothing returning id into new_id;
      if new_id is not null then daily:=daily+1;school_daily:=school_daily+1; end if;
    end if;
    if new_id is not null and exists(select 1 from public.sms_outbox
      where id=new_id and status='QUEUED') then
      queued_ids:=array_append(queued_ids,new_id);
    end if;
    new_id:=null;
  end loop;
  return jsonb_build_object('mode','READY','eligible',recipient_count,'queued',array_length(queued_ids,1),
     'ids',to_jsonb(queued_ids));
end $function$;

revoke all on function public.sms_request_payment(uuid) from public,anon;
grant execute on function public.sms_request_payment(uuid) to authenticated;

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
    private.sms_school_payment_body(sid,concat_ws(' ',nullif(btrim(st.first_name),''),
      nullif(btrim(st.last_name),'')),payment.amount,payment.method,payment.receipt_number),
    private.sms_sender_for_school(sid),actor,note,now()
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
