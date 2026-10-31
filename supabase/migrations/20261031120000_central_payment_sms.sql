-- EduReport central SMS foundation. NO PRODUCTION SMS SENDS.
-- A separate API secret and explicit Platform Admin activation are needed before delivery.
alter table public.school_users
  add column if not exists sms_opt_in boolean not null default false,
  add column if not exists sms_opted_in_at timestamptz;

create or replace function private.sms_reset_consent_on_phone_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.phone is distinct from old.phone then
    new.sms_opt_in := false;
    new.sms_opted_in_at := null;
  end if;
  return new;
end $$;
create trigger sms_reset_consent_on_phone_change
before update of phone on public.school_users for each row
execute function private.sms_reset_consent_on_phone_change();

create or replace function private.sms_normalize_ghana_phone(p_phone text)
returns text language plpgsql immutable set search_path = '' as $$
declare cleaned text := regexp_replace(coalesce(p_phone,''), '[[:space:]()-]', '', 'g');
begin
  if cleaned = '' then return null; end if;
  if cleaned ~ '^0[25][0-9]{8}$' then return '+233'||substring(cleaned from 2); end if;
  if cleaned ~ '^233[25][0-9]{8}$' then return '+'||cleaned; end if;
  if cleaned ~ '^\+233[25][0-9]{8}$' then return cleaned; end if;
  raise exception 'Enter a valid Ghana mobile number, e.g. 0241234567 or +233241234567.';
end $$;

