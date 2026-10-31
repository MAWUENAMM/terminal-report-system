-- EduReport: include actual student name and payment method in payment SMS.
-- Staging verified on 2026-10-31. Existing SMS rows are preserved.
-- This migration does not change sending controls or transmit any SMS.
CREATE OR REPLACE FUNCTION private.sms_payment_body(p_student_name text, p_amount numeric, p_method text, p_receipt_number text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  student_name text;
  method_label text;
  amount_label text;
  receipt_label text;
  sms_body text;
begin
  student_name := btrim(regexp_replace(coalesce(p_student_name,''),'[[:space:]]+',' ','g'));
  student_name := translate(student_name,
    'áàâäãåÁÀÂÄÃÅéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜñÑçÇ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC');
  student_name := btrim(regexp_replace(student_name,'[^A-Za-z0-9 .''-]','','g'));
  if student_name='' then raise exception 'Student name is unavailable for SMS'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Invalid amount for SMS'; end if;
  amount_label := to_char(p_amount,'FM9999999990.00');
  if position('#' in amount_label)>0 then raise exception 'SMS amount cannot be formatted'; end if;
  method_label := case upper(coalesce(p_method,''))
    when 'CASH' then 'Cash'
    when 'MOMO' then 'Mobile Money'
    when 'BANK' then 'Bank Transfer'
    when 'CHEQUE' then 'Cheque'
    when 'OTHER' then 'Other'
    else null end;
  if method_label is null then raise exception 'Unsupported payment method for SMS'; end if;
  receipt_label := regexp_replace(btrim(coalesce(p_receipt_number,'')),'[^A-Za-z0-9-]','','g');
  if receipt_label='' then raise exception 'Missing receipt reference for SMS'; end if;
  sms_body := 'EDUREPORT: GHS '||amount_label||
    ' received for '||student_name||' via '||method_label||
    '. Receipt '||receipt_label||'.';
  if char_length(sms_body||' Check EduReport.')<=160 then
    sms_body:=sms_body||' Check EduReport.';
  end if;
  if char_length(sms_body)>160 then
    -- Prefer a shortened reference over dropping the learner name or method.
    sms_body := 'EDUREPORT: GHS '||amount_label||
      ' received for '||left(student_name,55)||' via '||method_label||
      '. Ref '||right(receipt_label,12)||'.';
  end if;
  if char_length(sms_body)>160 then
    raise exception 'Payment SMS exceeds a single 160-character segment';
  end if;
  return sms_body;
end $function$;

revoke all on function private.sms_payment_body(text,numeric,text,text) from public,anon,authenticated;

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
  txt := private.sms_payment_body(student_name,pay.amount,pay.method,pay.receipt_number);
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
        values(sid,pay.id,recipient.id,recipient.phone,txt,cfg.sender_id,actor)
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
