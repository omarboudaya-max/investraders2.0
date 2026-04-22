-- Forum Messages Table
create table if not exists public.forum_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  user_role text not null,
  message text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.forum_messages enable row level security;

-- Policies
-- 1. Anyone signed in can read messages
create policy "forum_read_auth" on public.forum_messages
  for select using (auth.uid() is not null);

-- 2. Anyone signed in with a subscription can post (for now we allow any signed in user to simplify, 
-- but we could restrict it to active subscribers if preferred. 
-- However, the UI will gate access to the forum tab itself.)
create policy "forum_insert_auth" on public.forum_messages
  for insert with check (auth.uid() = user_id);

-- Optional: Add index for performance
create index if not exists forum_messages_created_at_idx on public.forum_messages(created_at desc);
