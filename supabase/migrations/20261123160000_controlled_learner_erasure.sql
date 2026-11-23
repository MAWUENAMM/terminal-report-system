-- Authorized erasure is distinct from normal student withdrawal/graduation.
-- Only school ADMIN can use it; financial/receipt and issued transcript records
-- cannot be silently destroyed. No existing rows are touched by deployment.

create table if not exists private.learner_erasure_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  operator_auth_user_id uuid not null,
  deleted_assessment_rows integer not null,
  deleted_archives integer not null,
  scrubbed_other_archives integer not null,
  deleted_at timestamptz not null default now()
);
revoke all on private.learner_erasure_audit from public,anon,authenticated;

-- Existing ordinary triggers must continue protecting history; an internal
-- purge operation is authorized only by the current logged-in school ADMIN.
create or replace function private.protect_archived_academics()
returns trigger language plpgsql set search_path='' as $archive_guard$
declare erase_id text;
begin
  erase_id:=current_setting('app.edureport_erase_learner',true);
  if erase_id is not null and erase_id<>'' and auth.uid() is not null
    and coalesce(private.member_role(),'')='ADMIN'
    and private.member_school()=old.school_id
  then
    if tg_op='DELETE' and old.student_id::text=erase_id then return old; end if;
    if tg_op='UPDATE' and new.id=old.id and new.student_id=old.student_id
      and new.snapshot->'student'=old.snapshot->'student'
      and new.snapshot->'scores'=old.snapshot->'scores'
      and new.snapshot->'attendance'=old.snapshot->'attendance'
      and new.snapshot->'affective'=old.snapshot->'affective'
      and new.snapshot->'remarks'=old.snapshot->'remarks'
    then return new; end if;
  end if;
  raise exception 'Archived term reports are immutable outside the authorized learner-erasure workflow.';
end $archive_guard$;

-- Skip the closed-term INSERT/UPDATE checks only during an administrator's
-- one-learner DELETE; never bypass normal result validation.
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
$function$;

create or replace function public.admin_permanently_delete_learner(
  p_student_id uuid, p_admission_number text
) returns jsonb
language plpgsql security definer set search_path='' as $erase$
declare
  learner public.students;
  deleted_marks integer:=0;
  deleted_archives integer:=0;
  redacted_other_archives integer:=0;
  all_deleted integer:=0;
  deleted_rows integer:=0;
begin
  if auth.uid() is null or coalesce(private.member_role(),'')<>'ADMIN' then
    raise exception 'Only an authorized school administrator can permanently delete a learner.';
  end if;
  select * into learner from public.students
    where id=p_student_id and school_id=private.member_school() for update;
  if learner.id is null then raise exception 'Learner not found in this school.'; end if;
  if upper(trim(coalesce(p_admission_number,'')))<>upper(trim(learner.admission_number)) then
    raise exception 'Confirmation failed: type the exact admission number.';
  end if;
  perform 1 from public.schools where id=learner.school_id for update;
  if exists(select 1 from public.finance_charges where school_id=learner.school_id and student_id=learner.id)
     or exists(select 1 from public.finance_payments where school_id=learner.school_id and student_id=learner.id)
     or exists(select 1 from public.finance_sales where school_id=learner.school_id and student_id=learner.id)
     or exists(select 1 from public.finance_fees where school_id=learner.school_id and target_student_id=learner.id)
  then raise exception 'Finance records or receipts are attached. They must be resolved through the approved financial-record process before permanent erasure.'; end if;
  if exists(select 1 from public.transcript_issuances where student_id=learner.id)
  then raise exception 'An official transcript has been issued for this learner. Academic records cannot be erased using this workflow.'; end if;

  perform set_config('app.edureport_erase_learner',learner.id::text,true);

  -- Other learners' closed reports may contain the target learner's ID and
  -- class marks inside their comparison arrays. Remove those references.
  update public.report_archives a
  set snapshot=jsonb_set(
    jsonb_set(a.snapshot,'{class_students}',
      coalesce((
        select jsonb_agg(v.obj order by v.ordinal)
        from jsonb_array_elements(coalesce(a.snapshot->'class_students','[]'::jsonb))
          with ordinality as v(obj,ordinal)
        where v.obj->>'id'<>learner.id::text
      ),'[]'::jsonb),true),
    '{class_scores}',
      coalesce((
        select jsonb_agg(v.obj order by v.ordinal)
        from jsonb_array_elements(coalesce(a.snapshot->'class_scores','[]'::jsonb))
          with ordinality as v(obj,ordinal)
        where v.obj->>'student_id'<>learner.id::text
      ),'[]'::jsonb),true)
  where a.school_id=learner.school_id and a.student_id<>learner.id
    and (
      a.snapshot->'class_students' @> jsonb_build_array(jsonb_build_object('id',learner.id))
      or exists(select 1 from jsonb_array_elements(coalesce(a.snapshot->'class_scores','[]'::jsonb)) as sc
        where sc->>'student_id'=learner.id::text)
    );
  get diagnostics redacted_other_archives=row_count;

  delete from public.report_archives
    where student_id=learner.id and school_id=learner.school_id;
  get diagnostics deleted_archives=row_count;

  delete from public.scores where student_id=learner.id and school_id=learner.school_id;
  get diagnostics deleted_marks=row_count;
  all_deleted:=all_deleted+deleted_marks;
  delete from public.attendance where student_id=learner.id and school_id=learner.school_id;
  get diagnostics deleted_rows=row_count;
  all_deleted:=all_deleted+deleted_rows;
  delete from public.affective_records where student_id=learner.id and school_id=learner.school_id;
  get diagnostics deleted_rows=row_count;
  all_deleted:=all_deleted+deleted_rows;
  delete from public.remarks where student_id=learner.id and school_id=learner.school_id;
  get diagnostics deleted_rows=row_count;
  all_deleted:=all_deleted+deleted_rows;
  delete from public.guardian_sms_contacts where student_id=learner.id and school_id=learner.school_id;

  delete from public.students where id=learner.id and school_id=learner.school_id;
  get diagnostics deleted_rows=row_count;
  if deleted_rows<>1 then raise exception 'Learner deletion did not complete. No changes were committed.'; end if;

  insert into private.learner_erasure_audit
    (school_id,operator_auth_user_id,deleted_assessment_rows,deleted_archives,scrubbed_other_archives)
    values(learner.school_id,auth.uid(),all_deleted,deleted_archives,redacted_other_archives);

  return jsonb_build_object('deleted',true,'deleted_marks',deleted_marks,
    'deleted_academic_rows',all_deleted,'deleted_archives',deleted_archives,
    'scrubbed_other_archives',redacted_other_archives);
end $erase$;

revoke all on function public.admin_permanently_delete_learner(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_permanently_delete_learner(uuid,text) to authenticated;

-- After the learner row is erased, permit ONLY the own-school administrator to
-- remove its canonical photo object. The storage API still deletes the bytes.
create policy "school admin removes erased learner photo"
on storage.objects for delete to authenticated
using (
  bucket_id='school-assets'
  and private.member_role()='ADMIN'
  and (storage.foldername(name))[1]='schools'
  and (storage.foldername(name))[2]=private.member_school()::text
  and (storage.foldername(name))[3]='students'
  and storage.filename(name)='photo'
  and name=('schools/'||private.member_school()::text||
    '/students/'||(storage.foldername(name))[4]||'/photo')
);
