-- Keep archived cohorts compact and make term/settings transitions consistent.
create or replace function private.validate_record() returns trigger language plpgsql security definer set search_path='' as $$
declare rowdata jsonb; s uuid; y text; t smallint; st public.students; term_status text; role_name text; cls public.classes; sb numeric; ex numeric;
begin
 rowdata=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 s=(rowdata->>'school_id')::uuid;
 if TG_TABLE_NAME in ('scores','attendance','affective_records','remarks') then
  y=rowdata->>'academic_year'; t=(rowdata->>'term')::smallint;
  -- Lock in the same order as term closing and settings changes.
  perform 1 from public.schools where id=s for share;
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
  'class_scores',coalesce((select jsonb_agg(jsonb_build_object('student_id',sc2.student_id,'subject_id',sc2.subject_id,'total',sc2.total)) from public.scores sc2 where sc2.class_id=c.id and sc2.academic_year=s.academic_year and sc2.term=s.current_term),'[]'::jsonb)
 ) from public.students st join public.classes c on c.id=st.class_id where st.school_id=s.id and st.status='ACTIVE';
 get diagnostics n=row_count;
 update public.academic_terms set status='CLOSED',closed_at=now() where id=a.id;
 return n;
end $$;

create or replace function private.open_term(y text,t smallint) returns void language plpgsql security definer set search_path='' as $$
declare s uuid; previous_year text; previous_term smallint;
begin
 if auth.uid() is null or coalesce(private.member_role(),'') not in ('ADMIN','HEADTEACHER') then raise exception 'School leadership access required.'; end if;
 if y !~ '^[0-9]{4}/[0-9]{4}$' or split_part(y,'/',2)::int<>split_part(y,'/',1)::int+1 or t not between 1 and 3 then raise exception 'Enter a valid academic year and term.'; end if;
 s=private.member_school(); perform 1 from public.schools where id=s for update;
 if exists(select 1 from public.academic_terms where school_id=s and status='OPEN') then raise exception 'Close the current term first.'; end if;
 select academic_year,term into previous_year,previous_term from public.academic_terms where school_id=s order by academic_year desc,term desc limit 1;
 if previous_year is not null and (y,t)<=(previous_year,previous_term) then raise exception 'Choose a term after the most recent term.'; end if;
 insert into public.academic_terms(school_id,academic_year,term) values(s,y,t);
 update public.schools set academic_year=y,current_term=t where id=s;
 update public.classes set academic_year=y where school_id=s;
end $$;
