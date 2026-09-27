-- Run as database administrator. Fixtures and every mutation are rolled back.
begin;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
create function pg_temp.denied(command text, label text) returns void language plpgsql as $$
begin begin execute command; exception when others then return; end; raise exception 'FAILED: unexpected permission for %',label; end $$;
insert into public.schools(id,name,academic_year,current_term) values
 ('d1000000-0000-4000-8000-000000000001','Platform test owner','2026/2027',1),
 ('d1000000-0000-4000-8000-000000000002','Platform test tenant','2026/2027',1);
insert into auth.users(id,email) select ('d2000000-0000-4000-8000-00000000000'||n)::uuid,'platform-test-'||n||'@example.invalid' from generate_series(1,4)n;
insert into public.school_users(id,auth_user_id,school_id,full_name,email,role)
select ('d2000000-0000-4000-8000-00000000000'||n)::uuid,('d2000000-0000-4000-8000-00000000000'||n)::uuid,
 case when n=1 then 'd1000000-0000-4000-8000-000000000001'::uuid else 'd1000000-0000-4000-8000-000000000002'::uuid end,
 'Platform test','platform-test-'||n||'@example.invalid',case n when 3 then 'CLASS_TEACHER' else 'ADMIN' end from generate_series(1,3)n;
insert into public.platform_operators values('d2000000-0000-4000-8000-000000000001');
insert into public.classes(id,school_id,name,level,academic_year,class_teacher_id) values
 ('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','Primary 1','PRIMARY','2026/2027','d2000000-0000-4000-8000-000000000003');
insert into public.students(id,school_id,admission_number,first_name,last_name,gender,class_id) values
 ('d4000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','PL001','Test','Learner','F','d3000000-0000-4000-8000-000000000001');
insert into public.academic_terms(id,school_id,academic_year,term) values
 ('d5000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','2026/2027',1);
insert into public.school_requests(id,school_name,contact_name,email) values
 ('d6000000-0000-4000-8000-000000000001','Platform test new','New Administrator','platform-test-4@example.invalid');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.denied($q$select public.platform_schools()$q$,'ordinary admin cannot list schools');
select pg_temp.denied($q$select public.platform_update_school('d1000000-0000-4000-8000-000000000002','DEACTIVATE','{"reason":"Test suspension"}')$q$,'ordinary admin cannot deactivate school');
select pg_temp.denied($q$update public.schools set active=false$q$,'status columns cannot be written directly');
select pg_temp.denied($q$select public.platform_create_school('d2000000-0000-4000-8000-000000000004','New Administrator','platform-test-4@example.invalid','{"name":"Platform test new","academic_year":"2026/2027","current_term":1}',null)$q$,'ordinary admin cannot create schools');
select pg_temp.check_true((select count(*)=1 from public.students),'tenant initially has own learner access');
select pg_temp.check_true(public.close_current_term()=1,'tenant closes term and archives report');
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.denied($q$select public.platform_schools()$q$,'teacher cannot list schools');

select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.check_true((public.platform_schools('Platform test','ALL',0)->>'total')::integer=2,'operator sees existing schools');
select pg_temp.check_true((select count(*)=0 from public.students),'platform directory does not grant cross-school learner access');
select pg_temp.denied($q$select public.platform_update_school('d1000000-0000-4000-8000-000000000002','EDIT','{"name":"X"}')$q$,'invalid edit rejected');
select public.platform_update_school('d1000000-0000-4000-8000-000000000002','EDIT','{"name":"Platform test renamed","district":"Accra","email":"contact@example.invalid","active":false}');
select pg_temp.check_true(public.platform_schools('Accra','ACTIVE',0)->'items'->0->>'name'='Platform test renamed','edit and search work; forged status ignored');
select pg_temp.denied($q$select public.platform_update_school('d1000000-0000-4000-8000-000000000002','DEACTIVATE','{}')$q$,'deactivation requires reason');
select public.platform_update_school('d1000000-0000-4000-8000-000000000002','DEACTIVATE','{"reason":"Contract not yet active"}');
select pg_temp.check_true((public.platform_schools('Platform test renamed','INACTIVE',0)->>'total')::integer=1,'inactive filter');

-- Same auth identity/token, now suspended: reads and writes must both stop.
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.check_true((select count(*)=0 from public.students),'suspended admin cannot read learners');
select pg_temp.check_true((select count(*)=0 from public.report_archives),'suspended admin cannot read archived reports');
select pg_temp.check_true((select count(*)=0 from public.classes),'suspended admin cannot read classes');
select pg_temp.check_true((select count(*)=0 from public.academic_terms),'suspended admin cannot read terms');
select pg_temp.check_true((select count(*)=1 from public.school_users),'suspended admin reads only own profile');
select pg_temp.check_true((select not active from public.schools),'suspended user can identify school status');
with changed as(update public.schools set name='Forbidden' returning id) select pg_temp.check_true(count(*)=0,'suspended admin cannot edit settings') from changed;
select pg_temp.denied($q$insert into public.classes(school_id,name,level,academic_year) values('d1000000-0000-4000-8000-000000000002','Forbidden','PRIMARY','2026/2027')$q$,'suspended admin cannot add class');
select pg_temp.denied($q$select public.reopen_term('d5000000-0000-4000-8000-000000000001','Accidental closure')$q$,'suspended admin cannot reopen term');
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.check_true((select count(*)=0 from public.students),'suspended teacher loses assigned learner access');
select pg_temp.denied($q$select public.save_report_notes('d4000000-0000-4000-8000-000000000001','{"days_present":20,"total_days":30}')$q$,'suspended teacher cannot write notes');

