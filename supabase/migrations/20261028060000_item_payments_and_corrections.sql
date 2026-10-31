-- Reconcile item-specific payments without touching unrelated older school fees.
-- All financial changes are atomic, idempotent and restricted to school finance roles.
alter table public.finance_events drop constraint if exists finance_events_kind_check;
alter table public.finance_events add constraint finance_events_kind_check
 check(kind in ('FEE_CREATED','FEE_UPDATED','FEE_DELETED','FEE_APPLIED','CHARGE_VOIDED',
 'PAYMENT_RECEIVED','PAYMENT_VOIDED','PAYMENT_NOTICE','SALE','ITEM_CREATED','ITEM_UPDATED',
 'ITEM_DELETED','PAYMENT_REALLOCATED'));

create table public.finance_payment_reassignments(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 payment_id uuid not null,
 sale_id uuid not null,
 amount numeric(12,2) not null check(amount>0),
 reason text not null check(length(trim(reason)) between 8 and 500),
 request_key uuid not null unique,
 created_by uuid not null references public.school_users(id),
 created_at timestamptz not null default now(),
 foreign key(payment_id,school_id) references public.finance_payments(id,school_id),
 foreign key(sale_id,school_id) references public.finance_sales(id,school_id)
);
alter table public.finance_payment_reassignments enable row level security;
revoke all on public.finance_payment_reassignments from public,anon,authenticated;
grant select on public.finance_payment_reassignments to authenticated;
create policy finance_reassignments_read on public.finance_payment_reassignments
 for select to authenticated using(school_id=(select private.member_school()) and (select private.finance_access()));

