-- Finance regression / authorization test.
-- Run only against a disposable migrated Supabase environment.
-- Fixtures are enclosed in BEGIN/ROLLBACK to preserve the test environment.
begin;

create function pg_temp.expect(ok boolean, label text) returns void
language plpgsql as $$
begin
 if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
create function pg_temp.denied(command text,label text) returns void
language plpgsql as $$
begin
 begin execute command; exception when others then return; end;
 raise exception 'FAIL: permission not denied for %', label;
end $$;

insert into public.schools(id,name,academic_year,current_term) values
 ('a0000000-0000-4000-8000-000000000001','Finance test school A','2026/2027',1),
 ('a0000000-0000-4000-8000-000000000002','Finance test school B','2026/2027',1);
insert into auth.users(id,email) values
 ('a1000000-0000-4000-8000-000000000001','finance-admin-a@example.invalid'),
 ('a1000000-0000-4000-8000-000000000002','finance-accountant-a@example.invalid'),
 ('a1000000-0000-4000-8000-000000000003','finance-teacher-a@example.invalid'),
 ('a1000000-0000-4000-8000-000000000004','finance-accountant-b@example.invalid');
insert into public.school_users(id,auth_user_id,school_id,full_name,email,role) values
 ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Finance Admin A','finance-admin-a@example.invalid','ADMIN'),
 ('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Finance Accountant A','finance-accountant-a@example.invalid','ACCOUNTANT'),
 ('a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','Finance Teacher A','finance-teacher-a@example.invalid','CLASS_TEACHER'),
 ('a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000002','Finance Accountant B','finance-accountant-b@example.invalid','ACCOUNTANT');
insert into public.classes(id,school_id,name,level,academic_year) values
 ('a2000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Primary 1','PRIMARY','2026/2027'),
 ('a2000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Primary 2','PRIMARY','2026/2027');
insert into public.students(id,school_id,admission_number,first_name,last_name,gender,class_id) values
 ('a3000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','FIN001','Finance','Learner1','F','a2000000-0000-4000-8000-000000000001'),
 ('a3000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','FIN002','Finance','Learner2','M','a2000000-0000-4000-8000-000000000001'),
 ('a3000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002','FIN003','Other','School','F','a2000000-0000-4000-8000-000000000002');
insert into public.academic_terms(school_id,academic_year,term) values
 ('a0000000-0000-4000-8000-000000000001','2026/2027',1),
 ('a0000000-0000-4000-8000-000000000002','2026/2027',1);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);

insert into public.finance_fees(id,school_id,academic_year,term,name,category,amount,created_by)
values('a4000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','2026/2027',1,'Term tuition','FEE',100,
'a1000000-0000-4000-8000-000000000002');
select pg_temp.expect(public.finance_apply_fee('a4000000-0000-4000-8000-000000000001')=2,'two students charged');
select pg_temp.expect(public.finance_apply_fee('a4000000-0000-4000-8000-000000000001')=0,'repeat apply does not duplicate');
select pg_temp.expect((select count(*)=2 from public.finance_charges),'both students have one charge');
select pg_temp.expect((select status='APPLIED' from public.finance_fees where id='a4000000-0000-4000-8000-000000000001'),'fee status applied');
-- RLS UPDATE can return zero rows without an error; assert unchanged state instead.
update public.finance_fees set amount=500 where id='a4000000-0000-4000-8000-000000000001';
-- RLS can silently skip blocked rows: always confirm the amount remains unchanged.
select pg_temp.expect((select amount=100 from public.finance_fees where id='a4000000-0000-4000-8000-000000000001'),'applied fee remains unchanged');

select pg_temp.expect(public.finance_record_payment(
 'a3000000-0000-4000-8000-000000000001',30,'CASH','','','a6000000-0000-4000-8000-000000000001') is not null,
 'partial payment recorded');
select pg_temp.expect(public.finance_record_payment(
 'a3000000-0000-4000-8000-000000000001',30,'CASH','','','a6000000-0000-4000-8000-000000000001')
 = (select id from public.finance_payments where request_key='a6000000-0000-4000-8000-000000000001'),
 'retry reuses exact same payment');
select pg_temp.expect((select count(*)=1 from public.finance_payments),'idempotent payment row');
select pg_temp.expect((select sum(amount)=30 from public.finance_allocations),'allocations total thirty');
select pg_temp.denied($q$select public.finance_record_payment(
 'a3000000-0000-4000-8000-000000000001',1000,'CASH','','',
 'a6000000-0000-4000-8000-000000000009')$q$,'overpayment rejected');
select pg_temp.expect((select count(*)=1 from public.finance_payments),'overpayment leaves no payment');

insert into public.finance_items(id,school_id,name,unit_price,stock_quantity)
values('a5000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',
'Uniform',15,3);
select pg_temp.expect(public.finance_sell_item(
 'a5000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',1,
 'a6000000-0000-4000-8000-000000000002') is not null,'item sale recorded');
select pg_temp.expect(public.finance_sell_item(
 'a5000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',1,
 'a6000000-0000-4000-8000-000000000002')
 = (select id from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000002'),
 'sale retry same identity');
select pg_temp.expect((select stock_quantity=2 from public.finance_items where id='a5000000-0000-4000-8000-000000000001'),
 'stock decremented exactly once');
select pg_temp.expect((select count(*)=3 from public.finance_charges),'sale generates a new charge');

select pg_temp.expect(public.finance_void_payment(
 (select id from public.finance_payments where request_key='a6000000-0000-4000-8000-000000000001'),
 'Payment entered in error')=true,'reversal succeeds');
select pg_temp.expect((select count(*)=1 from public.finance_payments where voided_at is not null),'original retained');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.expect((select count(*)=0 from public.finance_payments),'teacher sees no payments');
select pg_temp.denied($q$select public.finance_apply_fee('a4000000-0000-4000-8000-000000000001')$q$,'teacher cannot apply fee');
select pg_temp.denied($q$select public.finance_record_payment(
 'a3000000-0000-4000-8000-000000000001',5,'CASH','','',
 'a6000000-0000-4000-8000-000000000008')$q$,'teacher cannot record payment');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.expect((select count(*)=0 from public.finance_charges),'other school cannot see charges');
select pg_temp.expect((select count(*)=0 from public.finance_payments),'other school cannot see payments');
select pg_temp.denied($q$select public.finance_void_payment(
 (select id from public.finance_payments where request_key='a6000000-0000-4000-8000-000000000001'),
 'Attempting unauthorized reversal')$q$,'other school cannot void payment');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.expect((select count(*)=3 from public.finance_charges),'admin sees all own-school charges');
select pg_temp.expect((select count(*)>=4 from public.finance_events),'admin receives audit events');

rollback;
