
alter function public.current_school_id()
  set search_path = pg_catalog, public;

drop policy if exists "users read own school" on public.school_users;

create policy "users read own membership"
on public.school_users
for select
to authenticated
using ((select auth.uid()) = auth_user_id);

revoke execute on function public.current_school_id() from anon;
grant execute on function public.current_school_id() to authenticated;

-- Some older installations included this helper but the base migration never created it.
-- Preserve the restriction if present without failing a clean local rebuild.
do $
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
   revoke execute on function public.rls_auto_enable() from anon, authenticated;
 end if;
end $;


