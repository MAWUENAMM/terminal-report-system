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
'Uniform',15,6);
select pg_temp.expect(public.finance_sell_item(
 'a5000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',1,
 'a6000000-0000-4000-8000-000000000002') is not null,'item sale recorded');
select pg_temp.expect(public.finance_sell_item(
 'a5000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',1,
 'a6000000-0000-4000-8000-000000000002')
 = (select id from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000002'),
 'sale retry same identity');
select pg_temp.expect((select stock_quantity=5 from public.finance_items where id='a5000000-0000-4000-8000-000000000001'),
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

-- A fee explicitly targeting one learner must never affect their classmates.
insert into public.finance_fees(id,school_id,academic_year,term,name,category,amount,target_student_id,created_by)
values ('a4000000-0000-4000-8000-000000000011',
 'a0000000-0000-4000-8000-000000000001','2026/2027',1,
 'Single learner lab materials','OTHER',45,
 'a3000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000001');
select pg_temp.expect(public.finance_apply_fee('a4000000-0000-4000-8000-000000000011')=1,
 'individual learner fee applies once');
select pg_temp.expect(public.finance_apply_fee('a4000000-0000-4000-8000-000000000011')=0,
 'individual learner fee cannot be duplicated');
select pg_temp.expect((select count(*)=1 from public.finance_charges
 where fee_id='a4000000-0000-4000-8000-000000000011'
 and student_id='a3000000-0000-4000-8000-000000000002'),
 'individual fee never hits classmate');
select pg_temp.denied($q$insert into public.finance_fees(school_id,academic_year,term,class_id,target_student_id,name,category,amount,created_by)
values('a0000000-0000-4000-8000-000000000001','2026/2027',1,
 'a2000000-0000-4000-8000-000000000001',
 'a3000000-0000-4000-8000-000000000002',
 'Illegal dual scope','FEE',5,'a1000000-0000-4000-8000-000000000001')$q$,
 'class and specific student cannot both be targeted');
select pg_temp.denied($q$insert into public.finance_fees(school_id,academic_year,term,target_student_id,name,category,amount,created_by)
values('a0000000-0000-4000-8000-000000000001','2026/2027',1,
 'a3000000-0000-4000-8000-000000000003','Wrong school','FEE',5,
 'a1000000-0000-4000-8000-000000000001')$q$,
 'specific fee cannot target student from another school');

-- A student can pay for an item directly even with older school fees outstanding.
select pg_temp.expect(public.finance_sell_item(
 'a5000000-0000-4000-8000-000000000001',
 'a3000000-0000-4000-8000-000000000002',1,
 'a6000000-0000-4000-8000-000000000020') is not null,
 'second student sale created for item-payment test');
select pg_temp.expect(public.finance_record_item_payment(
 (select id from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000020'),
 15,'CASH','TEST-ITEM-001','Item payment','a6000000-0000-4000-8000-000000000021') is not null,
 'item-specific cash payment succeeds');
select pg_temp.expect(
 (select sum(a.amount)=15 from public.finance_allocations a
 join public.finance_charges ch on ch.id=a.charge_id
 where ch.sale_id=(select id from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000020')),
 'full item payment goes to sale charge, not older fees');
select pg_temp.expect(
 (select count(*)=1 from public.finance_payments where request_key='a6000000-0000-4000-8000-000000000021'),
 'one item payment only');
select pg_temp.expect(public.finance_record_item_payment(
 (select id from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000020'),
 15,'CASH','TEST-ITEM-001','Item payment','a6000000-0000-4000-8000-000000000021')
 = (select id from public.finance_payments where request_key='a6000000-0000-4000-8000-000000000021'),
 'item payment retry is idempotent');
select pg_temp.denied($q$select public.finance_record_item_payment(
 (select id from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000020'),
 1,'CASH','OTHER','Invalid duplicate','a6000000-0000-4000-8000-000000000022')$q$,
 'paid item cannot be overpaid');

-- Existing money assigned to a fee can be reallocated to a sale without a new receipt/payment.
select public.finance_record_payment('a3000000-0000-4000-8000-000000000002',
 25,'MOMO','TEST-MOMO-002','Fee allocation test','a6000000-0000-4000-8000-000000000023');
select pg_temp.expect(public.finance_sell_item(
 'a5000000-0000-4000-8000-000000000001',
 'a3000000-0000-4000-8000-000000000002',1,
 'a6000000-0000-4000-8000-000000000024') is not null,
 'sale exists for reallocation');
select pg_temp.expect(public.finance_reassign_payment_to_sale(
 (select id from public.finance_payments where request_key='a6000000-0000-4000-8000-000000000023'),
 (select id from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000024'),
 15,'Cash mistakenly applied to old school fees',
 'a6000000-0000-4000-8000-000000000025') is not null,
 'reassign old fee payment to item');
select pg_temp.expect(
 (select a.amount=15 from public.finance_allocations a
 join public.finance_charges c on c.id=a.charge_id
 join public.finance_sales sale on sale.id=c.sale_id
 where sale.request_key='a6000000-0000-4000-8000-000000000024'),
 'reallocated money is on correct item');
select pg_temp.expect(
 (select count(*)=1 from public.finance_payment_reassignments
 where request_key='a6000000-0000-4000-8000-000000000025'),
 'correction audit recorded exactly once');
select pg_temp.expect(public.finance_reassign_payment_to_sale(
 (select id from public.finance_payments where request_key='a6000000-0000-4000-8000-000000000023'),
 (select id from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000024'),
 15,'Cash mistakenly applied to old school fees',
 'a6000000-0000-4000-8000-000000000025')
 =(select id from public.finance_payment_reassignments
   where request_key='a6000000-0000-4000-8000-000000000025'),
 'same correction request cannot reassign twice');

select pg_temp.expect(
 (public.finance_sell_item_paid('a5000000-0000-4000-8000-000000000001',
 'a3000000-0000-4000-8000-000000000001',1,
 'a6000000-0000-4000-8000-000000000030',
 'a6000000-0000-4000-8000-000000000031',15,'CASH','CHECKOUT') ->> 'payment_id') is not null,
 'combined checkout saves sale and payment atomically');
select pg_temp.expect(
 (select count(*)=1 from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000030'),
 'checkout creates one sale');
select pg_temp.expect(
 (select count(*)=1 from public.finance_payments where request_key='a6000000-0000-4000-8000-000000000031'),
 'checkout creates one payment');
select pg_temp.expect(
 (select sum(a.amount)=15 from public.finance_allocations a
 join public.finance_payments p on p.id=a.payment_id
 where p.request_key='a6000000-0000-4000-8000-000000000031'),
 'checkout payment allocated directly to purchased item');
select pg_temp.expect(
 (public.finance_sell_item_paid('a5000000-0000-4000-8000-000000000001',
 'a3000000-0000-4000-8000-000000000001',1,
 'a6000000-0000-4000-8000-000000000030',
 'a6000000-0000-4000-8000-000000000031',15,'CASH','CHECKOUT') ->> 'payment_id') is not null,
 'checkout retry safe');

-- Teacher and another school's accountant cannot alter item settlements.
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.denied($q$select public.finance_record_item_payment(
 'a6000000-0000-4000-8000-000000000020',1,'CASH','','',
 'a6000000-0000-4000-8000-000000000040')$q$, 'teacher blocked from item payment');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.denied($q$select public.finance_reassign_payment_to_sale(
 (select id from public.finance_payments where request_key='a6000000-0000-4000-8000-000000000023'),
 (select id from public.finance_sales where request_key='a6000000-0000-4000-8000-000000000024'),
 1,'Improper cross-school finance correction','a6000000-0000-4000-8000-000000000041')$q$,
 'cross-school correction prohibited');


-- EDUREPORT SMS: explicit consent, private central reporting, disabled-by-default
-- provider, one school per payment, daily limits, and queue idempotency.
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.expect((select count(*)=0 from public.sms_outbox),'outbox initially empty');
select pg_temp.expect((select count(*)=0 from public.sms_central_settings),'central config hidden from accountant');

select public.sms_save_my_preferences('0241234567',true);
select pg_temp.expect(
 (select sms_opt_in and phone='+233241234567' from public.school_users
  where id='a1000000-0000-4000-8000-000000000002'),
 'accountant phone normalized and opted in');
select pg_temp.expect(
 (public.sms_request_payment((select id from public.finance_payments
   where request_key='a6000000-0000-4000-8000-000000000021'))->>'mode')='PREVIEW',
 'sender pending; payment notify remains preview-only');
select pg_temp.expect((select count(*)=0 from public.sms_outbox),
 'disabled provider creates no records and costs no credits');

select pg_temp.denied($q$select public.sms_admin_update_staff_phone(
 'a1000000-0000-4000-8000-000000000001','0241234567')$q$,
 'accountant may not set admin phone');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.denied($q$select public.sms_save_my_preferences('0241234567',true)$q$,
 'teacher must not opt in for finance SMS');
select pg_temp.denied($q$select public.sms_request_payment(
 'a6000000-0000-4000-8000-000000000001')$q$,
 'teacher cannot send SMS');
select pg_temp.denied($q$select public.sms_platform_dashboard()$q$,
 'teacher cannot see central SMS monitoring');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.denied($q$select public.sms_platform_dashboard()$q$,
 'other school accountant cannot see central dashboard');
select pg_temp.denied($q$select public.sms_request_payment(
 (select id from public.finance_payments where request_key=
  'a6000000-0000-4000-8000-000000000021')$q$,
 'other school cannot notify payment');

-- Only a Platform Operator may view cross-school usage metrics.
reset role;
insert into public.platform_operators(auth_user_id)
values('a1000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.expect(public.sms_platform_dashboard()->>'sender_id'='EDUREPORT',
 'platform operator sees central sender');
select pg_temp.expect(public.sms_platform_dashboard()->>'sending_enabled'='false',
 'production messaging explicitly disabled by default');

-- Admin updates another staff phone but does NOT consent on their behalf.
select public.sms_admin_update_staff_phone(
 'a1000000-0000-4000-8000-000000000002','0551234567');
select pg_temp.expect(
 (select phone='+233551234567' and not sms_opt_in from public.school_users
 where id='a1000000-0000-4000-8000-000000000002'),
 'updating staff phone resets their consent');

-- Test internal queue with sending enabled INSIDE the disposable transaction only.
reset role;
update public.sms_central_settings set sending_enabled=true where singleton=true;
set local role authenticated;
select public.sms_save_my_preferences('0247654321',true);
select pg_temp.expect(
 (public.sms_request_payment((select id from public.finance_payments
 where request_key='a6000000-0000-4000-8000-000000000021'))->>'mode')='READY',
 'authorized admin may queue consented recipients');
select pg_temp.expect(
 (select count(*)=1 from public.sms_outbox
 where recipient_staff_id='a1000000-0000-4000-8000-000000000001'
 and status='QUEUED'),
 'one outgoing message for opted-in administrator');
select public.sms_request_payment((select id from public.finance_payments
 where request_key='a6000000-0000-4000-8000-000000000021'));
select pg_temp.expect((select count(*)=1 from public.sms_outbox),
 'repeated notify is idempotent per payment/recipient');
select pg_temp.expect((select count(*)=0 from public.sms_outbox where char_length(body)>160),
 'notification stays within one standard SMS segment');
select pg_temp.expect(
 (select count(*)=1 from public.sms_outbox o
   join public.finance_payments p on p.id=o.payment_id
   join public.students st on st.id=p.student_id
   where o.body like '%'||st.first_name||' '||st.last_name||' via Cash.%'),
 'queued SMS includes the actual student name and payment method');
select pg_temp.expect(
 (select count(*)=1 from public.sms_outbox o
   join public.finance_payments p on p.id=o.payment_id
   where o.body like '%'||p.receipt_number||'%'),
 'queued SMS keeps payment receipt reference');

-- Scope isolation is still enforced after enabling the provider mode.
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.denied($q$select public.sms_request_payment(
 (select id from public.finance_payments where request_key=
 'a6000000-0000-4000-8000-000000000021')$q$,
 'cross-school SMS request remains blocked after activation');

-- Message formatter regressions are pure SQL and spend no SMS credits.
reset role;
select pg_temp.expect(
 private.sms_payment_body('Akosua Boateng',2000,'CASH','ER-20261027-653353BA13')
   like '%Akosua Boateng via Cash. Receipt ER-20261027-653353BA13%',
 'student full name, Cash and full receipt shown');
select pg_temp.expect(
 private.sms_payment_body('Ama Owusu',95,'MOMO','ER-123')
   like '%Ama Owusu via Mobile Money%',
 'Mobile Money mode shown in SMS');
select pg_temp.expect(
 private.sms_payment_body('Kwame Mensah',250,'BANK','ER-124')
   like '%Kwame Mensah via Bank Transfer%',
 'Bank Transfer mode shown in SMS');
select pg_temp.expect(
 char_length(private.sms_payment_body(repeat('Adwoa ',30),9999,'BANK','ER-20261027-653353BA13'))<=160,
 'long student names stay inside the SMS length limit');
select pg_temp.expect(
 private.sms_payment_body('Àkósüa BoaÑeng',2000,'CASH','ER-123')
   like '%Akosua BoaNeng%',
 'common accented names transliterate to single-segment SMS');

-- One optional extra number per payment; school Administrator consent and
-- authorization are enforced in the database, even with RLS bypassed by RPC.
reset role;
update public.sms_central_settings
  set global_daily_limit=20,school_daily_limit=5,sending_enabled=true where singleton=true;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.expect(
  (public.sms_request_payment_extra(
    (select id from public.finance_payments
      where request_key='a6000000-0000-4000-8000-000000000021'),
    '0249998888',true,'Guardian authorized payment updates')->>'custom_queued')='true',
  'admin may queue one consented custom recipient for own-school payment');
select pg_temp.expect((select count(*)=1 from public.sms_outbox
  where recipient_kind='CUSTOM' and recipient_staff_id is null
    and phone_e164='+233249998888' and consent_confirmed_at is not null
    and recipient_reason='Guardian authorized payment updates'),
  'custom SMS stores phone, explicit consent time and audit reason');
select pg_temp.expect((select count(*)=2 from public.sms_outbox),
  'normal opted-in staff and one custom recipient queued');
select pg_temp.expect((select count(*)=0 from public.sms_outbox where char_length(body)>160),
  'custom SMS also stays within a 160-character segment');
select pg_temp.expect(
  (public.sms_request_payment_extra(
    (select id from public.finance_payments
      where request_key='a6000000-0000-4000-8000-000000000021'),
    '0249998888',true,'Guardian authorized payment updates')->>'custom_queued')='false',
  'repeat request does not create duplicate custom SMS');
select pg_temp.expect((select count(*)=2 from public.sms_outbox),
  'repeat custom notification remains idempotent');

select pg_temp.denied($q$select public.sms_request_payment_extra(
  (select id from public.finance_payments
    where request_key='a6000000-0000-4000-8000-000000000021'),
  '0248765432',false,'Guardian authorized payment updates')$q$,
  'custom SMS cannot be queued without consent attestation');
select pg_temp.denied($q$select public.sms_request_payment_extra(
  (select id from public.finance_payments
    where request_key='a6000000-0000-4000-8000-000000000021'),
  '0247654321',true,'Guardian authorized payment updates')$q$,
  'admin cannot bypass staff opt-in using the custom field');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.denied($q$select public.sms_request_payment_extra(
  (select id from public.finance_payments
    where request_key='a6000000-0000-4000-8000-000000000021'),
  '0248765432',true,'Guardian authorized payment updates')$q$,
  'accountant cannot add arbitrary custom recipient');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.denied($q$select public.sms_request_payment_extra(
  (select id from public.finance_payments
    where request_key='a6000000-0000-4000-8000-000000000021'),
  '0248765432',true,'Guardian authorized payment updates')$q$,
  'cross-school accountant cannot add custom recipient');

-- The previous actor was another school's accountant; reset to the test
-- owner before checking the physical outbox, otherwise RLS hides both rows.
reset role;
select pg_temp.expect((select count(*)=2 from public.sms_outbox where credits_verified=false),
  'credit verification flag distinguishes provider-confirmed from estimated usage');

rollback;
