-- Disposable CI-only verification for independent one-time custom SMS permit.
begin;
create function pg_temp.expect_custom(ok boolean,label text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Custom SMS test failed: %',label; end if;
end $$;
select pg_temp.expect_custom(
  (select count(*)=1 from public.guardian_custom_test_permit),
  'one permit exists');
select pg_temp.expect_custom(
  (select enabled=false and consumed_at is null
   from public.guardian_custom_test_permit where singleton=true),
  'permit must default to disabled');
select pg_temp.expect_custom(
  not has_table_privilege('authenticated','public.guardian_custom_test_permit','SELECT')
  and not has_table_privilege('authenticated','public.guardian_custom_test_permit','UPDATE'),
  'school users cannot view or claim permit');
update public.guardian_custom_test_permit set enabled=true where singleton=true;
with claim as(
  update public.guardian_custom_test_permit
  set consumed_at=now()
  where singleton=true and enabled and consumed_at is null
  returning singleton
)
select pg_temp.expect_custom((select count(*)=1 from claim),'first claim succeeds');
with claim as(
  update public.guardian_custom_test_permit
  set consumed_at=now()
  where singleton=true and enabled and consumed_at is null
  returning singleton
)
select pg_temp.expect_custom((select count(*)=0 from claim),'second claim rejected');
select pg_temp.expect_custom(
  (select sending_enabled=false from public.sms_central_settings where singleton=true),
  'test must not enable payment SMS');
rollback;
