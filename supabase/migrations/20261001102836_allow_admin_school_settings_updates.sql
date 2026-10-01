-- Allow signed-in school administrators to update only the school settings exposed by the UI.
-- Row-level security remains the authorization boundary: admin_school_update restricts writes to the member's own school.
revoke update on table public.schools from authenticated;

grant update (
  name,
  address,
  phone,
  email,
  headteacher_name,
  district,
  region,
  sba_weight,
  exam_weight,
  logo_url
) on table public.schools to authenticated;
