-- Extend the existing pilot schema without deleting school records.
-- Private helpers make membership checks non-recursive. They always check auth.uid().
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter table public.school_users add column if not exists active boolean not null default true;
alter table public.school_users add column if not exists must_change_password boolean not null default false;
alter table public.school_users add column if not exists phone text;
alter table public.school_users add constraint school_users_auth_fk foreign key (auth_user_id) references auth.users(id) on delete cascade;
alter table public.school_users add constraint staff_school_unique unique(id,school_id);
alter table public.classes add constraint class_school_unique unique(id,school_id);
alter table public.students add constraint student_school_unique unique(id,school_id);
alter table public.subjects add constraint subject_school_unique unique(id,school_id);
alter table public.subjects add column if not exists active boolean not null default true;
alter table public.classes add constraint teacher_same_school foreign key(class_teacher_id,school_id) references public.school_users(id,school_id);
alter table public.students add constraint class_same_school foreign key(class_id,school_id) references public.classes(id,school_id);
alter table public.schools add constraint valid_weights check(sba_weight>=0 and exam_weight>=0 and sba_weight+exam_weight=100);
alter table public.schools add constraint valid_year check(academic_year ~ '^[0-9]{4}/[0-9]{4}$');
create unique index classes_unique_name on public.classes(school_id,lower(name));
create unique index students_unique_admission_ci on public.students(school_id,lower(admission_number));
create unique index staff_email_school on public.school_users(school_id,lower(email));

create table public.class_subjects (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null, subject_id uuid not null, teacher_id uuid,
 unique(class_id,subject_id),
 foreign key(class_id,school_id) references public.classes(id,school_id),
 foreign key(subject_id,school_id) references public.subjects(id,school_id),
 foreign key(teacher_id,school_id) references public.school_users(id,school_id)
);
create table public.academic_terms (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 academic_year text not null check(academic_year ~ '^[0-9]{4}/[0-9]{4}$'), term smallint not null check(term between 1 and 3),
 status text not null default 'OPEN' check(status in ('OPEN','CLOSED')), closed_at timestamptz,
 unique(school_id,academic_year,term)
);
create unique index one_open_term_per_school on public.academic_terms(school_id) where status='OPEN';
insert into public.academic_terms(school_id,academic_year,term) select id,academic_year,current_term from public.schools on conflict do nothing;
create table public.report_archives (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 student_id uuid not null, class_id uuid not null, academic_year text not null, term smallint not null,
 snapshot jsonb not null, created_at timestamptz not null default now(), unique(student_id,academic_year,term)
);
create table public.platform_operators (auth_user_id uuid primary key references auth.users(id) on delete cascade);
create table public.school_requests (
 id uuid primary key default gen_random_uuid(), kind text not null default 'ACCESS' check(kind in ('ACCESS','CONTACT')),
 school_name text not null check(length(trim(school_name)) between 2 and 150), contact_name text not null check(length(trim(contact_name)) between 2 and 120),
 email text not null check(length(email)<255 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text not null default '' check(length(phone)<35), message text not null default '' check(length(message)<=2000),
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','DECLINED','RESOLVED')),
 school_id uuid references public.schools(id), created_at timestamptz not null default now()
);
create unique index pending_request_once on public.school_requests(lower(email),lower(school_name),kind) where status='PENDING';
create table public.public_statistics (
 id boolean primary key default true check(id), schools bigint not null default 0, classes bigint not null default 0,
 learners bigint not null default 0, updated_at timestamptz not null default now()
);
insert into public.public_statistics(id) values(true);
create table private.setup_tokens(token_hash text primary key, email text not null, expires_at timestamptz not null, consumed_at timestamptz);

create or replace function private.member_school() returns uuid language sql stable security definer set search_path='' as $$
 select school_id from public.school_users where auth_user_id=(select auth.uid()) and active and not must_change_password limit 1
$$;
create or replace function private.member_id() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.school_users where auth_user_id=(select auth.uid()) and active and not must_change_password limit 1
$$;
create or replace function private.member_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.school_users where auth_user_id=(select auth.uid()) and active and not must_change_password limit 1
$$;
create or replace function private.is_operator() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.platform_operators where auth_user_id=auth.uid())
$$;
create or replace function private.can_class(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.classes k where k.id=c and k.school_id=private.member_school() and
 (private.member_role() in ('ADMIN','HEADTEACHER') or k.class_teacher_id=private.member_id() or exists(select 1 from public.class_subjects a where a.class_id=c and a.teacher_id=private.member_id())))
