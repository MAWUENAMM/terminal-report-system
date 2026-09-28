-- Student profiles, school branding storage and deterministic subject performance remarks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-assets',
  'school-assets',
  false,
  2097152,
  array['image/png','image/jpeg','image/webp','image/svg+xml']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "school members can view school logo" on storage.objects;
drop policy if exists "school admins can upload school logo" on storage.objects;
drop policy if exists "school admins can replace school logo" on storage.objects;
drop policy if exists "school admins can delete school logo" on storage.objects;

create policy "school members can view school logo"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'school-assets'
  and storage.filename(name) = 'logo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
);

create policy "school admins can upload school logo"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'school-assets'
  and (select private.member_role()) = 'ADMIN'
  and storage.filename(name) = 'logo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
  and name = 'schools/' || (select private.member_school())::text || '/logo'
);

create policy "school admins can replace school logo"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'school-assets'
  and (select private.member_role()) = 'ADMIN'
  and storage.filename(name) = 'logo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
  and name = 'schools/' || (select private.member_school())::text || '/logo'
)
with check (
  bucket_id = 'school-assets'
  and (select private.member_role()) = 'ADMIN'
  and storage.filename(name) = 'logo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
  and name = 'schools/' || (select private.member_school())::text || '/logo'
);

create policy "school admins can delete school logo"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'school-assets'
  and (select private.member_role()) = 'ADMIN'
  and storage.filename(name) = 'logo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
  and name = 'schools/' || (select private.member_school())::text || '/logo'
);

create or replace function private.performance_remark(score numeric)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when score is null then null
    when score >= 80 then 'HIGHEST'
    when score >= 70 then 'HIGHER'
    when score >= 65 then 'HIGH'
    when score >= 60 then 'HIGH AVERAGE'
    when score >= 55 then 'AVERAGE'
    when score >= 50 then 'LOW AVERAGE'
    when score >= 45 then 'LOW'
    when score >= 35 then 'LOWER'
    else 'LOWEST'
  end;
$$;

revoke all on function private.performance_remark(numeric) from public, anon, authenticated;

create or replace function private.validate_record() returns trigger
language plpgsql
security definer
set search_path=''
as $$
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

    if NEW.sba_raw is null
      or NEW.exam_raw is null
      or NEW.sba_raw<0
      or NEW.sba_raw>100
      or NEW.exam_raw<0
      or NEW.exam_raw>100 then
      raise exception 'Both raw scores must be between 0 and 100.';
    end if;

    select sba_weight,exam_weight into sb,ex
      from public.schools where id=s;

    NEW.sba_scaled=round(NEW.sba_raw*sb/100,2);
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
$$;

update public.scores sc
set subject_remark = private.performance_remark(sc.total)
where exists (
  select 1
  from public.academic_terms t
  where t.school_id=sc.school_id
    and t.academic_year=sc.academic_year
    and t.term=sc.term
    and t.status='OPEN'
);

notify pgrst, 'reload schema';
