-- Save attendance and both kinds of remarks atomically under the caller's RLS permissions.
create or replace function public.save_report_notes(learner_id uuid,notes jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare s public.schools; existing public.remarks; c text; h text;
begin
 if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
 select * into s from public.schools where id=private.member_school();
 if s.id is null then raise exception 'School access required.'; end if;
 -- Serialize edits to one learner so separate staff cannot overwrite each other's remarks.
 perform pg_advisory_xact_lock(hashtextextended(learner_id::text,0));
 if notes ? 'days_present' then
  insert into public.attendance(school_id,student_id,academic_year,term,days_present,total_days) values(s.id,learner_id,s.academic_year,s.current_term,(notes->>'days_present')::int,(notes->>'total_days')::int)
  on conflict(student_id,term,academic_year) do update set days_present=excluded.days_present,total_days=excluded.total_days;
  insert into public.affective_records(school_id,student_id,academic_year,term,conduct,interest,attitude,talents) values(s.id,learner_id,s.academic_year,s.current_term,notes->>'conduct',notes->>'interest',notes->>'attitude',notes->>'talents')
  on conflict(student_id,term,academic_year) do update set conduct=excluded.conduct,interest=excluded.interest,attitude=excluded.attitude,talents=excluded.talents;
 end if;
 select * into existing from public.remarks where student_id=learner_id and academic_year=s.academic_year and term=s.current_term;
 c=case when notes ? 'class_teacher_remark' then notes->>'class_teacher_remark' else existing.class_teacher_remark end;
 h=case when notes ? 'headteacher_remark' then notes->>'headteacher_remark' else existing.headteacher_remark end;
 if length(coalesce(c,''))>500 or length(coalesce(h,''))>500 then raise exception 'Remarks must be no longer than 500 characters.'; end if;
 if existing.id is null then
  insert into public.remarks(school_id,student_id,academic_year,term,class_teacher_remark,headteacher_remark) values(s.id,learner_id,s.academic_year,s.current_term,c,h);
 else
  update public.remarks set class_teacher_remark=c,headteacher_remark=h where id=existing.id;
 end if;
end $$;
revoke all on function public.save_report_notes(uuid,jsonb) from public,anon;
grant execute on function public.save_report_notes(uuid,jsonb) to authenticated;

create or replace function private.is_operator() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.platform_operators op join public.school_users u on u.auth_user_id=op.auth_user_id where op.auth_user_id=auth.uid() and u.active and not u.must_change_password)
$$;
create or replace function private.guard_enrolment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if NEW.school_id<>OLD.school_id then raise exception 'A learner cannot be moved between schools.'; end if;
 if NEW.class_id<>OLD.class_id and exists(select 1 from public.scores sc join public.academic_terms t on t.school_id=sc.school_id and t.academic_year=sc.academic_year and t.term=sc.term where sc.student_id=OLD.id and t.status='OPEN') then raise exception 'Close the current term before moving a learner with recorded marks.'; end if;
 return NEW;
end $$;
create trigger enrolment_guard before update on public.students for each row execute function private.guard_enrolment();
create or replace function private.guard_subject_level() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if NEW.school_id<>OLD.school_id then raise exception 'Subjects cannot be moved between schools.'; end if;
 if NEW.level<>OLD.level and NEW.level<>'ALL' and exists(select 1 from public.class_subjects a join public.classes c on c.id=a.class_id where a.subject_id=NEW.id and c.level<>NEW.level) then raise exception 'Remove incompatible class assignments before changing this subject level.'; end if;
 return NEW;
end $$;
create trigger subject_level_guard before update on public.subjects for each row execute function private.guard_subject_level();
create or replace function private.guard_class_level() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if NEW.school_id<>OLD.school_id then raise exception 'Classes cannot be moved between schools.'; end if;
 if NEW.level<>OLD.level and exists(select 1 from public.class_subjects a join public.subjects s on s.id=a.subject_id where a.class_id=NEW.id and s.level<>'ALL' and s.level<>NEW.level) then raise exception 'Remove incompatible subjects before changing the class level.'; end if;
 return NEW;
end $$;
create trigger class_level_guard before update on public.classes for each row execute function private.guard_class_level();
revoke all on function private.guard_enrolment(),private.guard_subject_level(),private.guard_class_level() from public,anon,authenticated;
alter table public.students add constraint valid_learner_names check(length(trim(first_name)) between 1 and 100 and length(trim(last_name)) between 1 and 100 and length(trim(admission_number)) between 1 and 60);
alter table public.classes add constraint valid_class_name check(length(trim(name)) between 1 and 80);
alter table public.subjects add constraint valid_subject_name check(length(trim(name)) between 1 and 100);
alter table public.scores add constraint bounded_subject_remark check(length(coalesce(subject_remark,''))<=250);
alter table public.remarks add constraint bounded_remarks check(length(coalesce(class_teacher_remark,''))<=500 and length(coalesce(headteacher_remark,''))<=500);
notify pgrst,'reload schema';
