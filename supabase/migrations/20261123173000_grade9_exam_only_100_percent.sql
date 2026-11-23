-- Grade 9 / JHS 3 examination-only grading (100% exam, 0% SBA).
-- Preserves existing school-wide assessment, RLS and term rules for other classes.
-- Commit for separate production review; NO production application in this task.
-- Does NOT backfill historical records. Consumers use original exam_raw.

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

    -- Grade 9 (JHS 3) is examination only. Ignore any old SBA marks.
    -- All other classes must retain their existing school-wide SBA/Exam weights.
    if exists (
      select 1
      from public.classes c
      where c.id = NEW.class_id and c.school_id = s
        and btrim(c.name) ~* '^(grade[[:space:]]*0?9|basic[[:space:]]*0?9|jhs[[:space:]-]*3|jhs[[:space:]-]*iii)

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
$function$

