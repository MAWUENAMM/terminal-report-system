-- Secure, school-scoped learner photo storage.
-- Photos live in the existing private school-assets bucket at:
-- schools/<school_id>/students/<student_id>/photo

drop policy if exists "school members can view student photos" on storage.objects;
drop policy if exists "school leaders can upload student photos" on storage.objects;
drop policy if exists "school leaders can replace student photos" on storage.objects;
drop policy if exists "school leaders can delete student photos" on storage.objects;

create policy "school members can view student photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'school-assets'
  and storage.filename(name) = 'photo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
  and (storage.foldername(name))[3] = 'students'
  and exists (
    select 1
    from public.students st
    where st.id::text = (storage.foldername(name))[4]
      and st.school_id = (select private.member_school())
  )
  and name = 'schools/' || (select private.member_school())::text || '/students/' || (storage.foldername(name))[4] || '/photo'
);

create policy "school leaders can upload student photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'school-assets'
  and (select private.member_role()) in ('ADMIN','HEADTEACHER')
  and storage.filename(name) = 'photo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
  and (storage.foldername(name))[3] = 'students'
  and exists (
    select 1
    from public.students st
    where st.id::text = (storage.foldername(name))[4]
      and st.school_id = (select private.member_school())
  )
  and name = 'schools/' || (select private.member_school())::text || '/students/' || (storage.foldername(name))[4] || '/photo'
  and lower(coalesce(metadata->>'mimetype','')) in ('image/png','image/jpeg','image/webp')
);

create policy "school leaders can replace student photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'school-assets'
  and (select private.member_role()) in ('ADMIN','HEADTEACHER')
  and storage.filename(name) = 'photo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
  and (storage.foldername(name))[3] = 'students'
  and exists (
    select 1
    from public.students st
    where st.id::text = (storage.foldername(name))[4]
      and st.school_id = (select private.member_school())
  )
  and name = 'schools/' || (select private.member_school())::text || '/students/' || (storage.foldername(name))[4] || '/photo'
)
with check (
  bucket_id = 'school-assets'
  and (select private.member_role()) in ('ADMIN','HEADTEACHER')
  and storage.filename(name) = 'photo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
  and (storage.foldername(name))[3] = 'students'
  and exists (
    select 1
    from public.students st
    where st.id::text = (storage.foldername(name))[4]
      and st.school_id = (select private.member_school())
  )
  and name = 'schools/' || (select private.member_school())::text || '/students/' || (storage.foldername(name))[4] || '/photo'
  and lower(coalesce(metadata->>'mimetype','')) in ('image/png','image/jpeg','image/webp')
);

create policy "school leaders can delete student photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'school-assets'
  and (select private.member_role()) in ('ADMIN','HEADTEACHER')
  and storage.filename(name) = 'photo'
  and (storage.foldername(name))[1] = 'schools'
  and (storage.foldername(name))[2] = (select private.member_school())::text
  and (storage.foldername(name))[3] = 'students'
  and exists (
    select 1
    from public.students st
    where st.id::text = (storage.foldername(name))[4]
      and st.school_id = (select private.member_school())
  )
  and name = 'schools/' || (select private.member_school())::text || '/students/' || (storage.foldername(name))[4] || '/photo'
);
