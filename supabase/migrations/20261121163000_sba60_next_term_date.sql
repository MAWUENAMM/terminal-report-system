-- Compatible SBA scale change: 100 raw -> 60 raw, weighting remains 50/50.
-- Preserve original raw mark/total/grade in a private audit table.
-- Existing closed report snapshots remain unchanged.
alter table public.schools add column if not exists next_term_begins date;
alter table public.schools add column if not exists sba_input_max numeric not null default 100 check (sba_input_max in (60,100));
-- School-specific request: keep other tenants' /100 assessments unchanged.
update public.schools set sba_input_max=60 where id='9af47605-e793-44ea-a5d8-8d5ab039f971' and name='THE ARK ACADEMY';

create or replace function private.clear_next_term_date_on_rollover()
returns trigger language plpgsql set search_path='' as $reset$
begin
  if (NEW.academic_year, NEW.current_term) is distinct from (OLD.academic_year,OLD.current_term)
    then NEW.next_term_begins=null; end if;
  return NEW;
end $reset$;
drop trigger if exists reset_next_term_date on public.schools;
create trigger reset_next_term_date
  before update of academic_year,current_term on public.schools
  for each row execute function private.clear_next_term_date_on_rollover();

create or replace function private.guard_sba_input_max_change()
returns trigger language plpgsql set search_path='' as $locked$
begin
  if NEW.sba_input_max is distinct from OLD.sba_input_max
     and exists(select 1 from public.scores sc
      where sc.school_id=OLD.id and sc.academic_year=OLD.academic_year and sc.term=OLD.current_term)
  then raise exception 'The SBA input maximum is locked after term marks have been entered.'; end if;
  return NEW;
end $locked$;
drop trigger if exists lock_school_sba_raw_basis on public.schools;
create trigger lock_school_sba_raw_basis before update of sba_input_max on public.schools
  for each row execute function private.guard_sba_input_max_change();

create table if not exists private.sba60_conversion_audit (
  score_id uuid primary key,
  school_id uuid not null,
  academic_year text not null,
  term smallint not null,
  old_sba_raw numeric not null,
  new_sba_raw numeric not null,
  old_sba_scaled numeric not null,
  old_total numeric not null,
  old_grade text not null,
  converted_at timestamptz not null default now()
);
revoke all on private.sba60_conversion_audit from public,anon,authenticated;
-- Scores saved before this migration used SBA /100; update only OPEN terms.
do $precheck$
begin
  if exists(
    select 1 from public.scores sc
    join public.academic_terms t on t.school_id=sc.school_id
      and t.academic_year=sc.academic_year and t.term=sc.term
    where t.status='OPEN' and sc.school_id='9af47605-e793-44ea-a5d8-8d5ab039f971' and (sc.sba_raw<0 or sc.sba_raw>100 or sc.exam_raw<0 or sc.exam_raw>100)
  ) then raise exception 'Out-of-range legacy marks; review before converting'; end if;
  if exists(
    select 1 from public.scores sc
    join public.academic_terms t on t.school_id=sc.school_id
      and t.academic_year=sc.academic_year and t.term=sc.term
    join private.sba60_conversion_audit a on a.score_id=sc.id
    where t.status='OPEN' and sc.school_id='9af47605-e793-44ea-a5d8-8d5ab039f971'
  ) then raise exception 'Some active marks already have an SBA conversion audit; abort double-conversion'; end if;
end $precheck$;

insert into private.sba60_conversion_audit
  (score_id,school_id,academic_year,term,old_sba_raw,new_sba_raw,old_sba_scaled,old_total,old_grade)
select sc.id,sc.school_id,sc.academic_year,sc.term,sc.sba_raw,round(sc.sba_raw*0.60,2),
       sc.sba_scaled,sc.total,sc.grade
from public.scores sc join public.academic_terms t
  on sc.school_id=t.school_id and sc.academic_year=t.academic_year and sc.term=t.term
where t.status='OPEN' and sc.school_id='9af47605-e793-44ea-a5d8-8d5ab039f971';

-- Same original trigger logic for attendance, remarks and class assignments.
-- Only SBA input maximum and SBA /60 scaling are changed.
CREATE OR REPLACE FUNCTION private.validate_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  rowdata jsonb;
  s uuid;
  y text;
  t smallint;
  st public.students;
  term_status text;
  role_name text;
  cls public.classes;
  sb numeric;
  ex numeric;
  mx numeric;
