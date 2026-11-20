-- Guardian messaging lifecycle & security regression
-- Disposable local Supabase database ONLY; all fixture rows are rolled back.
-- Never contacts Arkesel or a real parent.
begin;

create function pg_temp.guardian_expect(ok boolean, label text)
returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;

insert into public.schools(id,name,academic_year,current_term) values
 ('c1000000-0000-4000-8000-000000000001','Guardian lifecycle school A','2026/2027',1),
 ('c1000000-0000-4000-8000-000000000002','Guardian lifecycle school B','2026/2027',1);
insert into auth.users(id,email) values
 ('c1100000-0000-4000-8000-000000000001','guardian-admin-a@example.invalid'),
 ('c1100000-0000-4000-8000-000000000002','guardian-admin-b@example.invalid'),
 ('c1100000-0000-4000-8000-000000000003','guardian-teacher@example.invalid');
insert into public.school_users(id,auth_user_id,school_id,full_name,email,role) values
 ('c1100000-0000-4000-8000-000000000001','c1100000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001','Guardian Admin A','guardian-admin-a@example.invalid','ADMIN'),
 ('c1100000-0000-4000-8000-000000000002','c1100000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000002','Guardian Admin B','guardian-admin-b@example.invalid','ADMIN'),
 ('c1100000-0000-4000-8000-000000000003','c1100000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000001','Guardian Teacher','guardian-teacher@example.invalid','CLASS_TEACHER');
insert into public.classes(id,school_id,name,level,academic_year) values
 ('c1200000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Primary 1','PRIMARY','2026/2027'),
 ('c1200000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','Primary 2','PRIMARY','2026/2027');
