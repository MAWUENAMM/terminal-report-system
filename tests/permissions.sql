-- Run with a database administrator on the configured Supabase project.
-- All fixtures and assertions run in one transaction and are rolled back.
begin;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
create function pg_temp.denied(command text, label text) returns void language plpgsql as $$
begin
 begin execute command; exception when others then return; end;
 raise exception 'FAILED: unexpected permission for %',label;
end $$;

insert into public.schools(id,name) values
 ('f1000000-0000-4000-8000-000000000001','Permission test A'),
 ('f1000000-0000-4000-8000-000000000002','Permission test B');
insert into auth.users(id,email) select ('f2000000-0000-4000-8000-00000000000'||n)::uuid,'permission-'||n||'@example.invalid' from generate_series(1,5)n;
insert into public.school_users(id,auth_user_id,school_id,full_name,email,role)
select ('f2000000-0000-4000-8000-00000000000'||n)::uuid,('f2000000-0000-4000-8000-00000000000'||n)::uuid,
 case when n=5 then 'f1000000-0000-4000-8000-000000000002'::uuid else 'f1000000-0000-4000-8000-000000000001'::uuid end,
 'Permission test','permission-'||n||'@example.invalid',case n when 1 then 'ADMIN' when 2 then 'HEADTEACHER' when 3 then 'CLASS_TEACHER' when 4 then 'SUBJECT_TEACHER' else 'ADMIN' end
from generate_series(1,5)n;
insert into public.classes(id,school_id,name,level,academic_year,class_teacher_id) values
 ('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Primary 1','PRIMARY','2026/2027','f2000000-0000-4000-8000-000000000003'),
 ('f3000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','Primary 2','PRIMARY','2026/2027',null),
 ('f3000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000002','Other school','PRIMARY','2026/2027',null);
insert into public.subjects(id,school_id,name) values
 ('f4000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Maths'),
 ('f4000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','English'),
 ('f4000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000002','Other school maths');
insert into public.class_subjects(school_id,class_id,subject_id,teacher_id) values
 ('f1000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000004'),
 ('f1000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000002',null);
insert into public.students(id,school_id,admission_number,first_name,last_name,gender,class_id) values
 ('f5000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','TEST001','Assigned','Learner','F','f3000000-0000-4000-8000-000000000001'),
 ('f5000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','TEST002','Unassigned','Learner','M','f3000000-0000-4000-8000-000000000002'),
 ('f5000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000002','TEST003','Other school','Learner','F','f3000000-0000-4000-8000-000000000003');
insert into public.academic_terms(id,school_id,academic_year,term) values
 ('f6000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','2026/2027',1),
 ('f6000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','2026/2027',1);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.check_true((select count(*)=1 from public.classes),'class teacher reads assigned class only');
select pg_temp.check_true((select count(*)=1 from public.students),'class teacher reads assigned learners only');
with changed as (update public.schools set name='Forbidden' returning id) select pg_temp.check_true(count(*)=0,'class teacher cannot change school settings') from changed;
select pg_temp.denied($q$update public.school_users set role='ADMIN'$q$,'role escalation');
select pg_temp.denied($q$select public.close_current_term()$q$,'teacher closes term');
insert into public.scores(school_id,student_id,class_id,subject_id,academic_year,term,sba_raw,exam_raw,total,grade) values
 ('f1000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001','2026/2027',1,79,80,100,'A'),
 ('f1000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000002','2026/2027',1,65,70,100,'A');
select pg_temp.check_true((select total=79.5 and grade='B' from public.scores where subject_id='f4000000-0000-4000-8000-000000000001'),'server ignores forged totals and handles decimal grade');
select public.save_report_notes('f5000000-0000-4000-8000-000000000001','{"days_present":55,"total_days":60,"class_teacher_remark":"Good progress"}');
select pg_temp.denied($q$select public.save_report_notes('f5000000-0000-4000-8000-000000000001','{"headteacher_remark":"Forged headmaster"}')$q$,'teacher cannot write headmaster remarks');
select pg_temp.denied($q$select public.save_report_notes('f5000000-0000-4000-8000-000000000002','{"days_present":55,"total_days":60}')$q$,'teacher cannot edit other class attendance');
select pg_temp.denied($q$select public.save_report_notes('f5000000-0000-4000-8000-000000000001','{"days_present":61,"total_days":60}')$q$,'invalid attendance rejected');

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.check_true((select count(*)=1 from public.scores),'subject teacher reads assigned subject only');
with changed as(update public.scores set sba_raw=82 returning id) select pg_temp.check_true(count(*)=1,'subject teacher writes assigned subject') from changed;
with changed as(update public.scores set sba_raw=82 where subject_id='f4000000-0000-4000-8000-000000000002' returning id) select pg_temp.check_true(count(*)=0,'subject teacher blocked from other subject') from changed;
select pg_temp.denied($q$select public.save_report_notes('f5000000-0000-4000-8000-000000000001','{"days_present":50,"total_days":60}')$q$,'subject teacher cannot edit attendance');

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.check_true((select count(*)=2 from public.students),'headmaster reads whole own school');