begin
  rowdata=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  s=(rowdata->>'school_id')::uuid;

  if TG_TABLE_NAME in ('scores','attendance','affective_records','remarks') then
    y=rowdata->>'academic_year';
    t=(rowdata->>'term')::smallint;
    perform 1 from public.schools where id=s for share;
    select status into term_status
      from public.academic_terms
      where school_id=s and academic_year=y and term=t
      for share;
    if term_status is distinct from 'OPEN' then
      raise exception 'This term is closed or has not been opened.';
    end if;
    select * into st
      from public.students
      where id=(rowdata->>'student_id')::uuid;
    if st.school_id is distinct from s then
      raise exception 'Student must belong to this school.';
    end if;
    if TG_OP='UPDATE'
      and (OLD.school_id,OLD.student_id,OLD.academic_year,OLD.term)
        is distinct from (NEW.school_id,NEW.student_id,NEW.academic_year,NEW.term) then
      raise exception 'Record identity cannot be changed.';
    end if;
  end if;

  if TG_OP='DELETE' then
    return OLD;
  end if;

  if TG_TABLE_NAME='scores' then
    if NEW.class_id is distinct from st.class_id then
      raise exception 'Student is not in this class.';
    end if;

    if not exists(
      select 1
      from public.class_subjects a
      join public.subjects sub on sub.id=a.subject_id
      where a.class_id=NEW.class_id
        and a.subject_id=NEW.subject_id
        and a.school_id=s
        and sub.active
    ) then
      raise exception 'Subject is not offered by this class.';
    end if;

    select sba_weight,exam_weight,sba_input_max into sb,ex,mx
      from public.schools where id=s;

    if NEW.sba_raw is null
      or NEW.exam_raw is null
      or NEW.sba_raw<0
      or NEW.sba_raw>mx
      or NEW.exam_raw<0
      or NEW.exam_raw>100 then
      raise exception 'SBA must be within the configured raw maximum, and Exam must be between 0 and 100.';
    end if;

    NEW.sba_scaled=round(NEW.sba_raw*sb/mx,2);
    NEW.exam_scaled=round(NEW.exam_raw*ex/100,2);
    NEW.total=NEW.sba_scaled+NEW.exam_scaled;
    NEW.grade=case
      when NEW.total>=80 then 'A'
      when NEW.total>=70 then 'B'
      when NEW.total>=60 then 'C'
      when NEW.total>=50 then 'D'
      when NEW.total>=40 then 'E'
      else 'F'
    end;
    NEW.subject_remark=private.performance_remark(NEW.total);

  elsif TG_TABLE_NAME='attendance' then
    if NEW.total_days<0 or NEW.total_days>366
      or NEW.days_present<0 or NEW.days_present>NEW.total_days then
      raise exception 'Attendance must be between 0 and total school days.';
    end if;

  elsif TG_TABLE_NAME='remarks' and auth.uid() is not null then
    role_name=private.member_role();

    if TG_OP='INSERT' then
      if role_name not in ('ADMIN','HEADTEACHER')
        and coalesce(NEW.headteacher_remark,'')<>'' then
        raise exception 'Only the headmaster or administrator can write headmaster remarks.';
      end if;

      if role_name='HEADTEACHER'
        and not private.owns_class(st.class_id)
        and coalesce(NEW.class_teacher_remark,'')<>'' then
        raise exception 'Class teacher remarks are managed by the assigned teacher.';
      end if;
    else
      if role_name not in ('ADMIN','HEADTEACHER')
        and NEW.headteacher_remark is distinct from OLD.headteacher_remark then
        raise exception 'Headmaster remarks are protected.';
      end if;

      if role_name='HEADTEACHER'
        and not private.owns_class(st.class_id)
        and NEW.class_teacher_remark is distinct from OLD.class_teacher_remark then
        raise exception 'Class teacher remarks are protected.';
      end if;
    end if;

  elsif TG_TABLE_NAME='class_subjects' then
    select * into cls from public.classes where id=NEW.class_id;

    if not exists(
      select 1 from public.subjects
      where id=NEW.subject_id
        and school_id=NEW.school_id
        and (level='ALL' or level=cls.level)
    ) then
      raise exception 'Subject level must match the class level.';
    end if;
  end if;

  return NEW;
end
$function$
;

-- Existing historical rows may have been entered before an administrator
-- changed subject assignments. Revalidating their current assignment during
-- a raw-scale conversion would reject legitimate already-saved marks.
-- ALTER TABLE holds an exclusive lock until the migration transaction ends;
-- temporarily bypass only this trigger, update audited SBA raw values, and
-- restore the validation trigger before the transaction can commit.
alter table public.scores disable trigger validate_write;
update public.scores sc set sba_raw=a.new_sba_raw
from private.sba60_conversion_audit a
where a.score_id=sc.id;
alter table public.scores enable trigger validate_write;

-- Abort the whole migration if any saved weighted mark, total or grade differs.
do $assert$
begin
  if exists(
    select 1 from public.scores sc
    join private.sba60_conversion_audit a on a.score_id=sc.id
    join public.schools sch on sch.id=sc.school_id
    where sc.sba_scaled<>a.old_sba_scaled
       or sc.total<>a.old_total
       or sc.grade<>a.old_grade
       or sc.sba_raw<>a.new_sba_raw
       or round(sc.sba_raw*sch.sba_weight/sch.sba_input_max,2)<>a.old_sba_scaled
  ) then raise exception 'SBA migration would change saved grades or weighted results. Rolled back.'; end if;
  if exists(
    select 1 from public.scores sc
    join public.academic_terms t on t.school_id=sc.school_id and
       t.academic_year=sc.academic_year and t.term=sc.term
    where t.status='OPEN' and sc.sba_raw>(select sba_input_max from public.schools where id=sc.school_id)
  ) then raise exception 'Some active SBA marks still exceed 60.'; end if;
end $assert$;