select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.platform_update_school('d1000000-0000-4000-8000-000000000002','ACTIVATE','{}');
select pg_temp.denied($q$select public.platform_update_school('d1000000-0000-4000-8000-000000000002','DELETE','{"reason":"Test deletion","confirmation":"wrong"}')$q$,'delete requires exact school name');
select public.platform_update_school('d1000000-0000-4000-8000-000000000002','DELETE','{"reason":"Duplicate school entry","confirmation":"Platform test renamed"}');
select pg_temp.check_true((public.platform_schools('Platform test renamed','ALL',0)->>'total')::integer=0,'deleted school hidden from current directory');
select pg_temp.check_true((public.platform_schools('Platform test renamed','DELETED',0)->>'total')::integer=1,'deleted school recoverable in deleted filter');
select pg_temp.denied($q$select public.platform_update_school('d1000000-0000-4000-8000-000000000002','ACTIVATE','{}')$q$,'deleted school must be restored first');
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.check_true((select count(*)=0 from public.report_archives),'deleted school cannot read reports');
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.platform_update_school('d1000000-0000-4000-8000-000000000002','RESTORE','{}');
select pg_temp.check_true((public.platform_schools('Platform test renamed','INACTIVE',0)->>'total')::integer=1,'restoration does not automatically activate');
select public.platform_update_school('d1000000-0000-4000-8000-000000000002','ACTIVATE','{}');
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.check_true((select count(*)=1 from public.report_archives),'reactivation restores unchanged archived report');
select pg_temp.check_true((select count(*)=1 from public.students),'learner preserved across delete and restore');
select pg_temp.check_true((select count(*)=2 from public.school_users),'staff preserved across delete and restore');
select pg_temp.check_true((select count(*)=0 from public.school_events),'school admin cannot see platform audit');

-- Suspending/deleting the operator's tenant must not lock out platform administration.
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.platform_update_school('d1000000-0000-4000-8000-000000000001','DELETE','{"reason":"Owner tenant retirement","confirmation":"Platform test owner"}');
select pg_temp.check_true(private.is_operator(),'platform control independent of tenant activation');
select pg_temp.check_true(private.member_school() is null,'operator cannot access inactive tenant data');
select public.platform_update_school('d1000000-0000-4000-8000-000000000001','RESTORE','{}');
select public.platform_update_school('d1000000-0000-4000-8000-000000000001','ACTIVATE','{}');
select pg_temp.denied($q$select public.platform_create_school('d2000000-0000-4000-8000-000000000004','New Administrator','platform-test-4@example.invalid','{"name":"Platform test new","academic_year":"2026/2028","current_term":1}',null)$q$,'invalid academic year rolls back provisioning');
select public.platform_create_school('d2000000-0000-4000-8000-000000000004','New Administrator','platform-test-4@example.invalid','{"name":"Platform test new","academic_year":"2026/2027","current_term":2,"active":false}','d6000000-0000-4000-8000-000000000001');
select pg_temp.check_true((public.platform_schools('Platform test new','INACTIVE',0)->>'total')::integer=1,'school created with chosen initial status');
select pg_temp.check_true((select status='APPROVED' and school_id is not null from public.school_requests where id='d6000000-0000-4000-8000-000000000001'),'approval and provisioning atomic');
select pg_temp.denied($q$select public.platform_create_school('d2000000-0000-4000-8000-000000000004','New Administrator','platform-test-4@example.invalid','{"name":"Platform test duplicate","academic_year":"2026/2027","current_term":1}',null)$q$,'existing account cannot be reassigned');
select pg_temp.check_true((select count(*)=6 from public.school_events where school_id='d1000000-0000-4000-8000-000000000002'),'all successful changes audited');
select pg_temp.denied($q$delete from public.school_events$q$,'operator cannot erase audit history');
select pg_temp.denied($q$insert into public.school_events(school_id,actor_name,action) values('d1000000-0000-4000-8000-000000000002','Forged','DELETED')$q$,'audit history cannot be forged');
reset role;
select pg_temp.check_true((select must_change_password and role='ADMIN' from public.school_users where auth_user_id='d2000000-0000-4000-8000-000000000004'),'new administrator must change password');
select pg_temp.check_true((select term=2 from public.academic_terms where school_id=(select school_id from public.school_users where auth_user_id='d2000000-0000-4000-8000-000000000004')),'first academic term created');
select pg_temp.check_true((select schools=(select count(*) from public.schools where active and deleted_at is null) from public.public_statistics),'public totals include only active schools');
update public.school_users set must_change_password=true where auth_user_id='d2000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.denied($q$select public.platform_schools()$q$,'operator password setup enforced');
set local role anon;
select pg_temp.denied($q$select public.platform_schools()$q$,'anonymous cannot enumerate schools');
select 'Platform school permission checks passed' as result;
rollback;
