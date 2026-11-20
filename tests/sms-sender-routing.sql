-- School-specific SMS sender regression; disposable local database ONLY.
-- Test rows are rolled back. Never sends Arkesel messages.
begin;
create function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
create function pg_temp.denied(command text, label text) returns void language plpgsql as $$
begin
  begin execute command; exception when insufficient_privilege then return; end;
  raise exception 'FAIL: permission not denied for %', label;
end $$;

insert into public.schools (id,name,academic_year,current_term) values
 ('c0000000-0000-4000-8000-000000000001','Ark sender test school','2026/2027',1),
 ('c0000000-0000-4000-8000-000000000002','Unrelated SMS school','2026/2027',1);

select pg_temp.expect(
 private.sms_sender_for_school('c0000000-0000-4000-8000-000000000001') = 'EDUREPORT',
 'Without a school override, sender remains EDUREPORT');

insert into public.sms_school_sender_ids (school_id,sender_id,enabled_for_school_sms)
values ('c0000000-0000-4000-8000-000000000001','Ark Academy',false);

select pg_temp.expect(
 private.sms_sender_for_school('c0000000-0000-4000-8000-000000000001') = 'EDUREPORT',
 'Pending Ark Academy Sender ID cannot silently change school SMS');
select pg_temp.expect(
 private.sms_sender_for_school('c0000000-0000-4000-8000-000000000002') = 'EDUREPORT',
 'Unrelated school keeps central sender during pending registration');

update public.sms_school_sender_ids set enabled_for_school_sms=true
where school_id='c0000000-0000-4000-8000-000000000001';

select pg_temp.expect(
 private.sms_sender_for_school('c0000000-0000-4000-8000-000000000001') = 'Ark Academy',
 'Explicitly enabled Ark override uses Ark Academy');
select pg_temp.expect(
 private.sms_sender_for_school('c0000000-0000-4000-8000-000000000002') = 'EDUREPORT',
 'Enabling Ark override cannot modify another school');
select pg_temp.expect(
 private.sms_school_payment_body('c0000000-0000-4000-8000-000000000001',
   'Test Learner',25,'CASH','ARK-TEST-01') like 'Ark Academy:%',
 'Ark-branded school payment content uses the school prefix');
select pg_temp.expect(
 private.sms_school_payment_body('c0000000-0000-4000-8000-000000000002',
   'Test Learner',25,'CASH','OTHER-TEST-01') like 'EDUREPORT:%',
 'Unrelated school payment content keeps EDUREPORT branding');
select pg_temp.expect(
 char_length(private.sms_school_payment_body('c0000000-0000-4000-8000-000000000001',
 'Test Learner',25,'MOMO','ARK-TEST-01'))<=160,
 'School-branded SMS stays within single-segment limit');

set local role authenticated;
select pg_temp.denied(
 'update public.sms_school_sender_ids set enabled_for_school_sms=false',
 'School staff cannot modify Sender ID activation');
select pg_temp.denied(
 'select * from public.sms_school_sender_ids',
 'School staff cannot directly view privileged Sender ID configuration');
rollback;