-- Headmasters manage school enrolment, while other-school data/settings/staff stay protected.
insert into public.classes(id,school_id,name,level,academic_year) values
 ('f3000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000001','New class','PRIMARY','2026/2027');
insert into public.students(id,school_id,admission_number,first_name,last_name,gender,class_id) values
 ('f5000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000001','TEST004','New','Learner','F','f3000000-0000-4000-8000-000000000004');
with changed as(update public.classes set name='Edited class' where id='f3000000-0000-4000-8000-000000000004' returning id) select pg_temp.check_true(count(*)=1,'headmaster edits class') from changed;
with changed as(update public.students set first_name='Edited',status='WITHDRAWN' where id='f5000000-0000-4000-8000-000000000004' returning id) select pg_temp.check_true(count(*)=1,'headmaster edits and withdraws learner') from changed;
with changed as(update public.students set status='ACTIVE' where id='f5000000-0000-4000-8000-000000000004' returning id) select pg_temp.check_true(count(*)=1,'headmaster restores learner') from changed;
select pg_temp.denied($q$delete from public.classes where id='f3000000-0000-4000-8000-000000000004'$q$,'occupied class cannot be deleted');
with changed as(delete from public.students where id='f5000000-0000-4000-8000-000000000004' returning id) select pg_temp.check_true(count(*)=1,'headmaster deletes unused learner') from changed;
with changed as(delete from public.classes where id='f3000000-0000-4000-8000-000000000004' returning id) select pg_temp.check_true(count(*)=1,'headmaster deletes unused class') from changed;
select pg_temp.denied($q$delete from public.students where id='f5000000-0000-4000-8000-000000000001'$q$,'learner assessment history prevents deletion');
with changed as(update public.classes set name='Forbidden' where school_id='f1000000-0000-4000-8000-000000000002' returning id) select pg_temp.check_true(count(*)=0,'headmaster cannot edit other school class') from changed;
with changed as(delete from public.students where school_id='f1000000-0000-4000-8000-000000000002' returning id) select pg_temp.check_true(count(*)=0,'headmaster cannot delete other school learners') from changed;
select pg_temp.denied($q$insert into public.classes(school_id,name,level,academic_year) values('f1000000-0000-4000-8000-000000000002','Intrusion','PRIMARY','2026/2027')$q$,'headmaster cannot create other school class');
with changed as(update public.schools set name='Forbidden' returning id) select pg_temp.check_true(count(*)=0,'headmaster cannot edit school settings') from changed;
select pg_temp.denied($q$update public.school_users set role='ADMIN'$q$,'headmaster cannot grant roles');

with changed as(update public.scores set sba_raw=0 returning id) select pg_temp.check_true(count(*)=0,'headmaster cannot alter teacher marks') from changed;
select public.save_report_notes('f5000000-0000-4000-8000-000000000001','{"headteacher_remark":"Well done"}');
select pg_temp.check_true((select class_teacher_remark='Good progress' and headteacher_remark='Well done' from public.remarks),'headmaster preserves teacher remark');
select pg_temp.denied($q$select public.save_report_notes('f5000000-0000-4000-8000-000000000001','{"class_teacher_remark":"Forged class teacher"}')$q$,'headmaster cannot change class teacher remark');

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.check_true((select count(*)=1 from public.schools),'administrator cannot read other school');
with changed as(update public.schools set name='Other school write' where id='f1000000-0000-4000-8000-000000000002' returning id) select pg_temp.check_true(count(*)=0,'administrator cannot update other school') from changed;
select pg_temp.denied($q$update public.schools set sba_weight=40,exam_weight=60$q$,'grading weights locked after scores');
select pg_temp.denied($q$update public.students set class_id='f3000000-0000-4000-8000-000000000002' where id='f5000000-0000-4000-8000-000000000001'$q$,'learner movement with current marks blocked');
select pg_temp.check_true(public.close_current_term()=2,'term close archives active learners');
select pg_temp.check_true((select count(*)=2 from public.report_archives),'archives created');

