-- Long-term academic histories: additive changes only.
-- Never rewrite previously archived report snapshots; keep the student ID
-- through promotions, transfers and graduation.
alter table public.students
  drop constraint if exists students_status_check;
alter table public.students
  add constraint students_status_check
    check (status in ('ACTIVE','TRANSFERRED','WITHDRAWN','GRADUATED'));
alter table public.students
  add column if not exists graduated_at timestamptz;

create or replace function private.student_academic_status_guard()
returns trigger language plpgsql set search_path='' as $$
declare current_school public.schools;
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.report_archives a where a.student_id=old.id)
      or exists(select 1 from public.scores s where s.student_id=old.id)
      or exists(select 1 from public.attendance a where a.student_id=old.id)
      or exists(select 1 from public.affective_records a where a.student_id=old.id)
      or exists(select 1 from public.remarks r where r.student_id=old.id)
      or exists(select 1 from public.transcript_issuances i where i.student_id=old.id)
    then
      raise exception 'Student has academic history. Use Graduated or Withdrawn; deleting academic records is blocked.';
    end if;
    return old;
  end if;
  if new.status is distinct from old.status then
    if new.status='GRADUATED' then
      select * into current_school from public.schools where id=new.school_id;
      -- Do not mark a learner graduated before their last scored term is archived.
      if exists (
        select 1 from public.academic_terms t
        where t.school_id=new.school_id and t.status='OPEN'
          and t.academic_year=current_school.academic_year and t.term=current_school.current_term
          and (
            exists (select 1 from public.scores sc where sc.student_id=new.id
              and sc.academic_year=t.academic_year and sc.term=t.term)
            or exists (select 1 from public.attendance att where att.student_id=new.id
              and att.academic_year=t.academic_year and att.term=t.term)
            or exists (select 1 from public.affective_records af where af.student_id=new.id
              and af.academic_year=t.academic_year and af.term=t.term)
            or exists (select 1 from public.remarks re where re.student_id=new.id
              and re.academic_year=t.academic_year and re.term=t.term)
          )
      ) then raise exception 'Close and archive the learner final term before graduation.'; end if;
      new.graduated_at:=coalesce(new.graduated_at,now());
    elsif old.status='GRADUATED' and new.status<>'GRADUATED' then
      new.graduated_at:=null;
    end if;
  end if;
  return new;
end $$;

-- Place this after the transcript table is created below.

-- Each issuance is a durable audit event, not an automatically "digitally signed" document.
create table if not exists public.transcript_issuances (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  issued_by uuid references auth.users(id) on delete set null,
  archive_ids uuid[] not null check(cardinality(archive_ids)>0 and cardinality(archive_ids)<=120),
  issued_at timestamptz not null default now()
);
create index if not exists transcript_issuances_student_time_idx
  on public.transcript_issuances(school_id,student_id,issued_at desc);
alter table public.transcript_issuances enable row level security;
create index if not exists report_archives_history_lookup_idx
  on public.report_archives (school_id,student_id,academic_year,term,revision desc);
revoke all on table public.transcript_issuances from public,anon,authenticated;
grant select on public.transcript_issuances to authenticated;
create policy transcript_issuances_school_leadership_read
  on public.transcript_issuances for select to authenticated
  using (
    school_id=(select private.member_school())
    and (select private.member_role()) in ('ADMIN','HEADTEACHER')
  );

drop trigger if exists student_academic_history_guard on public.students;
create trigger student_academic_history_guard
  before update of status or delete on public.students
  for each row execute function private.student_academic_status_guard();

create or replace function private.protect_archived_academics()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Archived term reports are immutable. Use the documented records-correction process instead.';
end $$;
drop trigger if exists protect_report_archives on public.report_archives;
create trigger protect_report_archives
  before update or delete on public.report_archives
  for each row execute function private.protect_archived_academics();

create or replace function private.protect_school_academic_history()
returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.report_archives where school_id=old.id)
    or exists(select 1 from public.transcript_issuances where school_id=old.id)
  then raise exception 'School has archived academic history; deactivate rather than permanently delete.'; end if;
  return old;
