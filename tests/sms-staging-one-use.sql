-- One-use staging SMS permit regression, disposable database only.
begin;
create function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.denied(stmt text, label text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when insufficient_privilege then return; end;
  raise exception 'FAIL: %',label;
end $$;
select pg_temp.expect((select count(*)=1 from public.sms_staging_diagnostic_permit),
  'Exactly one staging permit exists');
select pg_temp.expect((select enabled=false and consumed_at is null
  from public.sms_staging_diagnostic_permit where singleton=true),
  'One-use permit defaults to disabled and unconsumed');
select pg_temp.expect(not has_table_privilege('authenticated',
  'public.sms_staging_diagnostic_permit','UPDATE'),
  'School users cannot enable or consume the permit');
select pg_temp.expect(not has_table_privilege('authenticated',
  'public.sms_staging_diagnostic_permit','SELECT'),
  'School users cannot read private permit state');
update public.sms_staging_diagnostic_permit set enabled=true where singleton=true;
with first as (
  update public.sms_staging_diagnostic_permit set consumed_at=now()
  where singleton=true and enabled=true and consumed_at is null
  returning singleton
)
select pg_temp.expect((select count(*)=1 from first),'First attempt claims the permit');
with second as (
  update public.sms_staging_diagnostic_permit set consumed_at=now()
  where singleton=true and enabled=true and consumed_at is null
  returning singleton
)
select pg_temp.expect((select count(*)=0 from second),'Second attempt cannot claim the permit');
rollback;