select pg_temp.denied($q$delete from public.students where id='f5000000-0000-4000-8000-000000000002'$q$,'archive-only learner cannot be deleted');
select pg_temp.check_true((select count(*)=1 from public.term_events where action='CLOSED'),'term closure records actor');
select pg_temp.denied($q$insert into public.term_events(school_id,term_id,action,actor_name,archive_revision) values('f1000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000001','REOPENED','Forged actor',1)$q$,'term history cannot be forged');
select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.denied($q$select public.reopen_term('f6000000-0000-4000-8000-000000000001','Accidental closure')$q$,'teacher cannot reopen term');
with changed as(delete from public.students returning id) select pg_temp.check_true(count(*)=0,'teacher cannot delete learners') from changed;
select pg_temp.denied($q$insert into public.classes(school_id,name,level,academic_year) values('f1000000-0000-4000-8000-000000000001','Forbidden','PRIMARY','2026/2027')$q$,'teacher cannot create classes');
select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.denied($q$select public.reopen_term('f6000000-0000-4000-8000-000000000002','Other school term')$q$,'headmaster cannot reopen another school term');
select pg_temp.denied($q$select public.reopen_term('f6000000-0000-4000-8000-000000000001','  ')$q$,'reopening requires explanation');
select pg_temp.denied($q$select public.reopen_term('f6000000-0000-4000-8000-000000000001',null)$q$,'null reopening reason rejected');
update public.students set class_id='f3000000-0000-4000-8000-000000000002' where id='f5000000-0000-4000-8000-000000000001';
select pg_temp.denied($q$select public.reopen_term('f6000000-0000-4000-8000-000000000001','Accidental closure')$q$,'changed learner placement blocks reopening');
update public.students set class_id='f3000000-0000-4000-8000-000000000001' where id='f5000000-0000-4000-8000-000000000001';
select public.reopen_term('f6000000-0000-4000-8000-000000000001','Term closed accidentally');
select pg_temp.check_true((select status='OPEN' and closed_at is null and archive_revision=1 from public.academic_terms where id='f6000000-0000-4000-8000-000000000001'),'headmaster reopens current closed term');
select pg_temp.check_true((select count(*)=2 from public.report_archives where revision=1),'reopening keeps old reports');
select pg_temp.check_true((select count(*)=1 from public.term_events where action='REOPENED' and reason='Term closed accidentally'),'reopen reason retained');
select pg_temp.denied($q$select public.reopen_term('f6000000-0000-4000-8000-000000000001','Duplicate reopen')$q$,'already open term rejected');
select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
with changed as(update public.scores set sba_raw=83 where subject_id='f4000000-0000-4000-8000-000000000001' returning id) select pg_temp.check_true(count(*)=1,'reopening restores score editing') from changed;
select pg_temp.check_true(public.close_current_term()=2,'reclosing archives all active learners');
select pg_temp.check_true((select count(*)=4 from public.report_archives),'reclosing adds report versions');
select pg_temp.check_true((select (sc->>'sba_raw')::numeric=82 from public.report_archives a cross join lateral jsonb_array_elements(a.snapshot->'scores') sc where a.student_id='f5000000-0000-4000-8000-000000000001' and a.revision=1 and sc->>'subject_id'='f4000000-0000-4000-8000-000000000001'),'original snapshot remains unchanged');
select pg_temp.check_true((select (sc->>'sba_raw')::numeric=83 from public.report_archives a cross join lateral jsonb_array_elements(a.snapshot->'scores') sc where a.student_id='f5000000-0000-4000-8000-000000000001' and a.revision=2 and sc->>'subject_id'='f4000000-0000-4000-8000-000000000001'),'new snapshot contains corrected scores');

select pg_temp.denied($q$update public.report_archives set snapshot='{}'$q$,'archives are immutable');
with changed as(update public.scores set sba_raw=0 returning id) select pg_temp.check_true(count(*)=0,'closed scores immutable') from changed;
select pg_temp.denied($q$select public.start_new_term('2025/2026',1::smallint)$q$,'cannot open a past term');
select public.start_new_term('2026/2027',2::smallint);
select pg_temp.check_true((select current_term=2 from public.schools),'new term becomes active');
select pg_temp.denied($q$select public.reopen_term('f6000000-0000-4000-8000-000000000001','Earlier term correction')$q$,'cannot reopen previous term when later term open');
update public.students set class_id='f3000000-0000-4000-8000-000000000001' where id='f5000000-0000-4000-8000-000000000002';
select pg_temp.denied($q$delete from public.classes where id='f3000000-0000-4000-8000-000000000002'$q$,'empty class with archived reports retained');
select public.close_current_term();
select pg_temp.denied($q$select public.reopen_term('f6000000-0000-4000-8000-000000000001','Earlier term correction')$q$,'cannot reopen previous term even after later term closes');
select pg_temp.check_true((select count(*)=2 from public.scores where term=1),'starting term preserves old marks');
select pg_temp.check_true((select count(*)=4 from public.report_archives where (snapshot->'school'->>'current_term')::int=1),'archived school term unchanged');

reset role;
update public.school_users set must_change_password=true where id='f2000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.check_true((select count(*)=0 from public.students),'temporary password cannot access learners');
reset role;
update public.school_users set must_change_password=false,active=false where id='f2000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.check_true((select count(*)=0 from public.students),'disabled account loses data access');
reset role;
set local role anon;
select pg_temp.denied($q$select public.reopen_term('f6000000-0000-4000-8000-000000000001','Anonymous request')$q$,'anonymous reopening denied');
select pg_temp.denied($q$select * from public.students$q$,'anonymous learner reads blocked');
select pg_temp.denied($q$select * from public.school_requests$q$,'anonymous school request reads blocked');
select pg_temp.check_true((select count(*)=1 from public.public_statistics),'anonymous aggregate totals available');
reset role;
select 'All permission, integrity and term lifecycle assertions passed; fixtures rolled back.' as result;
rollback;
