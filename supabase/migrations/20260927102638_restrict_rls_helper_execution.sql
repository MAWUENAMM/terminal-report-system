
revoke execute on function public.current_school_id() from public;
grant execute on function public.current_school_id() to authenticated;

-- A clean baseline may not contain this historical helper.
do $$
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
   revoke execute on function public.rls_auto_enable() from public;
 end if;
end $$;


