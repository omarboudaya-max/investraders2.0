insert into storage.buckets (id, name, public) 
values ('course_proofs', 'course_proofs', true)
on conflict (id) do nothing;

create policy "course_proofs_insert"
on storage.objects for insert
with check ( bucket_id = 'course_proofs' and auth.role() = 'authenticated' );

create policy "course_proofs_select"
on storage.objects for select
using ( bucket_id = 'course_proofs' );
