-- Allow admins full access to course_enrollments
drop policy if exists "admin_all_enrollments" on public.course_enrollments;
create policy "admin_all_enrollments" on public.course_enrollments
for all
using (public.is_admin());

-- Allow admins full access to users table (if not already present)
drop policy if exists "admin_all_users" on public.users;
create policy "admin_all_users" on public.users
for all
using (public.is_admin());