insert into public.students(id,school_id,admission_number,first_name,last_name,gender,class_id) values
 ('c1300000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  'G-LIFE-001','Sibling','One','F','c1200000-0000-4000-8000-000000000001'),
 ('c1300000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001',
  'G-LIFE-002','Sibling','Two','M','c1200000-0000-4000-8000-000000000001'),
 ('c1300000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001',
  'G-LIFE-003','Learner','Three','F','c1200000-0000-4000-8000-000000000001'),
 ('c1300000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000001',
  'G-LIFE-004','Learner','Four','M','c1200000-0000-4000-8000-000000000001'),
 ('c1300000-0000-4000-8000-000000000005','c1000000-0000-4000-8000-000000000002',
  'G-LIFE-005','Other','School','F','c1200000-0000-4000-8000-000000000002');

insert into public.guardian_sms_contacts
 (student_id,school_id,guardian_name,phone_e164,consent_status,
  consent_source,consent_recorded_at,consent_recorded_by,updated_by)
values
 ('c1300000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  'Synthetic Guardian 1','+233240000001','OPTED_IN',
  'SYNTHETIC CI fixture - not real guardian consent',now(),
  'c1100000-0000-4000-8000-000000000001','c1100000-0000-4000-8000-000000000001'),
 ('c1300000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001',
  'Synthetic Guardian 1','+233240000001','OPTED_IN',
  'SYNTHETIC CI fixture - not real guardian consent',now(),
  'c1100000-0000-4000-8000-000000000001','c1100000-0000-4000-8000-000000000001'),
 ('c1300000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001',
  'Synthetic Guardian 2','+233240000002','OPTED_IN',
  'SYNTHETIC CI fixture - not real guardian consent',now(),
  'c1100000-0000-4000-8000-000000000001','c1100000-0000-4000-8000-000000000001'),
 ('c1300000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000001',
  'Synthetic Guardian 3','+233240000003','PENDING',
  null,null,null,'c1100000-0000-4000-8000-000000000001');

do $test$
declare
  a uuid := 'c1000000-0000-4000-8000-000000000001';
  operator_a uuid := 'c1100000-0000-4000-8000-000000000001';
  other_admin uuid := 'c1100000-0000-4000-8000-000000000002';
  teacher uuid := 'c1100000-0000-4000-8000-000000000003';
  children uuid[] := array[
    'c1300000-0000-4000-8000-000000000001'::uuid,
    'c1300000-0000-4000-8000-000000000002'::uuid,
    'c1300000-0000-4000-8000-000000000003'::uuid,
    'c1300000-0000-4000-8000-000000000004'::uuid
  ];
  key uuid := gen_random_uuid();
  result jsonb;
  campaign uuid;
  count_recipients int;
  blocked boolean;
begin
  perform pg_temp.guardian_expect(
    (select count(distinct phone_e164)=2 from public.guardian_sms_contacts
     where school_id=a and consent_status='OPTED_IN'),
    'Three opted-in learners map to only two unique recipients');
  perform pg_temp.guardian_expect(
    not has_table_privilege('authenticated','public.guardian_sms_recipients','INSERT')
    and not has_function_privilege('authenticated',
       'public.guardian_sms_authorize_campaign(uuid,uuid)','EXECUTE'),
    'No client access to SMS outbox or authorization');

  result:=public.guardian_sms_prepare_draft(a,key,operator_a,'EDUREPORT',
    'Synthetic school announcement, not sent to a real phone',1,children);
  campaign:=(result->>'id')::uuid;
  perform pg_temp.guardian_expect(result->>'duplicate'='false'
    and (result->>'recipient_count')::int=2,'Draft queues two unique phones, not four learners');
  perform pg_temp.guardian_expect(
    (select count(*)=2 from public.guardian_sms_recipients where campaign_id=campaign and status='DRAFT'),
    'Both recipients remain draft-only');
  perform pg_temp.guardian_expect(
    (select cardinality(student_ids)=2 from public.guardian_sms_recipients
       where campaign_id=campaign and phone_e164='+233240000001'),
    'Shared guardian phone contains both sibling IDs');
  result:=public.guardian_sms_prepare_draft(a,key,operator_a,'EDUREPORT',
    'Synthetic school announcement, not sent to a real phone',1,children);
  perform pg_temp.guardian_expect(result->>'duplicate'='true'
    and (result->>'id')::uuid=campaign,
    'Repeated request reuses same campaign and cannot charge twice');

  blocked:=false;
  begin
    perform public.guardian_sms_prepare_draft(a,gen_random_uuid(),operator_a,
      'EDUREPORT','Cross school',1,array['c1300000-0000-4000-8000-000000000005'::uuid]);
  exception when others then blocked:=true; end;
  perform pg_temp.guardian_expect(blocked,'Cannot include another school learner');

  blocked:=false;
  begin
    perform public.guardian_sms_prepare_draft(a,gen_random_uuid(),other_admin,
      'EDUREPORT','Cross school',1,children);
  exception when others then blocked:=true; end;
  perform pg_temp.guardian_expect(blocked,'Another school administrator cannot create draft');

  blocked:=false;
  begin
    perform public.guardian_sms_prepare_draft(a,gen_random_uuid(),teacher,
      'EDUREPORT','Not authorized role',1,children);
  exception when others then blocked:=true; end;
  perform pg_temp.guardian_expect(blocked,'Class teacher cannot create parent message');

  blocked:=false;
  begin
    perform public.guardian_sms_authorize_campaign(campaign,operator_a);
  exception when others then
    blocked:=sqlerrm like '%sending remains disabled%'; end;
  perform pg_temp.guardian_expect(blocked,'Sending must be disabled by default in staging');

  -- Simulate activation and queue INSIDE uncommitted local transaction ONLY.
  -- No SMS provider is called and rollback restores the disabled state.
  update public.sms_central_settings
  set sending_enabled=true,global_daily_limit=20,school_daily_limit=20
  where singleton=true;
  blocked:=false;
  begin
    perform public.guardian_sms_authorize_campaign(campaign,other_admin);
  exception when others then blocked:=true; end;
  perform pg_temp.guardian_expect(blocked,'Other school admin cannot authorize draft');

  result:=public.guardian_sms_authorize_campaign(campaign,operator_a);
  perform pg_temp.guardian_expect((result->>'queued')::int=2,'Campaign reserves two queue slots');
  select count(*) into count_recipients from public.guardian_sms_claim_batch(campaign,1);
  perform pg_temp.guardian_expect(count_recipients=1,'First atomic claim processes only one recipient');
  select count(*) into count_recipients from public.guardian_sms_claim_batch(campaign,1);
  perform pg_temp.guardian_expect(count_recipients=1,'Second claim processes the second recipient');
  select count(*) into count_recipients from public.guardian_sms_claim_batch(campaign,1);
  perform pg_temp.guardian_expect(count_recipients=0,'Third claim cannot duplicate a provider send');

  -- Once a phone changes, consent must revert to PENDING.
  update public.guardian_sms_contacts set phone_e164='+233240000004'
  where student_id='c1300000-0000-4000-8000-000000000003';
  perform pg_temp.guardian_expect(
    (select consent_status='PENDING' and consent_source is null
     from public.guardian_sms_contacts
     where student_id='c1300000-0000-4000-8000-000000000003'),
    'Phone changes always reset previous consent');
  -- A phone-wide OPTED_OUT must block siblings despite another OPTED_IN.
  update public.guardian_sms_contacts
  set consent_status='OPTED_OUT',consent_source='SYNTHETIC fixture opt out'
  where student_id='c1300000-0000-4000-8000-000000000002';
  blocked:=false;
  begin
    perform public.guardian_sms_prepare_draft(a,gen_random_uuid(),operator_a,
      'EDUREPORT','Phone-wide opt out should block siblings',1,
      array['c1300000-0000-4000-8000-000000000001'::uuid]);
  exception when others then
    blocked:=sqlerrm like '%No opted-in guardians%'; end;
  perform pg_temp.guardian_expect(blocked,'One linked opt-out blocks same guardian phone');
end $test$;
rollback;
