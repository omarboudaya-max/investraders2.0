create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text check (event_type in ('masterclass', 'networking', 'ama', 'live_room')),
  start_time timestamptz not null,
  end_time timestamptz,
  cover_image text,
  host_id uuid references auth.users(id),
  meeting_url text,
  created_at timestamptz default now()
);

create table if not exists public.event_registrations (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  registered_at timestamptz default now(),
  primary key (event_id, user_id)
);

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

create policy "Events are viewable by everyone" on public.events for select using (true);
create policy "Admins can insert events" on public.events for insert with check (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

create policy "Users can view their own registrations" on public.event_registrations for select using (user_id = auth.uid());
create policy "Users can register for events" on public.event_registrations for insert with check (user_id = auth.uid());
create policy "Users can unregister" on public.event_registrations for delete using (user_id = auth.uid());
