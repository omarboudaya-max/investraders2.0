-- Create profile_views table
create table if not exists public.profile_views (
    id uuid primary key default gen_random_uuid(),
    viewed_id uuid not null references auth.users(id) on delete cascade,
    viewer_id uuid references auth.users(id) on delete set null,
    created_at timestamptz default now()
);

-- RLS for profile_views
alter table public.profile_views enable row level security;

create policy "Users can view their own profile views"
on public.profile_views for select
using (auth.uid() = viewed_id);

create policy "Authenticated users can insert profile views"
on public.profile_views for insert
with check (auth.role() = 'authenticated');

-- Create user_follows table
create table if not exists public.user_follows (
    follower_id uuid references auth.users(id) on delete cascade,
    following_id uuid references auth.users(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (follower_id, following_id)
);

-- RLS for user_follows
alter table public.user_follows enable row level security;

create policy "Public read access for user follows"
on public.user_follows for select
using (true);

create policy "Users can manage their own follows"
on public.user_follows for all
using (auth.uid() = follower_id);
