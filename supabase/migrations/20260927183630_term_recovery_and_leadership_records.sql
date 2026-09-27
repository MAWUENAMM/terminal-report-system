-- School leadership can manage enrolment without gaining staff/settings access.
alter policy class_admin on public.classes
  using (school_id=(select private.member_school()) and (select private.member_role()) in ('ADMIN','HEADTEACHER'))
  with check (school_id=(select private.member_school()) and (select private.member_role()) in ('ADMIN','HEADTEACHER'));
alter policy students_admin on public.students
  using (school_id=(select private.member_school()) and (select private.member_role()) in ('ADMIN','HEADTEACHER'))
  with check (school_id=(select private.member_school()) and (select private.member_role()) in ('ADMIN','HEADTEACHER'));

-- Each closure creates another immutable set of reports; reopening never erases one.
alter table public.academic_terms add column archive_revision integer not null default 0 check(archive_revision>=0);
alter table public.report_archives add column revision integer not null default 1 check(revision>0);
update public.academic_terms t set archive_revision=1
where status='CLOSED' or exists(select 1 from public.report_archives a where a.school_id=t.school_id and a.academic_year=t.academic_year and a.term=t.term);
alter table public.report_archives drop constraint report_archives_student_id_academic_year_term_key;
alter table public.report_archives add constraint report_archive_revision_unique unique(student_id,academic_year,term,revision);
create index report_archives_class on public.report_archives(class_id);

create table public.term_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  action text not null check(action in ('CLOSED','REOPENED')),
  actor_name text not null,
  actor_id uuid references public.school_users(id) on delete set null,
  reason text not null default '',
  archive_revision integer not null,
  created_at timestamptz not null default now()
);
create index term_events_school on public.term_events(school_id,created_at desc);
create index term_events_term on public.term_events(term_id);
create index term_events_actor on public.term_events(actor_id);
alter table public.term_events enable row level security;
revoke all on public.term_events from public,anon,authenticated;
grant select on public.term_events to authenticated;
grant all on public.term_events to service_role;
create policy leadership_term_events on public.term_events for select to authenticated
using(school_id=(select private.member_school()) and (select private.member_role()) in ('ADMIN','HEADTEACHER'));

