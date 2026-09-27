
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

revoke execute on function public.rls_auto_enable() from anon, authenticated;


