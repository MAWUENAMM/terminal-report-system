-- Guardian SMS RLS, school boundaries and consent resetting.
-- Disposable local Postgres only. All changes are rolled back.
begin;
insert into public.schools(id,name,academic_year,current_term) values
('d0000000-0000-4000-8000-000000000001','Guardian SMS Test School A','2026/2027',1),
('d0000000-0000-4000-8000-000000000002','Guardian SMS Test School B','2026/2027',1);
insert into public.classes(id,school_id,name,level,academic_year) values
('d0000000-0000-4000-8000-000000000011',
'd0000000-0000-4000-8000-000000000001','Primary One','PRIMARY','2026/2027');
insert into public.students(id,school_id,class_id,admission_number,first_name,last_name,gender,status) values
('d0000000-0000-4000-8000-000000000021',
'd0000000-0000-4000-8000-000000000001',
'd0000000-0000-4000-8000-000000000011',
'G-SMS-001','Sample','Learner','F','ACTIVE');
insert into public.guardian_sms_contacts(student_id,school_id,guardian_name,phone_e164,consent_status)
values('d0000000-0000-4000-8000-000000000021',
'd0000000-0000-4000-8000-000000000001',
'Sample Guardian','+233241111111','OPTED_OUT');
update public.guardian_sms_contacts set phone_e164='+233241111112'
where student_id='d0000000-0000-4000-8000-000000000021';
do $tests$
begin
  if (select consent_status from public.guardian_sms_contacts
    where student_id='d0000000-0000-4000-8000-000000000021')<>'PENDING' then
    raise exception 'Changing guardian phone must reset consent';
  end if;
  if has_table_privilege('authenticated','public.guardian_sms_contacts','SELECT')
    or has_table_privilege('authenticated','public.guardian_sms_campaigns','INSERT')
    or has_table_privilege('authenticated','public.guardian_sms_recipients','UPDATE')
    or has_function_privilege('authenticated',
      'public.guardian_sms_prepare_draft(uuid,uuid,uuid,text,text,integer,uuid[])',
      'EXECUTE') or has_function_privilege('authenticated',
      'public.guardian_sms_authorize_campaign(uuid,uuid)','EXECUTE') then
    raise exception 'School users must not directly read, queue or activate messages';
  end if;
  begin
    update public.guardian_sms_contacts
      set school_id='d0000000-0000-4000-8000-000000000002'
      where student_id='d0000000-0000-4000-8000-000000000021';
    raise exception 'Cross-school contact update unexpectedly allowed';
  exception when others then
    if sqlerrm='Cross-school contact update unexpectedly allowed' then raise; end if;
  end;
  if (select sending_enabled from public.sms_central_settings where singleton=true) then
    -- Local migration defaults to off.
    raise exception 'Guardian test must never activate SMS sending';
  end if;
end $tests$;
rollback;
