-- Restore the new settings fields for authorized school admins.
-- Existing policy admin_school_update restricts UPDATE to member_school()
-- and private.member_role() = 'ADMIN'. Only these two new columns need grants.
-- Do NOT grant table-wide UPDATE or change RLS.
grant update (next_term_begins, sba_input_max)
  on table public.schools to authenticated;
