-- Platform controls are separate from school administrator permissions.
-- Deletion is reversible: memberships, learner records and reports are retained.
alter table public.schools add column active boolean not null default true;
alter table public.schools add column deleted_at timestamptz;
alter table public.schools add column status_reason text not null default '' check(length(status_reason)<=500);
alter table public.schools add column status_changed_at timestamptz not null default now();
alter table public.schools add constraint deleted_school_inactive check(deleted_at is null or not active);

create table public.school_events (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 actor_id uuid references auth.users(id) on delete set null,
 actor_name text not null,
 action text not null check(action in ('CREATED','EDITED','ACTIVATED','DEACTIVATED','DELETED','RESTORED')),
 reason text not null default '', details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index school_events_school_date on public.school_events(school_id,created_at desc);
create index school_events_actor on public.school_events(actor_id);
alter table public.school_events enable row level security;
revoke all on public.school_events from anon,authenticated;
grant select on public.school_events to authenticated;
grant all on public.school_events to service_role;
create policy school_events_operator on public.school_events for select to authenticated using((select private.is_operator()));

-- Membership checks read live school status, so existing tokens lose school access too.
create or replace function private.member_school() returns uuid language sql stable security definer set search_path='' as $$
 select u.school_id from public.school_users u join public.schools s on s.id=u.school_id
 where u.auth_user_id=(select auth.uid()) and u.active and not u.must_change_password and s.active and s.deleted_at is null limit 1
$$;
create or replace function private.member_id() returns uuid language sql stable security definer set search_path='' as $$
 select u.id from public.school_users u join public.schools s on s.id=u.school_id
 where u.auth_user_id=(select auth.uid()) and u.active and not u.must_change_password and s.active and s.deleted_at is null limit 1
$$;
create or replace function private.member_role() returns text language sql stable security definer set search_path='' as $$
 select u.role from public.school_users u join public.schools s on s.id=u.school_id
 where u.auth_user_id=(select auth.uid()) and u.active and not u.must_change_password and s.active and s.deleted_at is null limit 1
$$;
-- A suspended member may still read their school's identity/status to see a useful message.
-- This grants no access to academic data or school updates.
create function private.profile_school() returns uuid language sql stable security definer set search_path='' as $$
 select school_id from public.school_users where auth_user_id=(select auth.uid()) and active and not must_change_password limit 1
$$;
revoke all on function private.profile_school() from public,anon;
grant execute on function private.profile_school() to authenticated;
alter policy own_school_read on public.schools using(id=(select private.profile_school()));

create function private.platform_schools(search_text text, status_filter text, page_number integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.is_operator() then raise exception 'Platform administrator access required.'; end if;
 if status_filter is null or status_filter not in ('ALL','ACTIVE','INACTIVE','DELETED') or page_number is null or page_number<0 or page_number>100000 or search_text is null or length(search_text)>150 then raise exception 'Invalid school filter.'; end if;
 with filtered as (
  select s.* from public.schools s
  where (case status_filter when 'DELETED' then s.deleted_at is not null when 'ACTIVE' then s.active and s.deleted_at is null when 'INACTIVE' then not s.active and s.deleted_at is null else s.deleted_at is null end)
  and (search_text='' or position(lower(search_text) in lower(s.name||' '||coalesce(s.email,'')||' '||coalesce(s.district,'')||' '||coalesce(s.region,'')))>0)
 ), page as (select * from filtered order by lower(name),id limit 25 offset page_number*25)
 select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((
  select jsonb_agg(to_jsonb(p)||jsonb_build_object(
   'staff_count',(select count(*) from public.school_users u where u.school_id=p.id),
   'learner_count',(select count(*) from public.students u where u.school_id=p.id),
   'class_count',(select count(*) from public.classes c where c.school_id=p.id),
   'administrators',coalesce((select jsonb_agg(jsonb_build_object('full_name',u.full_name,'email',u.email,'active',u.active) order by u.full_name) from public.school_users u where u.school_id=p.id and u.role='ADMIN'),'[]'::jsonb)
  ) order by lower(p.name),p.id) from page p),'[]'::jsonb),
  'counts',jsonb_build_object('active',(select count(*) from public.schools where active and deleted_at is null),
    'inactive',(select count(*) from public.schools where not active and deleted_at is null),
    'deleted',(select count(*) from public.schools where deleted_at is not null))) into result;
 return result;
end $$;
create function public.platform_schools(search_text text default '',status_filter text default 'ALL',page_number integer default 0) returns jsonb
language sql security invoker set search_path='' as $$ select private.platform_schools(search_text,status_filter,page_number) $$;

-- One validator is used by manual creation and editing; unknown fields are never assigned.
create function private.school_details(details jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text; v text; result jsonb='{}'; max_length integer;
begin
 if details is null or jsonb_typeof(details)<>'object' then raise exception 'School details are required.'; end if;
 foreach k in array array['name','address','phone','email','headteacher_name','district','region'] loop
  v=trim(coalesce(details->>k,''));
  max_length=case k when 'address' then 500 when 'email' then 254 when 'phone' then 35 else 150 end;
  if length(v)>max_length or (k='name' and length(v)<2) then raise exception 'Invalid school %.',k; end if;
  if k='email' then
   v=lower(v);
   if v<>'' and v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid school contact email.'; end if;
  end if;
  result=result||jsonb_build_object(k,v);
 end loop;
 return result;
end $$;
revoke all on function private.school_details(jsonb) from public,anon,authenticated;

create function private.platform_update_school(target_id uuid, operation text, details jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare s public.schools; d jsonb; explanation text=trim(coalesce(details->>'reason','')); event_action text;
begin
 if auth.uid() is null or not private.is_operator() then raise exception 'Platform administrator access required.'; end if;
 select * into s from public.schools where id=target_id for update;
 if not found then raise exception 'School not found.'; end if;
 if length(explanation)>500 then raise exception 'Keep the reason within 500 characters.'; end if;
 if operation is null or operation not in ('EDIT','ACTIVATE','DEACTIVATE','DELETE','RESTORE') then raise exception 'Unknown school action.'; end if;
 if s.deleted_at is not null and operation<>'RESTORE' then raise exception 'Restore this school before changing it.'; end if;
 if operation='EDIT' then
  d=private.school_details(details);
  update public.schools set name=d->>'name',address=d->>'address',phone=d->>'phone',email=d->>'email',headteacher_name=d->>'headteacher_name',district=d->>'district',region=d->>'region' where id=s.id;
  event_action='EDITED';
 elsif operation='ACTIVATE' then
  if s.active then raise exception 'This school is already active.'; end if;
  update public.schools set active=true,status_reason=explanation,status_changed_at=now() where id=s.id;
  event_action='ACTIVATED';
 elsif operation='DEACTIVATE' then
  if not s.active then raise exception 'This school is already inactive.'; end if;
  if length(explanation)<5 then raise exception 'Give a reason for deactivating the school (at least 5 characters).'; end if;
  update public.schools set active=false,status_reason=explanation,status_changed_at=now() where id=s.id;
  event_action='DEACTIVATED';
 elsif operation='DELETE' then
  if (details->>'confirmation') is distinct from s.name then raise exception 'Type the school name exactly to confirm deletion.'; end if;
  if length(explanation)<5 then raise exception 'Give a reason for deleting the school (at least 5 characters).'; end if;
  update public.schools set active=false,deleted_at=now(),status_reason=explanation,status_changed_at=now() where id=s.id;
  event_action='DELETED';
 else
  if s.deleted_at is null then raise exception 'This school has not been deleted.'; end if;
  -- Restoration never silently grants access. Activation is a separate decision.
  update public.schools set active=false,deleted_at=null,status_reason=explanation,status_changed_at=now() where id=s.id;
  event_action='RESTORED';
 end if;
 insert into public.school_events(school_id,actor_id,actor_name,action,reason,details)
 select s.id,auth.uid(),u.full_name,event_action,explanation,
  jsonb_build_object('before',to_jsonb(s),'after',(select to_jsonb(t) from public.schools t where t.id=s.id))
 from public.school_users u where u.auth_user_id=auth.uid();
end $$;
create function public.platform_update_school(target_id uuid,operation text,details jsonb default '{}') returns void
language sql security invoker set search_path='' as $$ select private.platform_update_school(target_id,operation,details) $$;

-- The Edge Function creates the Auth identity; this transaction provisions the entire
-- school and (when applicable) approves the request atomically under the operator's JWT.
create function private.platform_create_school(identity_id uuid, admin_name text, admin_email text, details jsonb, request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare d jsonb; sid uuid; yr text=details->>'academic_year'; tm smallint=(details->>'current_term')::smallint; enabled boolean=coalesce((details->>'active')::boolean,true); entry public.school_requests;
begin
 if auth.uid() is null or not private.is_operator() then raise exception 'Platform administrator access required.'; end if;
 d=private.school_details(details);
 if admin_name is null or length(trim(admin_name)) not between 2 and 120 or admin_email is null or lower(admin_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(admin_email)>254 then raise exception 'Enter a valid initial administrator name and email.'; end if;
 if yr is null or yr !~ '^[0-9]{4}/[0-9]{4}$' or split_part(yr,'/',2)::integer<>split_part(yr,'/',1)::integer+1 or tm is null or tm not between 1 and 3 then raise exception 'Choose a valid academic year and term.'; end if;
 if not exists(select 1 from auth.users where id=identity_id and lower(email)=lower(admin_email)) or exists(select 1 from public.school_users where auth_user_id=identity_id) then raise exception 'A new administrator account is required.'; end if;
 if request_id is not null then
  select * into entry from public.school_requests where id=request_id for update;
  if not found or entry.status<>'PENDING' or entry.kind<>'ACCESS' or lower(entry.email)<>lower(admin_email) then raise exception 'This school request is no longer available for approval.'; end if;
 end if;
 insert into public.schools(name,address,phone,email,headteacher_name,district,region,academic_year,current_term,active)
 values(d->>'name',d->>'address',d->>'phone',d->>'email',d->>'headteacher_name',d->>'district',d->>'region',yr,tm,enabled) returning id into sid;
 insert into public.school_users(auth_user_id,school_id,email,full_name,role,must_change_password)
 values(identity_id,sid,lower(admin_email),trim(admin_name),'ADMIN',true);
 insert into public.academic_terms(school_id,academic_year,term) values(sid,yr,tm);
 if request_id is not null then update public.school_requests set status='APPROVED',school_id=sid where id=request_id; end if;
 insert into public.school_events(school_id,actor_id,actor_name,action,details)
 select sid,auth.uid(),full_name,'CREATED',jsonb_build_object('source',case when request_id is null then 'PLATFORM' else 'REQUEST' end,'request_id',request_id)
 from public.school_users where auth_user_id=auth.uid();
 return sid;
end $$;
create function public.platform_create_school(identity_id uuid,admin_name text,admin_email text,details jsonb,request_id uuid default null) returns uuid
language sql security invoker set search_path='' as $$ select private.platform_create_school(identity_id,admin_name,admin_email,details,request_id) $$;

revoke all on function private.platform_schools(text,text,integer),public.platform_schools(text,text,integer),private.platform_update_school(uuid,text,jsonb),public.platform_update_school(uuid,text,jsonb),private.platform_create_school(uuid,text,text,jsonb,uuid),public.platform_create_school(uuid,text,text,jsonb,uuid) from public,anon;
grant execute on function private.platform_schools(text,text,integer),public.platform_schools(text,text,integer),private.platform_update_school(uuid,text,jsonb),public.platform_update_school(uuid,text,jsonb),private.platform_create_school(uuid,text,text,jsonb,uuid),public.platform_create_school(uuid,text,text,jsonb,uuid) to authenticated;

create or replace function private.refresh_statistics() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.public_statistics set
 schools=(select count(*) from public.schools where active and deleted_at is null),
 classes=(select count(*) from public.classes c join public.schools s on s.id=c.school_id where s.active and s.deleted_at is null),
 learners=(select count(*) from public.students u join public.schools s on s.id=u.school_id where u.status='ACTIVE' and s.active and s.deleted_at is null),updated_at=now() where id;
 return null;
end $$;
-- Existing schools stay active; this refreshes totals without changing their records.
update public.schools set active=active where false;
