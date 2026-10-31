-- Staging-tested enhancement: target a fee at one learner without changing existing fees.
alter table public.finance_fees add column target_student_id uuid;
alter table public.finance_fees add constraint finance_fees_single_scope
  check (class_id is null or target_student_id is null);
alter table public.finance_fees add constraint finance_fees_target_student_same_school
  foreign key(target_student_id,school_id) references public.students(id,school_id);
create index finance_fees_target_student_idx
  on public.finance_fees(school_id,target_student_id)
  where target_student_id is not null;

create or replace function public.finance_apply_fee(p_fee_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare f public.finance_fees%rowtype;
declare n integer;
declare actor uuid := private.member_id();
begin
 if not private.finance_access() then raise exception 'Finance access required' using errcode='42501'; end if;
 select * into f from public.finance_fees where id=p_fee_id
  and school_id=private.member_school() for update;
 if not found then raise exception 'Fee not found'; end if;
 if not exists(select 1 from public.academic_terms t
  where t.school_id=f.school_id and t.academic_year=f.academic_year
  and t.term=f.term and t.status='OPEN')
 then raise exception 'Term is not open'; end if;
 insert into public.finance_charges(
  school_id,student_id,academic_year,term,category,description,amount,fee_id,created_by
 )
 select f.school_id,s.id,f.academic_year,f.term,f.category,f.name,f.amount,f.id,actor
 from public.students s
 where s.school_id=f.school_id and s.status='ACTIVE'
   and (f.target_student_id is null or s.id=f.target_student_id)
   and (f.class_id is null or s.class_id=f.class_id)
 on conflict(student_id,fee_id) do nothing;
 get diagnostics n=row_count;
 update public.finance_fees set status='APPLIED' where id=f.id;
 insert into public.finance_events(school_id,actor_id,actor_name,kind,message)
 select f.school_id,actor,u.full_name,'FEE_APPLIED',
 'Applied '||f.name||' to '||n::text||' learner(s)'
 from public.school_users u where u.id=actor;
 return n;
end $$;
revoke all on function public.finance_apply_fee(uuid) from public, anon;
grant execute on function public.finance_apply_fee(uuid) to authenticated;