create or replace function private.reopen_term(target_id uuid, reason text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.schools; t public.academic_terms;
begin
  if auth.uid() is null or coalesce(private.member_role(),'') not in ('ADMIN','HEADTEACHER') then
    raise exception 'School leadership access required.';
  end if;
  if reason is null or length(trim(reason)) not between 5 and 500 then
    raise exception 'Enter a reason between 5 and 500 characters.';
  end if;
  select * into s from public.schools where id=private.member_school() for update;
  select * into t from public.academic_terms where id=target_id and school_id=s.id for update;
  if t.id is null then raise exception 'Term not found in your school.'; end if;
  if t.status<>'CLOSED' then raise exception 'This term is already open.'; end if;
  if exists(select 1 from public.academic_terms where school_id=s.id and status='OPEN') then
    raise exception 'Another term is open. Only the most recent term can be reopened.';
  end if;
  if (t.academic_year,t.term) is distinct from (s.academic_year,s.current_term)
    or exists(select 1 from public.academic_terms where school_id=s.id and (academic_year,term)>(t.academic_year,t.term)) then
    raise exception 'A later term has already been started. Only the most recent term can be reopened.';
  end if;
  if exists(select 1 from public.report_archives a join public.students st on st.id=a.student_id
    where a.school_id=s.id and a.academic_year=t.academic_year and a.term=t.term and a.revision=t.archive_revision and a.class_id<>st.class_id)
    or exists(select 1 from public.scores sc join public.students st on st.id=sc.student_id
    where sc.school_id=s.id and sc.academic_year=t.academic_year and sc.term=t.term and sc.class_id<>st.class_id) then
    raise exception 'Learners have moved classes since this term closed. Restore their original class placement before reopening.';
  end if;
  update public.academic_terms set status='OPEN',closed_at=null where id=t.id;
  insert into public.term_events(school_id,term_id,action,actor_name,actor_id,reason,archive_revision)
  select s.id,t.id,'REOPENED',full_name,id,trim(reason),t.archive_revision
  from public.school_users where id=private.member_id();
end $$;
create or replace function public.reopen_term(term_id uuid, reason text) returns void
language sql security invoker set search_path='' as $$select private.reopen_term(term_id,reason)$$;
revoke all on function private.reopen_term(uuid,text),public.reopen_term(uuid,text) from public,anon,authenticated;
grant execute on function private.reopen_term(uuid,text),public.reopen_term(uuid,text) to authenticated;

-- Deleting an unused record is allowed. Existing results and archived reports are retained.
create or replace function private.protect_school_records() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.schools where id=OLD.school_id for update;
  if TG_TABLE_NAME='students' then
    if exists(select 1 from public.scores where student_id=OLD.id)
      or exists(select 1 from public.attendance where student_id=OLD.id)
      or exists(select 1 from public.affective_records where student_id=OLD.id)
      or exists(select 1 from public.remarks where student_id=OLD.id)
      or exists(select 1 from public.report_archives where student_id=OLD.id) then
      raise exception 'This learner has assessment or report history. Use Withdraw to retain their records.';
    end if;
  elsif TG_TABLE_NAME='classes' then
    if exists(select 1 from public.students where class_id=OLD.id)
      or exists(select 1 from public.class_subjects where class_id=OLD.id)
      or exists(select 1 from public.scores where class_id=OLD.id)
      or exists(select 1 from public.report_archives where class_id=OLD.id) then
      raise exception 'This class has learners, subject assignments or report history. Only unused classes can be deleted.';
    end if;
  end if;
  return OLD;
end $$;
revoke all on function private.protect_school_records() from public,anon,authenticated;
create trigger protect_learner_history before delete on public.students for each row execute function private.protect_school_records();
create trigger protect_class_history before delete on public.classes for each row execute function private.protect_school_records();

create or replace function private.close_term() returns integer language plpgsql security definer set search_path='' as $$
declare s public.schools; a public.academic_terms; n integer; revision_number integer;
begin
 if auth.uid() is null or coalesce(private.member_role(),'') not in ('ADMIN','HEADTEACHER') then raise exception 'School leadership access required.'; end if;
 select * into s from public.schools where id=private.member_school() for update;
 select * into a from public.academic_terms where school_id=s.id and academic_year=s.academic_year and term=s.current_term for update;
 if a.status is distinct from 'OPEN' then raise exception 'There is no open term to close.'; end if;
 revision_number=a.archive_revision+1;
 insert into public.report_archives(school_id,student_id,class_id,academic_year,term,revision,snapshot)
 select s.id,st.id,st.class_id,s.academic_year,s.current_term,revision_number,jsonb_build_object(
  'school',to_jsonb(s),'student',to_jsonb(st),'class',to_jsonb(c),
  'subjects',coalesce((select jsonb_agg(to_jsonb(sub)) from public.subjects sub where sub.school_id=s.id),'[]'::jsonb),
  'scores',coalesce((select jsonb_agg(to_jsonb(sc)) from public.scores sc where sc.student_id=st.id and sc.academic_year=s.academic_year and sc.term=s.current_term),'[]'::jsonb),
  'attendance',(select to_jsonb(att) from public.attendance att where att.student_id=st.id and att.academic_year=s.academic_year and att.term=s.current_term),
  'affective',(select to_jsonb(af) from public.affective_records af where af.student_id=st.id and af.academic_year=s.academic_year and af.term=s.current_term),
  'remarks',(select to_jsonb(r) from public.remarks r where r.student_id=st.id and r.academic_year=s.academic_year and r.term=s.current_term),
  'class_students',coalesce((select jsonb_agg(jsonb_build_object('id',st2.id)) from public.students st2 where st2.class_id=c.id and st2.status='ACTIVE'),'[]'::jsonb),
  'class_scores',coalesce((select jsonb_agg(jsonb_build_object('student_id',sc2.student_id,'subject_id',sc2.subject_id,'total',sc2.total)) from public.scores sc2 where sc2.class_id=c.id and sc2.academic_year=s.academic_year and sc2.term=s.current_term),'[]'::jsonb)
 ) from public.students st join public.classes c on c.id=st.class_id where st.school_id=s.id and st.status='ACTIVE';
 get diagnostics n=row_count;
 update public.academic_terms set status='CLOSED',closed_at=now(),archive_revision=revision_number where id=a.id;
 insert into public.term_events(school_id,term_id,action,actor_name,actor_id,archive_revision)
 select s.id,a.id,'CLOSED',full_name,id,revision_number from public.school_users where id=private.member_id();
 return n;
end $$;


notify pgrst,'reload schema';
