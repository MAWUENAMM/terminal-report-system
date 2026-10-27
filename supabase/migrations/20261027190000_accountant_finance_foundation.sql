-- Accountant & School Finance foundation. Staged: NOT applied to production.
-- Money is numeric(12,2), never floating point. Completed payments are reversible, never deleted.
alter table public.school_users drop constraint if exists school_users_role_check;
alter table public.school_users add constraint school_users_role_check
  check (role in ('ADMIN','ACCOUNTANT','HEADTEACHER','CLASS_TEACHER','SUBJECT_TEACHER'));

create policy accountant_classes_read on public.classes for select to authenticated
  using (school_id=(select private.member_school()) and (select private.member_role())='ACCOUNTANT');
create policy accountant_students_read on public.students for select to authenticated
  using (school_id=(select private.member_school()) and (select private.member_role())='ACCOUNTANT');

create table public.finance_fees (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 academic_year text not null check(length(trim(academic_year)) between 4 and 20),
 term smallint not null check(term between 1 and 3),
 class_id uuid,
 name text not null check(length(trim(name)) between 2 and 150),
 amount numeric(12,2) not null check(amount>0 and amount<=99999999),
 status text not null default 'DRAFT' check(status in ('DRAFT','APPLIED')),
 created_by uuid not null references public.school_users(id),
 created_at timestamptz not null default now(),
 unique(id, school_id),
 foreign key(class_id, school_id) references public.classes(id, school_id)
);

create table public.finance_items (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 name text not null check(length(trim(name)) between 2 and 150),
 description text not null default '',
 unit_price numeric(12,2) not null check(unit_price>=0 and unit_price<=99999999),
 stock_quantity integer not null default 0 check(stock_quantity>=0),
 image_path text,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id, school_id)
);

create table public.finance_sales (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null,
 item_id uuid not null,
 quantity integer not null check(quantity between 1 and 100000),
 request_key uuid not null unique,
 unit_price numeric(12,2) not null check(unit_price>=0),
 total numeric(12,2) generated always as (quantity * unit_price) stored,
 created_by uuid not null references public.school_users(id),
 created_at timestamptz not null default now(),
 unique(id, school_id),
 foreign key(student_id,school_id) references public.students(id,school_id),
 foreign key(item_id,school_id) references public.finance_items(id,school_id)
);

create table public.finance_charges (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null,
 academic_year text not null,
 term smallint not null check(term between 1 and 3),
 category text not null check(category in ('FEE','OTHER','ITEM')),
 description text not null,
 amount numeric(12,2) not null check(amount>0 and amount<=99999999),
 fee_id uuid,
 sale_id uuid,
 created_by uuid not null references public.school_users(id),
 created_at timestamptz not null default now(),
 voided_at timestamptz,
 void_reason text,
 unique(id, school_id),
 unique(student_id,fee_id),
 unique(sale_id),
 foreign key(student_id,school_id) references public.students(id,school_id),
 foreign key(fee_id,school_id) references public.finance_fees(id,school_id),
 foreign key(sale_id,school_id) references public.finance_sales(id,school_id),
 check ((category='ITEM' and sale_id is not null and fee_id is null) or
        (category in ('FEE','OTHER') and sale_id is null))
);