-- Staff themselves must explicitly agree to SMS; admins cannot opt others in.
create or replace function public.sms_save_my_preferences(p_phone text,p_opt_in boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare mid uuid := private.member_id();
declare ph text;
declare staff_role text;
begin
  if mid is null then raise exception 'Sign in to an active school account' using errcode = '42501'; end if;
  select role into staff_role from public.school_users where id=mid for update;
  ph := private.sms_normalize_ghana_phone(p_phone);
  if p_opt_in and (staff_role not in ('ADMIN','ACCOUNTANT') or ph is null) then
    raise exception 'Payment SMS requires a finance role and a Ghana mobile number';
  end if;
  update public.school_users set phone=ph where id=mid and phone is distinct from ph;
  update public.school_users
    set sms_opt_in=p_opt_in,
        sms_opted_in_at=case when p_opt_in then now() else null end
    where id=mid;
end $$;
revoke all on function public.sms_save_my_preferences(text,boolean) from public,anon;
grant execute on function public.sms_save_my_preferences(text,boolean) to authenticated;

-- Admins may maintain staff phone numbers, but must not enable SMS on their behalf.
create or replace function public.sms_admin_update_staff_phone(p_staff_id uuid,p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare ph text;
begin
  if private.member_role() <> 'ADMIN' or private.member_school() is null then
    raise exception 'Only your school administrator can update staff contacts' using errcode = '42501';
  end if;
  ph := private.sms_normalize_ghana_phone(p_phone);
  update public.school_users set phone=ph
  where id=p_staff_id and school_id=private.member_school();
  if not found then raise exception 'Staff member was not found in your school'; end if;
end $$;
revoke all on function public.sms_admin_update_staff_phone(uuid,text) from public,anon;
grant execute on function public.sms_admin_update_staff_phone(uuid,text) to authenticated;

create table public.sms_central_settings (
  singleton boolean primary key default true check(singleton),
  provider text not null default 'ARKESEL' check(provider='ARKESEL'),
  sender_id text not null default 'EDUREPORT' check(sender_id ~ '^[A-Za-z0-9]{3,11}$'),
  billing_mode text not null default 'CENTRAL' check(billing_mode in ('CENTRAL','SCHOOL')),
  sending_enabled boolean not null default false,
  global_daily_limit integer not null default 20 check(global_daily_limit between 1 and 10000),
  school_daily_limit integer not null default 5 check(school_daily_limit between 1 and 10000),
  updated_at timestamptz not null default now()
);
insert into public.sms_central_settings(singleton) values (true);
alter table public.sms_central_settings enable row level security;
revoke all on public.sms_central_settings from public,anon,authenticated;
grant select on public.sms_central_settings to authenticated;
create policy sms_config_platform_read on public.sms_central_settings for select to authenticated
  using ((select private.is_operator()));

create table public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  payment_id uuid not null,
  recipient_staff_id uuid not null,
  phone_e164 text not null check(phone_e164 ~ '^\+233[25][0-9]{8}$'),
  body text not null check(char_length(body) between 1 and 160),
  sender_id text not null default 'EDUREPORT',
  status text not null default 'QUEUED'
    check(status in ('QUEUED','PROCESSING','SUBMITTED','DELIVERED','FAILED','UNKNOWN')),
  provider_message_id text,
  credits_used integer not null default 0 check(credits_used between 0 and 100),
  last_error text,
  requested_by uuid not null references public.school_users(id),
  created_at timestamptz not null default now(),
  send_started_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(payment_id,recipient_staff_id),
  foreign key(payment_id,school_id) references public.finance_payments(id,school_id),
  foreign key(recipient_staff_id,school_id) references public.school_users(id,school_id)
);
create index sms_outbox_school_date on public.sms_outbox(school_id,created_at desc);
create index sms_outbox_status on public.sms_outbox(status,created_at);
alter table public.sms_outbox enable row level security;
revoke all on public.sms_outbox from public,anon,authenticated;
grant select on public.sms_outbox to authenticated;
create policy sms_outbox_school_finance_or_operator on public.sms_outbox
 for select to authenticated using (
   (select private.is_operator()) or
   (school_id=(select private.member_school()) and (select private.finance_access()))
 );

-- Only active school finance users can queue for opted-in Admins / Accountants in
-- their own school. Disabled mode makes no outbound records and spends no credits.
create or replace function public.sms_request_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sid uuid := private.member_school();
declare actor uuid := private.member_id();
declare cfg public.sms_central_settings%rowtype;
declare pay public.finance_payments%rowtype;
declare admission text;
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
  select admission_number into admission from public.students
  where id=pay.student_id and school_id=sid;
  if admission is null then raise exception 'Student record not found'; end if;
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
  txt := 'EDUREPORT: GHS '||to_char(pay.amount,'FM9999999990.00')||
    ' received for student '||left(admission,22)||
    '. Receipt '||pay.receipt_number||'. Check EduReport.';
  if char_length(txt)>160 then
    txt := 'EDUREPORT: GHS '||to_char(pay.amount,'FM9999999990.00')||
      ' received. Receipt '||pay.receipt_number||'. See EduReport.';
  end if;
  if char_length(txt)>160 then raise exception 'SMS would exceed the single-credit length'; end if;
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
end $$;
revoke all on function public.sms_request_payment(uuid) from public,anon;
grant execute on function public.sms_request_payment(uuid) to authenticated;

-- Platform-wide reporting is handled exclusively by a server-verified operator,
-- never by School Admin or Accountant privileges.
create or replace function public.sms_platform_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_operator() then raise exception 'Platform Administrator required' using errcode='42501'; end if;
  select jsonb_build_object(
    'provider',c.provider,
    'sender_id',c.sender_id,
    'billing_mode',c.billing_mode,
    'sending_enabled',c.sending_enabled,
    'global_daily_limit',c.global_daily_limit,
    'school_daily_limit',c.school_daily_limit,
    'totals',(select jsonb_build_object(
      'messages',count(*),'submitted',count(*) filter(where status in ('SUBMITTED','DELIVERED')),
      'delivered',count(*) filter(where status='DELIVERED'),
      'queued',count(*) filter(where status in ('QUEUED','PROCESSING')),
      'failed',count(*) filter(where status in ('FAILED','UNKNOWN')),
      'credits_used',coalesce(sum(credits_used),0)) from public.sms_outbox),
    'schools',(select coalesce(jsonb_agg(school_json order by school_name),'[]'::jsonb)
      from (select s.name as school_name,jsonb_build_object(
         'school_id',s.id,'school_name',s.name,
         'messages',count(o.id),'credits_used',coalesce(sum(o.credits_used),0),
         'submitted',count(o.id) filter(where o.status in ('SUBMITTED','DELIVERED')),
         'queued',count(o.id) filter(where o.status in ('QUEUED','PROCESSING')),
         'opted_in_staff',(select count(*) from public.school_users u
           where u.school_id=s.id and u.active and u.sms_opt_in and u.role in ('ADMIN','ACCOUNTANT')))
        as school_json from public.schools s
        left join public.sms_outbox o on o.school_id=s.id
        where s.deleted_at is null group by s.id,s.name) x)
  ) into result from public.sms_central_settings c where singleton=true;
  return result;
end $$;
revoke all on function public.sms_platform_dashboard() from public,anon;
grant execute on function public.sms_platform_dashboard() to authenticated;
