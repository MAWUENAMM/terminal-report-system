-- One common total-school-days denominator for the currently open academic term.
-- Existing and archived learner attendance in prior terms must not be rewritten.
alter table public.schools add column if not exists term_total_days integer
  check (term_total_days is null or term_total_days between 1 and 366);
grant update (term_total_days) on public.schools to authenticated;

create or replace function private.verify_school_term_days()
returns trigger language plpgsql set search_path='' as $guard$
declare
  term_status text;
  greatest_attendance int;
begin
  if new.term_total_days is not distinct from old.term_total_days then return new; end if;
  if new.academic_year is distinct from old.academic_year
    or new.current_term is distinct from old.current_term then return new; end if;
  if new.term_total_days is null then
    raise exception 'School days cannot be cleared during the term. Set a new value or advance the term.';
  end if;
  select status into term_status from public.academic_terms
    where school_id=old.id and academic_year=old.academic_year and term=old.current_term;
  if term_status is distinct from 'OPEN' then
    raise exception 'Change total school days only while the current term is open.';
  end if;
  select max(a.days_present) into greatest_attendance
    from public.attendance a where a.school_id=old.id
      and a.academic_year=old.academic_year and a.term=old.current_term;
  if greatest_attendance>new.term_total_days then
    raise exception 'The new total days cannot be below any recorded learner attendance (%).',greatest_attendance;
  end if;
  return new;
end $guard$;

drop trigger if exists verify_school_term_days on public.schools;
create trigger verify_school_term_days
  before update of term_total_days on public.schools
  for each row execute function private.verify_school_term_days();

create or replace function private.propagate_school_term_days()
returns trigger language plpgsql security definer set search_path='' as $apply$
begin
  -- Never mutate old term records: only the school's open, current term.
  if new.term_total_days is null then return new; end if;
  if not exists(select 1 from public.academic_terms t
    where t.school_id=new.id and t.academic_year=new.academic_year
      and t.term=new.current_term and t.status='OPEN')
  then return new; end if;
  update public.attendance a
    set total_days=new.term_total_days
    where a.school_id=new.id and a.academic_year=new.academic_year
      and a.term=new.current_term
      and a.total_days is distinct from new.term_total_days;
  return new;
end $apply$;

drop trigger if exists propagate_school_term_days on public.schools;
create trigger propagate_school_term_days
  after update of term_total_days on public.schools
  for each row when (new.term_total_days is distinct from old.term_total_days)
  execute function private.propagate_school_term_days();

-- The existing rollover trigger resets the next-term date; reset the current
-- school-days denominator too, so a previous term's count is never carried over.
create or replace function private.clear_next_term_date_on_rollover()
returns trigger language plpgsql set search_path='' as $reset$
begin
  if (new.academic_year,new.current_term) is distinct from (old.academic_year,old.current_term)
  then
    new.next_term_begins=null;
    new.term_total_days=null;
  end if;
  return new;
end $reset$;

create or replace function private.enforce_school_attendance_days()
returns trigger language plpgsql set search_path='' as $validation$
declare term_days int;
begin
  select s.term_total_days into term_days from public.schools s
  where s.id=new.school_id and s.academic_year=new.academic_year
    and s.current_term=new.term;
  if term_days is not null and new.total_days<>term_days then
    raise exception 'Total school days is set to % in School Settings. Enter only the learner days present.',term_days;
  end if;
  return new;
end $validation$;

drop trigger if exists enforce_school_attendance_days on public.attendance;
create trigger enforce_school_attendance_days
  before insert or update on public.attendance
  for each row execute function private.enforce_school_attendance_days();

comment on column public.schools.term_total_days is
  'Common current open-term total school days; displayed to all learners. Prior reports retain their own archived snapshot.';
