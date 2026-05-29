-- 1. Alter check constraint for users table to allow 'admin' role
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('founder', 'investor', 'admin'));

-- 2. Create rate_limits table
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  action text not null,
  timestamp timestamptz default now() not null
);

-- Index for fast rate limit lookups
create index if not exists rate_limits_identifier_action_timestamp_idx on public.rate_limits (identifier, action, timestamp desc);

-- Enable RLS on rate_limits (only service role needs access, so keep RLS enabled but no public policies, which denies all client-side direct access)
alter table public.rate_limits enable row level security;

-- 3. Create helper functions for RBAC
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

create or replace function public.get_user_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return (select role from public.users where id = auth.uid());
end;
$$;

create or replace function public.is_active_subscriber()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.users
    where id = auth.uid() 
      and (subscription_status = 'active' or role = 'admin')
  );
end;
$$;

-- 4. Secure the new user trigger function to prevent client-side metadata privilege escalation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned_role text;
begin
  assigned_role := coalesce(new.raw_user_meta_data->>'role', 'founder');
  
  -- Prevent privilege escalation: do not allow signing up as admin directly
  if assigned_role = 'admin' then
    assigned_role := 'founder';
  end if;

  -- Auto-elevate pre-approved admin emails to 'admin' role
  if new.email in (
    'omarboudaya1@gmail.com', 
    'dr.maherkhedher@wisdomnets.com', 
    'mohammedkhedher222@gmail.com'
  ) then
    assigned_role := 'admin';
  end if;

  insert into public.users (
    id, first_name, last_name, email, role, 
    investor_fund, investor_focus, investor_ticket_size, investor_preferred_stage
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'firstName', 'New'),
    coalesce(new.raw_user_meta_data->>'lastName', 'User'),
    new.email,
    assigned_role,
    new.raw_user_meta_data->>'investorFund',
    new.raw_user_meta_data->>'investorFocus',
    new.raw_user_meta_data->>'investorTicketSize',
    new.raw_user_meta_data->>'investorPreferredStage'
  );
  return new;
end;
$$;

-- 5. Seed existing admins or set their role to admin when their rows exist
update public.users
set role = 'admin'
where email in (
  'omarboudaya1@gmail.com', 
  'dr.maherkhedher@wisdomnets.com', 
  'mohammedkhedher222@gmail.com'
);

-- 6. Update RLS policies for public.users
drop policy if exists "users_self" on public.users;
create policy "users_select" on public.users for select using (auth.uid() = id or public.is_admin());
create policy "users_insert" on public.users for insert with check (auth.uid() = id or public.is_admin());
create policy "users_update" on public.users for update using (auth.uid() = id or public.is_admin());
create policy "users_delete" on public.users for delete using (public.is_admin());

-- 7. Update RLS policies for public.startups
drop policy if exists "startups_read_auth" on public.startups;
drop policy if exists "startups_create_owner" on public.startups;
drop policy if exists "startups_update_owner" on public.startups;

create policy "startups_select" on public.startups for select
  using (owner_uid = auth.uid() or public.is_admin() or public.get_user_role() = 'investor');
create policy "startups_insert" on public.startups for insert
  with check (owner_uid = auth.uid() or public.is_admin());
create policy "startups_update" on public.startups for update
  using (owner_uid = auth.uid() or public.is_admin());
create policy "startups_delete" on public.startups for delete
  using (owner_uid = auth.uid() or public.is_admin());

-- 8. Update RLS policies for public.course_enrollments
drop policy if exists "course_enrollments_select_own" on public.course_enrollments;
create policy "course_enrollments_select" on public.course_enrollments for select
  using (user_id = auth.uid() or public.is_admin());

-- 9. Update RLS policies for public.checkout_sessions
drop policy if exists "checkout_sessions_select_own" on public.checkout_sessions;
create policy "checkout_sessions_select" on public.checkout_sessions for select
  using (user_id = auth.uid() or public.is_admin());

-- 10. Update RLS policies for public.forum_messages
drop policy if exists "forum_read_auth" on public.forum_messages;
drop policy if exists "forum_insert_auth" on public.forum_messages;

create policy "forum_select" on public.forum_messages for select
  using (public.is_active_subscriber() or public.is_admin());
create policy "forum_insert" on public.forum_messages for insert
  with check (auth.uid() = user_id and (public.is_active_subscriber() or public.is_admin()));

-- 11. Update RLS policies for public.training_registrations
drop policy if exists "Allow public registration" on public.training_registrations;
create policy "training_registrations_insert" on public.training_registrations for insert
  with check (true);
create policy "training_registrations_select" on public.training_registrations for select
  using (public.is_admin());

-- 12. Update RLS policies for public.training_sessions
drop policy if exists "Allow public read access for training sessions" on public.training_sessions;
create policy "training_sessions_select" on public.training_sessions for select
  using (true);
create policy "training_sessions_write" on public.training_sessions for all
  using (public.is_admin());

-- 13. Update RLS policies for public.contact_messages
drop policy if exists "Anyone can insert contact messages" on public.contact_messages;
drop policy if exists "Only admins can view contact messages" on public.contact_messages;

create policy "contact_messages_insert" on public.contact_messages for insert
  with check (true);
create policy "contact_messages_select" on public.contact_messages for select
  using (public.is_admin());
