-- Add descriptive assessment without changing historical marks or other class rules.
ALTER TABLE public.scores ADD COLUMN descriptive_assessment text CHECK (descriptive_assessment IN ('EXCELLENT','VERY GOOD','GOOD'));

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

  -- A narrowly authorized hard-delete bypasses closed-term row validation only
  -- for the one learner being erased. All normal inserts and edits stay protected.
  if TG_OP='DELETE'
    and TG_TABLE_NAME in ('scores','attendance','affective_records','remarks')
    and auth.uid() is not null
    and coalesce(private.member_role(),'')='ADMIN'
    and private.member_school()=s
    and current_setting('app.edureport_erase_learner',true)=(rowdata->>'student_id')
  then return OLD; end if;

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

    -- Crèche and Nursery use teacher-selected descriptive assessments.
    -- Retain any historical numerical values when reassessing an existing row.
    -- New records use compatibility placeholders, excluded from numerical reporting.
    if exists (
      select 1 from public.classes c
      where c.id=NEW.class_id and c.school_id=s
        and translate(lower(btrim(c.name)), 'èéêë', 'eeee') ~ '^(creche|nursery)([[:space:]-]*([1-3]|i{1,3}))?([[:space:]]+[a-z])?$'
    ) then
      if NEW.descriptive_assessment is null or NEW.descriptive_assessment not in ('EXCELLENT','VERY GOOD','GOOD') then
        raise exception 'Choose EXCELLENT, VERY GOOD or GOOD for Crèche or Nursery.';
      end if;
      if TG_OP='UPDATE' then
        NEW.sba_raw=OLD.sba_raw;
        NEW.exam_raw=OLD.exam_raw;
        NEW.sba_scaled=OLD.sba_scaled;
        NEW.exam_scaled=OLD.exam_scaled;
        NEW.total=OLD.total;
        NEW.grade=OLD.grade;
        NEW.subject_remark=OLD.subject_remark;
      else
        NEW.sba_raw=0;
        NEW.exam_raw=0;
        NEW.sba_scaled=0;
        NEW.exam_scaled=0;
        NEW.total=0;
        NEW.grade='-';
        NEW.subject_remark='';
      end if;
      return NEW;
    end if;
    if NEW.descriptive_assessment is not null then
      raise exception 'Descriptive assessments are restricted to Crèche and Nursery.';
    end if;

    -- Only Grade 9/JHS3 uses examination marks out of 100 with no SBA.
    if exists (
      select 1 from public.classes c
      where c.id=NEW.class_id and c.school_id=s
        and btrim(c.name) ~* '^(grade[[:space:]]*0?9|basic[[:space:]]*0?9|jhs[[:space:]-]*3|jhs[[:space:]-]*iii)$'
    ) then
      if NEW.exam_raw is null or NEW.exam_raw<0 or NEW.exam_raw>100 then
        raise exception 'Grade 9 examination marks must be between 0 and 100.';
      end if;
      NEW.sba_raw=0;
      NEW.sba_scaled=0;
      NEW.exam_scaled=round(NEW.exam_raw,2);
      NEW.total=NEW.exam_scaled;
      NEW.grade=case
        when NEW.total>=80 then 'A'
        when NEW.total>=68 then 'B'
        when NEW.total>=54 then 'C'
        when NEW.total>=40 then 'D'
        else 'E'
      end;
    else
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
    end if;
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
$function$;
