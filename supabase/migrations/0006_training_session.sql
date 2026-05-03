-- Create training_sessions table
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  date text not null,
  time text not null,
  platform text not null,
  is_free boolean default true,
  created_at timestamptz default now()
);

-- Create training_registrations table
create table if not exists public.training_registrations (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid references public.training_sessions(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  occupation text not null,
  phone_number text not null,
  referral_source text,
  registered_at timestamptz default now(),
  -- Ensure unique email per training session
  unique(training_session_id, email)
);

-- Enable RLS
alter table public.training_sessions enable row level security;
alter table public.training_registrations enable row level security;

-- Policies for training_sessions (Read for all)
create policy "Allow public read access for training sessions"
  on public.training_sessions for select
  using (true);

-- Policies for training_registrations (Insert for all, Read for self by email/id if needed, but usually just insert for public)
create policy "Allow public registration"
  on public.training_registrations for insert
  with check (true);

-- Insert the specific training session requested
insert into public.training_sessions (id, title, description, date, time, platform, is_free)
values (
  'a1b2c3d4-e5f6-4a5b-b6c7-d8e9f0a1b2c3', -- Fixed UUID for easier referencing
  'HOW TO REACH FINANCIAL FREEDOM USING AI',
  'Free training session on leveraging AI for financial freedom.',
  'May 12th',
  '9 PM KSA',
  'Google Meet',
  true
)
on conflict (id) do update set
  title = excluded.title,
  date = excluded.date,
  time = excluded.time,
  platform = excluded.platform,
  is_free = excluded.is_free;