create or replace function public.finance_record_item_payment(
 p_sale_id uuid,p_amount numeric,p_method text,p_reference text,p_note text,p_request_key uuid
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=private.member_school();
declare actor uuid:=private.member_id();
declare sale_row public.finance_sales%rowtype;
declare charge_row public.finance_charges%rowtype;
declare payment_uuid uuid;
declare due numeric;
begin
 if not private.finance_access() then raise exception 'Finance access required' using errcode='42501'; end if;
 if p_request_key is null or p_amount is null or p_amount<=0 or p_amount>99999999 or round(p_amount,2)<>p_amount
 then raise exception 'Invalid payment amount or request ID'; end if;
 if p_method not in ('CASH','MOMO','BANK','CHEQUE','OTHER') then raise exception 'Invalid payment method'; end if;
 if length(coalesce(p_reference,''))>120 or length(coalesce(p_note,''))>500 then raise exception 'Payment detail too long'; end if;
 select * into sale_row from public.finance_sales where id=p_sale_id and school_id=sid;
 if not found then raise exception 'Sale not found'; end if;
 perform 1 from public.students where id=sale_row.student_id and school_id=sid for update;
 select * into charge_row from public.finance_charges
 where sale_id=sale_row.id and school_id=sid and student_id=sale_row.student_id and voided_at is null;
 if not found then raise exception 'Active sale charge not found'; end if;
 select id into payment_uuid from public.finance_payments pay
 where pay.request_key=p_request_key and pay.school_id=sid and pay.student_id=sale_row.student_id
 and pay.amount=p_amount and pay.method=p_method and pay.reference=coalesce(p_reference,'')
 and pay.note=coalesce(p_note,'');
 if found then
  if exists(select 1 from public.finance_allocations a where a.payment_id=payment_uuid and a.charge_id=charge_row.id)
  then return payment_uuid; end if;
 end if;
 if exists(select 1 from public.finance_payments where request_key=p_request_key)
 then raise exception 'Payment request ID used with different details'; end if;
 select charge_row.amount-coalesce(sum(a.amount) filter(where p.voided_at is null),0) into due
 from public.finance_charges c
 left join public.finance_allocations a on a.charge_id=c.id
 left join public.finance_payments p on p.id=a.payment_id
 where c.id=charge_row.id group by charge_row.amount;
 if due is null or p_amount>due then raise exception 'Payment exceeds unpaid sale amount'; end if;
 insert into public.finance_payments(school_id,student_id,amount,method,reference,note,created_by,request_key)
 values(sid,sale_row.student_id,p_amount,p_method,coalesce(p_reference,''),coalesce(p_note,''),actor,p_request_key)
 returning id into payment_uuid;
 insert into public.finance_allocations(school_id,payment_id,charge_id,amount)
 values(sid,payment_uuid,charge_row.id,p_amount);
 insert into public.finance_events(school_id,actor_id,actor_name,kind,payment_id,message)
 select sid,actor,u.full_name,'PAYMENT_RECEIVED',payment_uuid,
 'Item payment of GHS '||p_amount::text||' received ('||p_method||')'
 from public.school_users u where u.id=actor;
 return payment_uuid;
end $$;

-- Atomic checkout: sale, stock decrement, charge and payment succeed or fail together.
create or replace function public.finance_sell_item_paid(
 p_item_id uuid,p_student_id uuid,p_quantity integer,p_sale_request_key uuid,
 p_payment_request_key uuid,p_amount numeric,p_method text,p_reference text default ''
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sale_uuid uuid;pay_uuid uuid;
begin
 if not private.finance_access() then raise exception 'Finance access required' using errcode='42501'; end if;
 sale_uuid:=public.finance_sell_item(p_item_id,p_student_id,p_quantity,p_sale_request_key);
 pay_uuid:=public.finance_record_item_payment(sale_uuid,p_amount,p_method,p_reference,'Item purchase at checkout',p_payment_request_key);
 return jsonb_build_object('sale_id',sale_uuid,'payment_id',pay_uuid);
end $$;

-- Correct an existing payment allocated to older fees without pretending new money arrived.
create or replace function public.finance_reassign_payment_to_sale(
 p_payment_id uuid,p_sale_id uuid,p_amount numeric,p_reason text,p_request_key uuid
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=private.member_school();actor uuid:=private.member_id();
declare pay public.finance_payments%rowtype;declare sale public.finance_sales%rowtype;
declare charge public.finance_charges%rowtype;
declare due numeric;declare movable numeric;declare remaining numeric;declare amount_to_move numeric;
declare allocation record;declare correction_id uuid;
begin
 if not private.finance_access() then raise exception 'Finance access required' using errcode='42501'; end if;
 if p_request_key is null or p_amount is null or p_amount<=0 or p_amount>99999999 or round(p_amount,2)<>p_amount
 then raise exception 'Invalid correction amount or request ID'; end if;
 if length(trim(coalesce(p_reason,'')))<8 or length(p_reason)>500
 then raise exception 'Correction reason must be between 8 and 500 characters'; end if;
 select * into sale from public.finance_sales where id=p_sale_id and school_id=sid;
 if not found then raise exception 'Sale not found'; end if;
 perform 1 from public.students where id=sale.student_id and school_id=sid for update;
 select * into pay from public.finance_payments
 where id=p_payment_id and school_id=sid and student_id=sale.student_id and voided_at is null for update;
 if not found then raise exception 'Active payment for this student not found'; end if;
 select id into correction_id from public.finance_payment_reassignments r where
 r.request_key=p_request_key and r.payment_id=p_payment_id and r.sale_id=p_sale_id
 and r.amount=p_amount and r.school_id=sid;
 if found then return correction_id; end if;
 if exists(select 1 from public.finance_payment_reassignments where request_key=p_request_key)
 then raise exception 'Correction request ID already used'; end if;
 select * into charge from public.finance_charges
 where sale_id=sale.id and student_id=sale.student_id and school_id=sid and voided_at is null;
 if not found then raise exception 'Active item charge not found'; end if;
 select charge.amount-coalesce(sum(a.amount) filter(where p.voided_at is null),0) into due
 from public.finance_charges c
 left join public.finance_allocations a on a.charge_id=c.id
 left join public.finance_payments p on p.id=a.payment_id
 where c.id=charge.id group by charge.amount;
 select coalesce(sum(amount),0) into movable from public.finance_allocations
 where payment_id=pay.id and charge_id<>charge.id;
 if p_amount>due or p_amount>movable then raise exception 'Not enough payment to reassign or sale already settled'; end if;
 remaining:=p_amount;
 for allocation in
  select a.id,a.amount from public.finance_allocations a
  join public.finance_charges c on c.id=a.charge_id
  where a.payment_id=pay.id and a.charge_id<>charge.id
  order by c.created_at desc,c.id desc
 loop
  exit when remaining<=0;
  amount_to_move:=least(remaining,allocation.amount);
  if amount_to_move=allocation.amount then
   delete from public.finance_allocations where id=allocation.id;
  else
   update public.finance_allocations set amount=amount-amount_to_move where id=allocation.id;
  end if;
  remaining:=remaining-amount_to_move;
 end loop;
 insert into public.finance_allocations(school_id,payment_id,charge_id,amount)
 values(sid,pay.id,charge.id,p_amount)
 on conflict(payment_id,charge_id) do update set amount=public.finance_allocations.amount+excluded.amount;
 insert into public.finance_payment_reassignments(school_id,payment_id,sale_id,amount,reason,request_key,created_by)
 values(sid,pay.id,sale.id,p_amount,trim(p_reason),p_request_key,actor) returning id into correction_id;
 insert into public.finance_events(school_id,actor_id,actor_name,kind,payment_id,message)
 select sid,actor,u.full_name,'PAYMENT_REALLOCATED',pay.id,
 'Reassigned GHS '||p_amount::text||' payment to item sale (correction)'
 from public.school_users u where u.id=actor;
 return correction_id;
end $$;
revoke all on function public.finance_record_item_payment(uuid,numeric,text,text,text,uuid) from public,anon;
revoke all on function public.finance_sell_item_paid(uuid,uuid,integer,uuid,uuid,numeric,text,text) from public,anon;
revoke all on function public.finance_reassign_payment_to_sale(uuid,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.finance_record_item_payment(uuid,numeric,text,text,text,uuid),
 public.finance_sell_item_paid(uuid,uuid,integer,uuid,uuid,numeric,text,text),
 public.finance_reassign_payment_to_sale(uuid,uuid,numeric,text,uuid) to authenticated;
