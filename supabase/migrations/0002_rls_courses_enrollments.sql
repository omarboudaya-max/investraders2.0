-- RLS was enabled on these tables in 0001_init.sql but no SELECT policies were added.
-- Without policies, all client reads are denied (empty errors / broken marketplace).

-- Courses: public catalog (read-only from client).
drop policy if exists "courses_select_public" on public.courses;
create policy "courses_select_public"
  on public.courses
  for select
  using (true);

-- Course enrollments: each user sees only their own rows.
drop policy if exists "course_enrollments_select_own" on public.course_enrollments;
create policy "course_enrollments_select_own"
  on public.course_enrollments
  for select
  using (auth.uid() = user_id);

-- Checkout sessions: optional client read of own pending sessions (Edge Functions use service role and bypass RLS).
drop policy if exists "checkout_sessions_select_own" on public.checkout_sessions;
create policy "checkout_sessions_select_own"
  on public.checkout_sessions
  for select
  using (auth.uid() = user_id);