$$;
create or replace function private.owns_class(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.classes k where k.id=c and k.school_id=private.member_school() and (private.member_role()='ADMIN' or k.class_teacher_id=private.member_id()))
$$;
create or replace function private.can_score(c uuid,s uuid,writing boolean) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.classes k where k.id=c and k.school_id=private.member_school() and
 (private.member_role()='ADMIN' or (not writing and private.member_role()='HEADTEACHER') or k.class_teacher_id=private.member_id() or exists(select 1 from public.class_subjects a where a.class_id=c and a.subject_id=s and a.teacher_id=private.member_id())))
$$;
create or replace function private.student_class(s uuid) returns uuid language sql stable security definer set search_path='' as $$
 select class_id from public.students where id=s and school_id=private.member_school() and auth.uid() is not null
$$;
create or replace function private.term_open(s uuid,y text,t smallint) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and s=private.member_school() and exists(select 1 from public.academic_terms where school_id=s and academic_year=y and term=t and status='OPEN')
$$;

-- Retire the initial school-wide policies. No authenticated role receives broad writes.
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('schools','school_users','classes','subjects','students','scores','attendance','affective_records','remarks') loop
 execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
do $$ declare t text; begin
 foreach t in array array['schools','school_users','classes','subjects','students','scores','attendance','affective_records','remarks','class_subjects','academic_terms','report_archives','platform_operators','school_requests','public_statistics'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.schools,public.school_users,public.classes,public.subjects,public.students,public.scores,public.attendance,public.affective_records,public.remarks,public.class_subjects,public.academic_terms,public.report_archives,public.platform_operators,public.school_requests to authenticated;
grant insert,update,delete on public.classes,public.subjects,public.students,public.scores,public.attendance,public.affective_records,public.remarks,public.class_subjects to authenticated;
grant update(name,address,phone,email,headteacher_name,district,region,sba_weight,exam_weight) on public.schools to authenticated;
grant select on public.public_statistics to anon,authenticated;
-- Public submissions are handled by a bounded Edge endpoint. Anonymous users cannot query or directly insert requests.
create policy own_school_read on public.schools for select to authenticated using(id=(select private.member_school()));
create policy admin_school_update on public.schools for update to authenticated using(id=(select private.member_school()) and (select private.member_role())='ADMIN') with check(id=(select private.member_school()));
create policy staff_read on public.school_users for select to authenticated using(auth_user_id=(select auth.uid()) or (school_id=(select private.member_school()) and (select private.member_role()) in ('ADMIN','HEADTEACHER')));
create policy class_read on public.classes for select to authenticated using(private.can_class(id));
create policy class_admin on public.classes for all to authenticated using(school_id=(select private.member_school()) and (select private.member_role())='ADMIN') with check(school_id=(select private.member_school()) and (select private.member_role())='ADMIN');
create policy subjects_read on public.subjects for select to authenticated using(school_id=(select private.member_school()));
create policy subjects_admin on public.subjects for all to authenticated using(school_id=(select private.member_school()) and (select private.member_role())='ADMIN') with check(school_id=(select private.member_school()) and (select private.member_role())='ADMIN');
create policy assignment_read on public.class_subjects for select to authenticated using(school_id=(select private.member_school()) and private.can_class(class_id));
create policy assignment_admin on public.class_subjects for all to authenticated using(school_id=(select private.member_school()) and (select private.member_role())='ADMIN') with check(school_id=(select private.member_school()) and (select private.member_role())='ADMIN');
create policy students_read on public.students for select to authenticated using(school_id=(select private.member_school()) and private.can_class(class_id));
create policy students_admin on public.students for all to authenticated using(school_id=(select private.member_school()) and (select private.member_role())='ADMIN') with check(school_id=(select private.member_school()) and (select private.member_role())='ADMIN');
create policy scores_read on public.scores for select to authenticated using(school_id=(select private.member_school()) and private.can_score(class_id,subject_id,false));
create policy scores_write on public.scores for all to authenticated using(school_id=(select private.member_school()) and private.can_score(class_id,subject_id,true) and private.term_open(school_id,academic_year,term)) with check(school_id=(select private.member_school()) and private.can_score(class_id,subject_id,true) and private.term_open(school_id,academic_year,term));
create policy attendance_read on public.attendance for select to authenticated using(school_id=(select private.member_school()) and ((select private.member_role()) in ('ADMIN','HEADTEACHER') or private.owns_class(private.student_class(student_id))));
create policy attendance_write on public.attendance for all to authenticated using(school_id=(select private.member_school()) and private.owns_class(private.student_class(student_id)) and private.term_open(school_id,academic_year,term)) with check(school_id=(select private.member_school()) and private.owns_class(private.student_class(student_id)) and private.term_open(school_id,academic_year,term));
create policy affective_read on public.affective_records for select to authenticated using(school_id=(select private.member_school()) and ((select private.member_role()) in ('ADMIN','HEADTEACHER') or private.owns_class(private.student_class(student_id))));
create policy affective_write on public.affective_records for all to authenticated using(school_id=(select private.member_school()) and private.owns_class(private.student_class(student_id)) and private.term_open(school_id,academic_year,term)) with check(school_id=(select private.member_school()) and private.owns_class(private.student_class(student_id)) and private.term_open(school_id,academic_year,term));
create policy remarks_read on public.remarks for select to authenticated using(school_id=(select private.member_school()) and ((select private.member_role()) in ('ADMIN','HEADTEACHER') or private.owns_class(private.student_class(student_id))));
create policy remarks_write on public.remarks for all to authenticated using(school_id=(select private.member_school()) and ((select private.member_role()) in ('ADMIN','HEADTEACHER') or private.owns_class(private.student_class(student_id))) and private.term_open(school_id,academic_year,term)) with check(school_id=(select private.member_school()) and ((select private.member_role()) in ('ADMIN','HEADTEACHER') or private.owns_class(private.student_class(student_id))) and private.term_open(school_id,academic_year,term));
create policy terms_read on public.academic_terms for select to authenticated using(school_id=(select private.member_school()));
create policy archives_read on public.report_archives for select to authenticated using(school_id=(select private.member_school()) and ((select private.member_role()) in ('ADMIN','HEADTEACHER') or private.owns_class(class_id)));
create policy operator_self on public.platform_operators for select to authenticated using(auth_user_id=(select auth.uid()));
create policy requests_operator on public.school_requests for select to authenticated using((select private.is_operator()));
create policy public_totals on public.public_statistics for select to anon,authenticated using(true);

-- Validate writes independently of the UI, including requests sent directly to the API.
create or replace function private.validate_record() returns trigger language plpgsql security definer set search_path='' as $$
declare rowdata jsonb; s uuid; y text; t smallint; st public.students; term_status text; role_name text; cls public.classes; sb numeric; ex numeric;
begin
 rowdata=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 s=(rowdata->>'school_id')::uuid;
 if TG_TABLE_NAME in ('scores','attendance','affective_records','remarks') then
  y=rowdata->>'academic_year'; t=(rowdata->>'term')::smallint;
  select status into term_status from public.academic_terms where school_id=s and academic_year=y and term=t for share;
  if term_status is distinct from 'OPEN' then raise exception 'This term is closed or has not been opened.'; end if;
  select * into st from public.students where id=(rowdata->>'student_id')::uuid;
  if st.school_id is distinct from s then raise exception 'Student must belong to this school.'; end if;
  if TG_OP='UPDATE' and (OLD.school_id,OLD.student_id,OLD.academic_year,OLD.term) is distinct from (NEW.school_id,NEW.student_id,NEW.academic_year,NEW.term) then raise exception 'Record identity cannot be changed.'; end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 if TG_TABLE_NAME='scores' then
  if NEW.class_id is distinct from st.class_id then raise exception 'Student is not in this class.'; end if;
  if not exists(select 1 from public.class_subjects a join public.subjects sub on sub.id=a.subject_id where a.class_id=NEW.class_id and a.subject_id=NEW.subject_id and a.school_id=s and sub.active) then raise exception 'Subject is not offered by this class.'; end if;
  if NEW.sba_raw is null or NEW.exam_raw is null or NEW.sba_raw<0 or NEW.sba_raw>100 or NEW.exam_raw<0 or NEW.exam_raw>100 then raise exception 'Both raw scores must be between 0 and 100.'; end if;
  select sba_weight,exam_weight into sb,ex from public.schools where id=s;
  NEW.sba_scaled=round(NEW.sba_raw*sb/100,2); NEW.exam_scaled=round(NEW.exam_raw*ex/100,2); NEW.total=NEW.sba_scaled+NEW.exam_scaled;
  NEW.grade=case when NEW.total>=80 then 'A' when NEW.total>=70 then 'B' when NEW.total>=60 then 'C' when NEW.total>=50 then 'D' when NEW.total>=40 then 'E' else 'F' end;
 elsif TG_TABLE_NAME='attendance' then
  if NEW.total_days<0 or NEW.total_days>366 or NEW.days_present<0 or NEW.days_present>NEW.total_days then raise exception 'Attendance must be between 0 and total school days.'; end if;
 elsif TG_TABLE_NAME='remarks' and auth.uid() is not null then
  role_name=private.member_role();
  if TG_OP='INSERT' then
   if role_name not in ('ADMIN','HEADTEACHER') and coalesce(NEW.headteacher_remark,'')<>'' then raise exception 'Only the headmaster or administrator can write headmaster remarks.'; end if;
   if role_name='HEADTEACHER' and not private.owns_class(st.class_id) and coalesce(NEW.class_teacher_remark,'')<>'' then raise exception 'Class teacher remarks are managed by the assigned teacher.'; end if;
  else
   if role_name not in ('ADMIN','HEADTEACHER') and NEW.headteacher_remark is distinct from OLD.headteacher_remark then raise exception 'Headmaster remarks are protected.'; end if;
   if role_name='HEADTEACHER' and not private.owns_class(st.class_id) and NEW.class_teacher_remark is distinct from OLD.class_teacher_remark then raise exception 'Class teacher remarks are protected.'; end if;
  end if;
 elsif TG_TABLE_NAME='class_subjects' then
  select * into cls from public.classes where id=NEW.class_id;
  if not exists(select 1 from public.subjects where id=NEW.subject_id and school_id=NEW.school_id and (level='ALL' or level=cls.level)) then raise exception 'Subject level must match the class level.'; end if;
 end if;
 return NEW;
end $$;
do $$ declare t text; begin
 foreach t in array array['scores','attendance','affective_records','remarks','class_subjects'] loop
 execute format('create trigger validate_write before insert or update or delete on public.%I for each row execute function private.validate_record()',t);
 end loop;
end $$;
create or replace function private.school_settings_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if (NEW.sba_weight,NEW.exam_weight) is distinct from (OLD.sba_weight,OLD.exam_weight) and exists(select 1 from public.scores where school_id=OLD.id and academic_year=OLD.academic_year and term=OLD.current_term) then raise exception 'Weights are locked after marks are entered. Change them before entering marks in the next term.'; end if;
 return NEW;
end $$;
create trigger protect_weights before update on public.schools for each row execute function private.school_settings_guard();
create or replace function private.refresh_statistics() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.public_statistics set schools=(select count(*) from public.schools), classes=(select count(*) from public.classes), learners=(select count(*) from public.students where status='ACTIVE'),updated_at=now() where id;
 return null;
end $$;
create trigger school_totals after insert or update or delete on public.schools for each statement execute function private.refresh_statistics();
create trigger class_totals after insert or update or delete on public.classes for each statement execute function private.refresh_statistics();
create trigger student_totals after insert or update or delete on public.students for each statement execute function private.refresh_statistics();

-- Only authenticated school leaders may start/close terms. Snapshots are immutable to application users.
create or replace function private.close_term() returns integer language plpgsql security definer set search_path='' as $$
declare s public.schools; a public.academic_terms; n integer;
begin
 if auth.uid() is null or coalesce(private.member_role(),'') not in ('ADMIN','HEADTEACHER') then raise exception 'School leadership access required.'; end if;
 select * into s from public.schools where id=private.member_school() for update;
 select * into a from public.academic_terms where school_id=s.id and academic_year=s.academic_year and term=s.current_term for update;
 if a.status is distinct from 'OPEN' then raise exception 'There is no open term to close.'; end if;
 insert into public.report_archives(school_id,student_id,class_id,academic_year,term,snapshot)
 select s.id,st.id,st.class_id,s.academic_year,s.current_term,jsonb_build_object(
  'school',to_jsonb(s),'student',to_jsonb(st),'class',to_jsonb(c),
  'subjects',coalesce((select jsonb_agg(to_jsonb(sub)) from public.subjects sub where sub.school_id=s.id),'[]'::jsonb),
  'scores',coalesce((select jsonb_agg(to_jsonb(sc)) from public.scores sc where sc.student_id=st.id and sc.academic_year=s.academic_year and sc.term=s.current_term),'[]'::jsonb),
  'attendance',(select to_jsonb(att) from public.attendance att where att.student_id=st.id and att.academic_year=s.academic_year and att.term=s.current_term),
  'affective',(select to_jsonb(af) from public.affective_records af where af.student_id=st.id and af.academic_year=s.academic_year and af.term=s.current_term),
  'remarks',(select to_jsonb(r) from public.remarks r where r.student_id=st.id and r.academic_year=s.academic_year and r.term=s.current_term),
  'class_students',coalesce((select jsonb_agg(jsonb_build_object('id',st2.id)) from public.students st2 where st2.class_id=c.id and st2.status='ACTIVE'),'[]'::jsonb),
  'class_scores',coalesce((select jsonb_agg(to_jsonb(sc2)) from public.scores sc2 where sc2.class_id=c.id and sc2.academic_year=s.academic_year and sc2.term=s.current_term),'[]'::jsonb)
 ) from public.students st join public.classes c on c.id=st.class_id where st.school_id=s.id and st.status='ACTIVE';
 get diagnostics n=row_count;
 update public.academic_terms set status='CLOSED',closed_at=now() where id=a.id;
 return n;
end $$;
create or replace function public.close_current_term() returns integer language sql security invoker set search_path='' as $$select private.close_term()$$;
create or replace function private.open_term(y text,t smallint) returns void language plpgsql security definer set search_path='' as $$
declare s uuid;
begin
 if auth.uid() is null or coalesce(private.member_role(),'') not in ('ADMIN','HEADTEACHER') then raise exception 'School leadership access required.'; end if;
 if y !~ '^[0-9]{4}/[0-9]{4}$' or split_part(y,'/',2)::int<>split_part(y,'/',1)::int+1 or t not between 1 and 3 then raise exception 'Enter a valid academic year and term.'; end if;
 s=private.member_school(); perform 1 from public.schools where id=s for update;
 if exists(select 1 from public.academic_terms where school_id=s and status='OPEN') then raise exception 'Close the current term first.'; end if;
 insert into public.academic_terms(school_id,academic_year,term) values(s,y,t);
 update public.schools set academic_year=y,current_term=t where id=s;
 update public.classes set academic_year=y where school_id=s;
end $$;
create or replace function public.start_new_term(academic_year text,term smallint) returns void language sql security invoker set search_path='' as $$select private.open_term(academic_year,term)$$;

-- Service-only, one-use bootstrap. The secret is created out of band, expires, and never enters source control.
create or replace function public.consume_setup_token(hash text) returns text language plpgsql security definer set search_path='' as $$
declare target text; begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' and coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'Service access required.'; end if;
 update private.setup_tokens set consumed_at=now() where token_hash=hash and consumed_at is null and expires_at>now() returning email into target;
 return target;
end $$;
revoke all on function public.consume_setup_token(text) from public,anon,authenticated;
grant execute on function public.consume_setup_token(text) to service_role;

-- All private functions lose Postgres's default PUBLIC execute privilege.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.member_school(),private.member_id(),private.member_role(),private.is_operator(),private.can_class(uuid),private.owns_class(uuid),private.can_score(uuid,uuid,boolean),private.student_class(uuid),private.term_open(uuid,text,smallint),private.close_term(),private.open_term(text,smallint) to authenticated;
revoke all on function public.close_current_term(),public.start_new_term(text,smallint) from public,anon;
grant execute on function public.close_current_term(),public.start_new_term(text,smallint) to authenticated;
-- Remove the obsolete permissive helper from the initial prototype.
drop function if exists public.current_school_id();

create index school_users_school on public.school_users(school_id);
create index classes_teacher on public.classes(class_teacher_id);
create index students_school_class on public.students(school_id,class_id);
create index assignments_teacher on public.class_subjects(teacher_id,class_id);
create index assignments_subject on public.class_subjects(subject_id);
create index scores_school_term on public.scores(school_id,academic_year,term,class_id,subject_id);
create index attendance_school on public.attendance(school_id);
create index affective_school on public.affective_records(school_id);
create index remarks_school on public.remarks(school_id);
create index archives_school_term on public.report_archives(school_id,academic_year,term,class_id);
create index subjects_school on public.subjects(school_id);
revoke delete on public.remarks from authenticated;
create or replace function private.protect_last_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if OLD.role='ADMIN' and OLD.active and (TG_OP='DELETE' or not NEW.active or NEW.role<>'ADMIN') then
  perform 1 from public.schools where id=OLD.school_id for update;
  if found and not exists(select 1 from public.school_users where school_id=OLD.school_id and id<>OLD.id and role='ADMIN' and active) then raise exception 'Keep at least one active school administrator.'; end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 if NEW.school_id<>OLD.school_id or NEW.auth_user_id<>OLD.auth_user_id then raise exception 'Staff membership cannot be moved to another school or login.'; end if;
 return NEW;
end $$;
create trigger keep_school_admin before update or delete on public.school_users for each row execute function private.protect_last_admin();
-- Anonymous intake is insert-only, bounded and never grants school access.
grant insert(kind,school_name,contact_name,email,phone,message) on public.school_requests to anon,authenticated;
create policy public_request_insert on public.school_requests for insert to anon,authenticated with check(status='PENDING' and school_id is null);
create or replace function private.limit_school_requests() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(19620260927);
 NEW.email=lower(trim(NEW.email));
 if (select count(*) from public.school_requests where created_at>now()-interval '1 hour')>=50 or (select count(*) from public.school_requests where lower(email)=NEW.email and created_at>now()-interval '1 day')>=3 then raise exception 'Request limit reached. Please try again later.'; end if;
 return NEW;
end $$;
create trigger request_rate_limit before insert on public.school_requests for each row execute function private.limit_school_requests();
revoke all on function private.protect_last_admin(),private.limit_school_requests() from public,anon,authenticated;
notify pgrst, 'reload schema';
