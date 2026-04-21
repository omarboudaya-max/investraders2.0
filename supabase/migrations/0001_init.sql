-- Core profile table linked to Supabase Auth.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  role text not null check (role in ('founder', 'investor')),
  startup_id text,
  investor_fund text,
  investor_focus text,
  investor_ticket_size text,
  investor_preferred_stage text,
  joined_at timestamptz default now()
);

create table if not exists public.startups (
  id text primary key,
  owner_uid uuid not null references auth.users(id) on delete cascade,
  name text not null,
  field text not null,
  stage text not null,
  employees text not null,
  capital text not null,
  year text not null,
  website text not null,
  description text not null,
  investor_visits integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.startup_visits (
  id uuid primary key default gen_random_uuid(),
  startup_id text not null references public.startups(id) on delete cascade,
  visitor_uid uuid not null references auth.users(id) on delete cascade,
  visitor_name text,
  visitor_fund text,
  timestamp timestamptz default now()
);

create table if not exists public.courses (
  id text primary key,
  title text not null,
  description text not null,
  price numeric(10,2) not null,
  next_session text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.course_enrollments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  course_id text not null references public.courses(id) on delete cascade,
  course text not null,
  price numeric(10,2) not null,
  payment_status text not null default 'paid',
  payment_provider text not null check (payment_provider in ('stripe', 'paypal')),
  paypal_order_id text,
  stripe_session_id text,
  first_name text,
  last_name text,
  age text,
  country text,
  education text,
  professional text,
  motivation text,
  access_code text not null,
  qr_url text not null,
  session_date text,
  enrolled_at timestamptz default now()
);

create table if not exists public.checkout_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  course_id text not null references public.courses(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'paypal')),
  status text not null default 'created',
  course_applicant_data jsonb not null default '{}'::jsonb,
  enrollment_id text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

alter table public.users enable row level security;
alter table public.startups enable row level security;
alter table public.startup_visits enable row level security;
alter table public.courses enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.checkout_sessions enable row level security;

drop policy if exists "users_self" on public.users;
create policy "users_self" on public.users
for all using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "startups_read_auth" on public.startups;
create policy "startups_read_auth" on public.startups
for select using (auth.uid() is not null);

drop policy if exists "startups_create_owner" on public.startups;
create policy "startups_create_owner" on public.startups
for insert with check (owner_uid = auth.uid());

drop policy if exists "startups_update_owner" on public.startups;
create policy "startups_update_owner" on public.startups
for update using (owner_uid = auth.uid())
with check (owner_uid = auth.uid());

drop policy if exists "startup_visits_insert_auth" on public.startup_visits;
create policy "startup_visits_insert_auth" on public.startup_visits
for insert with check (auth.uid() = visitor_uid);

drop policy if exists "courses_read_public" on public.courses;
create policy "courses_read_public" on public.courses
for select using (true);

drop policy if exists "enrollments_read_self" on public.course_enrollments;
create policy "enrollments_read_self" on public.course_enrollments
for select using (user_id = auth.uid());

drop policy if exists "sessions_read_self" on public.checkout_sessions;
create policy "sessions_read_self" on public.checkout_sessions
for select using (user_id = auth.uid());

insert into public.courses (id, title, description, price, next_session, is_active)
values
  (
    'how-to-build-startup-with-ai',
    'How to Build Your Startup Using AI',
    'Masterclass AI for founders, from ideation to investor-ready execution.',
    300.00,
    '2026-08-15',
    true
  )
on conflict (id) do nothing;