create table public.finance_payments (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null,
 amount numeric(12,2) not null check(amount>0 and amount<=99999999),
 request_key uuid not null unique,
 method text not null check(method in ('CASH','MOMO','BANK','CHEQUE','OTHER')),
 reference text not null default '',
 note text not null default '',
 receipt_number text not null unique
   default ('ER-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 created_by uuid not null references public.school_users(id),
 created_at timestamptz not null default now(),
 voided_at timestamptz,
 voided_by uuid references public.school_users(id),
 void_reason text,
 unique(id,school_id),
 foreign key(student_id,school_id) references public.students(id,school_id)
);

create table public.finance_allocations (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 payment_id uuid not null,
 charge_id uuid not null,
 amount numeric(12,2) not null check(amount>0),
 unique(payment_id,charge_id),
 foreign key(payment_id,school_id) references public.finance_payments(id,school_id),
 foreign key(charge_id,school_id) references public.finance_charges(id,school_id)
);

create table public.finance_events (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 actor_id uuid not null references public.school_users(id),
 actor_name text not null,
 kind text not null check(kind in ('FEE_CREATED','FEE_UPDATED','FEE_DELETED','FEE_APPLIED','PAYMENT_RECEIVED','PAYMENT_VOIDED','PAYMENT_NOTICE','SALE','ITEM_CREATED','ITEM_UPDATED','ITEM_DELETED')),
 payment_id uuid,
 message text not null,
 created_at timestamptz not null default now(),
 foreign key(payment_id,school_id) references public.finance_payments(id,school_id)
);

create table public.finance_event_reads (
 event_id uuid not null references public.finance_events(id) on delete cascade,
 user_id uuid not null references public.school_users(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(event_id,user_id)
);

create index finance_fees_school_term_idx on public.finance_fees(school_id,academic_year,term);
create index finance_charges_student_idx on public.finance_charges(school_id,student_id,created_at);
create index finance_payments_student_idx on public.finance_payments(school_id,student_id,created_at desc);
create index finance_allocations_charge_idx on public.finance_allocations(charge_id);
create index finance_sales_student_idx on public.finance_sales(school_id,student_id);
create index finance_events_recent_idx on public.finance_events(school_id,created_at desc);

-- Data API minimum surface. All money-changing writes use validated RPCs.
-- Draft fees and inventory may be edited directly, but payment/charge/sale ledgers cannot.
do $$
declare t text;
begin
 foreach t in array array['finance_fees','finance_items','finance_sales','finance_charges','finance_payments','finance_allocations','finance_events','finance_event_reads'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public,anon,authenticated',t);
  execute format('grant select on table public.%I to authenticated',t);
 end loop;
end $$;
grant insert on public.finance_fees,public.finance_items,public.finance_event_reads to authenticated;
grant delete on public.finance_fees,public.finance_items to authenticated;
grant update(name,amount) on public.finance_fees to authenticated;
grant update(name,description,unit_price,stock_quantity,image_path,active) on public.finance_items to authenticated;

create or replace function private.finance_access()
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and
   (select private.member_role()) in ('ADMIN','ACCOUNTANT') and
   (select private.member_school()) is not null
$$;
revoke all on function private.finance_access() from public;
grant execute on function private.finance_access() to authenticated;

create policy finance_fee_read on public.finance_fees for select to authenticated
 using (school_id=(select private.member_school()) and (select private.finance_access()));
create policy finance_fee_insert on public.finance_fees for insert to authenticated
 with check (school_id=(select private.member_school()) and (select private.finance_access())
    and created_by=(select private.member_id()) and status='DRAFT');
create policy finance_fee_edit on public.finance_fees for update to authenticated
 using (school_id=(select private.member_school()) and (select private.finance_access()) and status='DRAFT')
 with check (school_id=(select private.member_school()) and (select private.finance_access()) and status='DRAFT');
create policy finance_fee_delete on public.finance_fees for delete to authenticated
 using (school_id=(select private.member_school()) and (select private.finance_access()) and status='DRAFT');

create policy finance_item_read on public.finance_items for select to authenticated
 using (school_id=(select private.member_school()) and (select private.finance_access()));
create policy finance_item_insert on public.finance_items for insert to authenticated
 with check (school_id=(select private.member_school()) and (select private.finance_access()));
create policy finance_item_update on public.finance_items for update to authenticated
 using (school_id=(select private.member_school()) and (select private.finance_access()))
 with check (school_id=(select private.member_school()) and (select private.finance_access()));
create policy finance_item_delete on public.finance_items for delete to authenticated
 using (school_id=(select private.member_school()) and (select private.finance_access())
   and not exists(select 1 from public.finance_sales s where s.item_id=id));

do $$
declare t text;
begin
 foreach t in array array['finance_sales','finance_charges','finance_payments','finance_allocations','finance_events'] loop
 execute format('create policy %I on public.%I for select to authenticated using (school_id=(select private.member_school()) and (select private.finance_access()))',t||'_read',t);
 end loop;
end $$;

create policy finance_event_reads_select on public.finance_event_reads for select to authenticated
 using (user_id=(select private.member_id()) and
  exists(select 1 from public.finance_events e where e.id=event_id and e.school_id=(select private.member_school()))
 );
create policy finance_event_reads_insert on public.finance_event_reads for insert to authenticated
 with check (user_id=(select private.member_id()) and (select private.finance_access())
  and exists(select 1 from public.finance_events e where e.id=event_id and e.school_id=(select private.member_school())));

-- Private image storage: schools/<school-id>/items/<item-id>/image
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('finance-items','finance-items',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;

create policy finance_item_image_read on storage.objects for select to authenticated
using(bucket_id='finance-items' and (select private.finance_access())
 and name = 'schools/' || (select private.member_school())::text || '/items/' || (storage.foldername(name))[4] || '/image'
 and (storage.foldername(name))[3]='items'
 and exists(select 1 from public.finance_items i where i.id::text=(storage.foldername(name))[4] and i.school_id=(select private.member_school()))
);
create policy finance_item_image_insert on storage.objects for insert to authenticated
with check(bucket_id='finance-items' and (select private.finance_access())
 and name = 'schools/' || (select private.member_school())::text || '/items/' || (storage.foldername(name))[4] || '/image'
 and (storage.foldername(name))[3]='items'
 and exists(select 1 from public.finance_items i where i.id::text=(storage.foldername(name))[4] and i.school_id=(select private.member_school()))
);
create policy finance_item_image_update on storage.objects for update to authenticated
using(bucket_id='finance-items' and (select private.finance_access())
 and name = 'schools/' || (select private.member_school())::text || '/items/' || (storage.foldername(name))[4] || '/image')
with check(bucket_id='finance-items' and (select private.finance_access())
 and name = 'schools/' || (select private.member_school())::text || '/items/' || (storage.foldername(name))[4] || '/image');
create policy finance_item_image_delete on storage.objects for delete to authenticated
using(bucket_id='finance-items' and (select private.finance_access())
 and name = 'schools/' || (select private.member_school())::text || '/items/' || (storage.foldername(name))[4] || '/image');

-- SECURITY DEFINER is restricted to these four atomic, explicitly authenticated RPC entry points.
-- Every function checks the current member's school and finance role, uses a locked student or item row,
-- and writes the actor from auth context. No service-role credentials are exposed.
create or replace function public.finance_apply_fee(p_fee_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare f public.finance_fees%rowtype;
declare n integer;
declare actor uuid := private.member_id();
begin
 if not private.finance_access() then raise exception 'Finance access required' using errcode='42501'; end if;
 select * into f from public.finance_fees where id=p_fee_id and school_id=private.member_school() for update;
 if not found then raise exception 'Fee not found'; end if;
 if not exists(select 1 from public.academic_terms t where t.school_id=f.school_id and t.academic_year=f.academic_year and t.term=f.term and t.status='OPEN')
 then raise exception 'Term is not open'; end if;
 insert into public.finance_charges(school_id,student_id,academic_year,term,category,description,amount,fee_id,created_by)
 select f.school_id,s.id,f.academic_year,f.term,'FEE',f.name,f.amount,f.id,actor
 from public.students s where s.school_id=f.school_id and s.status='ACTIVE'
 and (f.class_id is null or s.class_id=f.class_id)
 on conflict(student_id,fee_id) do nothing;
 get diagnostics n=row_count;
 update public.finance_fees set status='APPLIED' where id=f.id;
 insert into public.finance_events(school_id,actor_id,actor_name,kind,message)
 select f.school_id,actor,u.full_name,'FEE_APPLIED',
 'Applied '|| f.name || ' to ' || n::text || ' learner(s)'
 from public.school_users u where u.id=actor;
 return n;
end $$;

create or replace function public.finance_sell_item(p_item_id uuid,p_student_id uuid,p_quantity integer,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare i public.finance_items%rowtype;
declare sid uuid:=private.member_school();
declare actor uuid:=private.member_id();
declare sale_id uuid;
declare school public.schools%rowtype;
begin
 if not private.finance_access() then raise exception 'Finance access required' using errcode='42501'; end if;
 if p_quantity is null or p_quantity<1 or p_quantity>10000 or p_request_key is null then raise exception 'Invalid sale request'; end if;
 select * into i from public.finance_items where id=p_item_id and school_id=sid and active for update;
 if not found then raise exception 'Active item not found'; end if;
 select s.id into sale_id from public.finance_sales s
 where s.request_key=p_request_key and s.school_id=sid
   and s.item_id=p_item_id and s.student_id=p_student_id and s.quantity=p_quantity;
 if found then return sale_id; end if;
 if exists(select 1 from public.finance_sales s where s.request_key=p_request_key)
 then raise exception 'Sale request key already used with different details'; end if;
 if i.stock_quantity<p_quantity then raise exception 'Insufficient stock'; end if;
 perform 1 from public.students s where s.id=p_student_id and s.school_id=sid and s.status='ACTIVE';
 if not found then raise exception 'Student not found'; end if;
 select id into payment_id from public.finance_payments
 where request_key=p_request_key and school_id=sid and student_id=p_student_id
 and amount=p_amount and method=p_method
 and reference=coalesce(p_reference,'') and note=coalesce(p_note,'');
 if found then return payment_id; end if;
 if exists(select 1 from public.finance_payments where request_key=p_request_key)
 then raise exception 'Payment request key already used with different details'; end if;
 select * into school from public.schools where id=sid;
 if i.unit_price<=0 then raise exception 'Item must have a positive price before sale'; end if;
 insert into public.finance_sales(school_id,student_id,item_id,quantity,unit_price,created_by,request_key)
 values(sid,p_student_id,i.id,p_quantity,i.unit_price,actor,p_request_key) returning id into sale_id;
 insert into public.finance_charges(school_id,student_id,academic_year,term,category,description,amount,sale_id,created_by)
 values(sid,p_student_id,school.academic_year,school.current_term,'ITEM',i.name||' × '||p_quantity,(i.unit_price*p_quantity),sale_id,actor);
 update public.finance_items set stock_quantity=stock_quantity-p_quantity where id=i.id;
 insert into public.finance_events(school_id,actor_id,actor_name,kind,message)
 select sid,actor,u.full_name,'SALE', 'Sold '||p_quantity||' × '||i.name
 from public.school_users u where u.id=actor;
 return sale_id;
end $$;

create or replace function public.finance_record_payment(
 p_student_id uuid,p_amount numeric,p_method text,p_reference text default '',p_note text default '',p_request_key uuid default null
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=private.member_school();
declare actor uuid:=private.member_id();
declare payment_id uuid;
declare remaining numeric(12,2);
declare allocation numeric(12,2);
declare c record;
declare sch public.schools%rowtype;
begin
 if not private.finance_access() then raise exception 'Finance access required' using errcode='42501'; end if;
 if p_request_key is null or p_amount is null or p_amount<=0 or p_amount>99999999 or round(p_amount,2)<>p_amount then raise exception 'Invalid payment request'; end if;
 if p_method not in ('CASH','MOMO','BANK','CHEQUE','OTHER') then raise exception 'Invalid payment method'; end if;
 if length(coalesce(p_reference,''))>120 or length(coalesce(p_note,''))>500 then raise exception 'Payment notes too long'; end if;
 perform 1 from public.students s where s.id=p_student_id and s.school_id=sid for update;
 if not found then raise exception 'Student not found'; end if;
 select * into sch from public.schools where id=sid;
 remaining:=p_amount;
 -- Keep a single student-row lock for all pay/sell/void operations to serialize balance updates.
 for c in
  select ch.id, ch.amount-coalesce(sum(a.amount) filter(where p.voided_at is null),0) as due
  from public.finance_charges ch
  left join public.finance_allocations a on a.charge_id=ch.id
  left join public.finance_payments p on p.id=a.payment_id
  where ch.student_id=p_student_id and ch.school_id=sid and ch.voided_at is null
  group by ch.id,ch.amount,ch.created_at
  having ch.amount-coalesce(sum(a.amount) filter(where p.voided_at is null),0)>0
  order by ch.created_at,ch.id
 loop
   exit when remaining<=0;
   allocation:=least(remaining,c.due);
   if payment_id is null then
     insert into public.finance_payments(school_id,student_id,amount,method,reference,note,created_by,request_key)
     values(sid,p_student_id,p_amount,p_method,coalesce(p_reference,''),coalesce(p_note,''),actor,p_request_key)
     returning id into payment_id;
   end if;
   insert into public.finance_allocations(school_id,payment_id,charge_id,amount)
   values(sid,payment_id,c.id,allocation);
   remaining:=remaining-allocation;
 end loop;
 if remaining>0 then raise exception 'Amount exceeds outstanding balance by %',remaining; end if;
 insert into public.finance_events(school_id,actor_id,actor_name,kind,payment_id,message)
 select sid,actor,u.full_name,'PAYMENT_RECEIVED',payment_id,
 'Payment of GHS '||p_amount::text||' received ('||p_method||')'
 from public.school_users u where u.id=actor;
 return payment_id;
end $$;

create or replace function public.finance_void_payment(p_payment_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare p public.finance_payments%rowtype;
declare sid uuid:=private.member_school();
declare actor uuid:=private.member_id();
begin
 if not private.finance_access() then raise exception 'Finance access required' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<8 then raise exception 'A reason of at least 8 characters is required'; end if;
 select * into p from public.finance_payments where id=p_payment_id and school_id=sid;
 if not found then raise exception 'Payment not found'; end if;
 perform 1 from public.students where id=p.student_id and school_id=sid for update;
 select * into p from public.finance_payments where id=p_payment_id and school_id=sid for update;
 if p.voided_at is not null then raise exception 'Payment already voided'; end if;
 update public.finance_payments set voided_at=now(),voided_by=actor,void_reason=trim(p_reason) where id=p.id;
 insert into public.finance_events(school_id,actor_id,actor_name,kind,payment_id,message)
 select sid,actor,u.full_name,'PAYMENT_VOIDED',p.id,'Voided payment '||p.receipt_number||': '||left(trim(p_reason),200)
 from public.school_users u where u.id=actor;
 return true;
end $$;

create or replace function public.finance_notify_payment(p_payment_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare p public.finance_payments%rowtype;
declare sid uuid:=private.member_school();
declare actor uuid:=private.member_id();
begin
 if not private.finance_access() then raise exception 'Finance access required' using errcode='42501'; end if;
 select * into p from public.finance_payments where id=p_payment_id and school_id=sid;
 if not found then raise exception 'Payment not found'; end if;
 insert into public.finance_events(school_id,actor_id,actor_name,kind,payment_id,message)
 select sid,actor,u.full_name,'PAYMENT_NOTICE',p.id,
 'Payment alert: '||p.receipt_number||' · GHS '||p.amount::text
 from public.school_users u where u.id=actor;
 return true;
end $$;

-- Every direct draft or inventory modification gets an immutable, school-scoped audit notification.
create or replace function private.finance_track_edit()
returns trigger language plpgsql security definer set search_path=''
as $
declare sid uuid;
declare actor uuid:=private.member_id();
declare title text;
declare kind text;
begin
 sid:=coalesce(new.school_id,old.school_id);
 if actor is null then return coalesce(new,old); end if;
 if tg_table_name='finance_fees' then
   kind:=case when tg_op='INSERT' then 'FEE_CREATED' when tg_op='DELETE' then 'FEE_DELETED' else 'FEE_UPDATED' end;
   title:=case when tg_op='DELETE' then old.name else new.name end;
 else
   kind:=case when tg_op='INSERT' then 'ITEM_CREATED' when tg_op='DELETE' then 'ITEM_DELETED' else 'ITEM_UPDATED' end;
   title:=case when tg_op='DELETE' then old.name else new.name end;
 end if;
 insert into public.finance_events(school_id,actor_id,actor_name,kind,message)
 select sid,actor,u.full_name,kind,
    replace(kind,'_',' ')||': '||left(title,120)
 from public.school_users u where u.id=actor;
 return coalesce(new,old);
end $;
revoke all on function private.finance_track_edit() from public,anon,authenticated;
create trigger finance_fee_changed after insert or update or delete on public.finance_fees
 for each row execute function private.finance_track_edit();
create trigger finance_item_changed after insert or update or delete on public.finance_items
 for each row execute function private.finance_track_edit();

-- Explicit RPC execute grants; deny PUBLIC and anonymous users.
revoke all on function public.finance_apply_fee(uuid) from public,anon;
revoke all on function public.finance_sell_item(uuid,uuid,integer,uuid) from public,anon;
revoke all on function public.finance_record_payment(uuid,numeric,text,text,text,uuid) from public,anon;
revoke all on function public.finance_void_payment(uuid,text) from public,anon;
revoke all on function public.finance_notify_payment(uuid) from public,anon;
grant execute on function public.finance_apply_fee(uuid),
 public.finance_sell_item(uuid,uuid,integer),
 public.finance_record_payment(uuid,numeric,text,text,text),
 public.finance_void_payment(uuid,text),
 public.finance_notify_payment(uuid) to authenticated;