end $$;
drop trigger if exists protect_school_archives on public.schools;
create trigger protect_school_archives
  before delete on public.schools
  for each row execute function private.protect_school_academic_history();

-- Term closure: retain report snapshots for learners with current-term academic
-- activity even if they withdrew, transferred or graduated before closure.
-- No existing report is modified, and the term workflow remains unchanged.
create or replace function private.close_term()
returns integer
language plpgsql
security definer
set search_path=''
as $close$
declare s public.schools; a public.academic_terms; n integer; revision_number integer;
begin
 if auth.uid() is null or coalesce(private.member_role(),'') not in ('ADMIN','HEADTEACHER') then
   raise exception 'School leadership access required.';
 end if;
 select * into s from public.schools where id=private.member_school() for update;
 select * into a from public.academic_terms
 where school_id=s.id and academic_year=s.academic_year and term=s.current_term for update;
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
 ) from public.students st join public.classes c on c.id=st.class_id
 where st.school_id=s.id and (
   st.status='ACTIVE' or
   exists(select 1 from public.scores sc where sc.student_id=st.id
     and sc.academic_year=s.academic_year and sc.term=s.current_term) or
   exists(select 1 from public.attendance att where att.student_id=st.id
     and att.academic_year=s.academic_year and att.term=s.current_term) or
   exists(select 1 from public.affective_records af where af.student_id=st.id
     and af.academic_year=s.academic_year and af.term=s.current_term) or
   exists(select 1 from public.remarks r where r.student_id=st.id
     and r.academic_year=s.academic_year and r.term=s.current_term)
 );
 get diagnostics n=row_count;
 update public.academic_terms set status='CLOSED',closed_at=now(),archive_revision=revision_number where id=a.id;
 insert into public.term_events(school_id,term_id,action,actor_name,actor_id,archive_revision)
 select s.id,a.id,'CLOSED',full_name,id,revision_number from public.school_users where id=private.member_id();
 return n;
end $close$;

-- Verify authorization at issuance time. Neither staff in another school nor
-- browser clients may forge a transcript with unrelated archive IDs.
create or replace function public.issue_student_transcript(
  p_student_id uuid,
  p_archive_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path=''
as $issue$
declare
  school_uuid uuid;
  recorded integer;
  issued uuid;
begin
  if auth.uid() is null or coalesce(private.member_role(),'') not in ('ADMIN','HEADTEACHER') then
    raise exception 'School leadership access required to issue a transcript';
  end if;
  school_uuid:=private.member_school();
  if school_uuid is null or not exists(
    select 1 from public.students st where st.id=p_student_id and st.school_id=school_uuid
  ) then raise exception 'Student is not registered at your school'; end if;
  if p_archive_ids is null or cardinality(p_archive_ids)<1 or cardinality(p_archive_ids)>120 then
    raise exception 'Select at least one finalized term, up to 120';
  end if;
  select count(distinct id) into recorded
  from public.report_archives
  where id=any(p_archive_ids) and student_id=p_student_id and school_id=school_uuid;
  if recorded<>cardinality(p_archive_ids) then
    raise exception 'Unrecognized or duplicate archived reports';
  end if;
  if exists (
    select 1 from public.report_archives chosen
    where chosen.id=any(p_archive_ids) and exists(
      select 1 from public.report_archives newer
      where newer.school_id=chosen.school_id and newer.student_id=chosen.student_id
        and newer.academic_year=chosen.academic_year and newer.term=chosen.term
        and newer.revision>chosen.revision
    )
  ) then raise exception 'A newer corrected archive exists. Use the latest term revision.'; end if;
  insert into public.transcript_issuances(school_id,student_id,issued_by,archive_ids)
  values(school_uuid,p_student_id,auth.uid(),p_archive_ids)
  returning id into issued;
  return issued;
end $issue$;

revoke all on function public.issue_student_transcript(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.issue_student_transcript(uuid,uuid[]) to authenticated;
comment on table public.transcript_issuances is
  'School-issued transcript references for finalized term archives; retain under a documented school academic records policy.';
