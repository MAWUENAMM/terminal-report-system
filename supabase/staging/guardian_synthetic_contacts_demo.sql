-- STAGING-ONLY DEMO CONTACTS. NEVER RUN AGAINST PRODUCTION.
-- These entries are synthetic, NOT genuine guardian permissions or real recipients.
-- Production has no copy of this fixture. Guardian bulk sending is hard-disabled
-- in the staging Edge gateway and central sending remains disabled.
begin;
do $stage_demo$
declare
  sid uuid := 'b9c12275-424d-435e-831c-fd2b70dd65d2';
  operator_id uuid;
  first_ids uuid[];
  n integer;
begin
  if not exists(select 1 from public.schools
    where id=sid and name='EduReport Finance Testing School' and active and deleted_at is null)
    then raise exception 'This fixture may only run in the known staging school'; end if;
  if (select sending_enabled from public.sms_central_settings where singleton=true) is distinct from false
    then raise exception 'Refusing to seed demo contacts with SMS sending active'; end if;
  if exists (select 1 from public.guardian_sms_contacts where school_id=sid) then
    raise exception 'Expected zero guardian contacts; refusing to overwrite any existing records'; end if;
  if (select count(*) from public.students
     where school_id=sid and status='ACTIVE' and admission_number like 'DEMO-%')<>6 then
    raise exception 'The staging school must contain exactly six DEMO learners'; end if;
  select auth_user_id into operator_id from public.platform_operators limit 1;
  if operator_id is null then raise exception 'Missing staging operator'; end if;
  insert into public.guardian_sms_contacts
    (student_id,school_id,guardian_name,phone_e164,consent_status,
     consent_source,consent_recorded_at,consent_recorded_by,updated_by)
  select student.id,sid,
    case student.admission_number
      when 'DEMO-001' then 'STAGING DEMO - Guardian A'
      when 'DEMO-002' then 'STAGING DEMO - Guardian A'
      when 'DEMO-003' then 'STAGING DEMO - Guardian B'
      when 'DEMO-004' then 'STAGING DEMO - Guardian C'
      when 'DEMO-005' then 'STAGING DEMO - Guardian D'
    end as guardian_name,
    case student.admission_number
      when 'DEMO-001' then '+233240000001'
      when 'DEMO-002' then '+233240000001'
      when 'DEMO-003' then '+233240000002'
      when 'DEMO-004' then '+233240000003'
      when 'DEMO-005' then '+233240000004'
    end as phone_e164,
    case when student.admission_number in ('DEMO-001','DEMO-002','DEMO-003')
      then 'OPTED_IN'
      when student.admission_number='DEMO-004' then 'OPTED_OUT'
      else 'PENDING' end,
    case when student.admission_number in ('DEMO-001','DEMO-002','DEMO-003')
      then 'STAGING SYNTHETIC FIXTURE ONLY - NO REAL GUARDIAN CONSENT'
      when student.admission_number='DEMO-004'
      then 'STAGING SYNTHETIC OPT-OUT EXAMPLE - NOT A REAL GUARDIAN'
      else null end,
    case when student.admission_number in ('DEMO-001','DEMO-002','DEMO-003','DEMO-004')
      then now() else null end,
    case when student.admission_number in ('DEMO-001','DEMO-002','DEMO-003','DEMO-004')
      then operator_id else null end,
    operator_id
  from public.students student
  where student.school_id=sid and student.status='ACTIVE'
    and student.admission_number in ('DEMO-001','DEMO-002','DEMO-003','DEMO-004','DEMO-005');
  get diagnostics n = row_count;
  if n<>5 then raise exception 'Expected to seed five example contacts, got %',n; end if;
end $stage_demo$;
commit;
