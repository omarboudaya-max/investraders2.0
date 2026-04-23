-- Allow users to create their own enrollment records for manual payment processing
drop policy if exists "course_enrollments_insert_own" on public.course_enrollments;
create policy "course_enrollments_insert_own"
  on public.course_enrollments
  for insert
  with check (auth.uid() = user_id);

-- Allow users to update their own profile status (for manual payment initiation)
drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" 
  on public.users 
  for update 
  using (auth.uid() = id);
