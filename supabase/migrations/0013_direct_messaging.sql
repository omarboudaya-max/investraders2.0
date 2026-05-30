create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_group_chat boolean default false,
  title text -- optional, for group chats
);

create table if not exists public.chat_thread_participants (
  thread_id uuid references public.chat_threads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.chat_threads(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz default now()
);

-- RLS
alter table public.chat_threads enable row level security;
alter table public.chat_thread_participants enable row level security;
alter table public.direct_messages enable row level security;

create policy "users_select_threads" on public.chat_threads
  for select using (
    exists (
      select 1 from public.chat_thread_participants
      where thread_id = chat_threads.id and user_id = auth.uid()
    )
  );

create policy "users_insert_threads" on public.chat_threads
  for insert with check (auth.uid() is not null);

create policy "users_update_threads" on public.chat_threads
  for update using (
    exists (
      select 1 from public.chat_thread_participants
      where thread_id = chat_threads.id and user_id = auth.uid()
    )
  );

create policy "users_select_participants" on public.chat_thread_participants
  for select using (
    exists (
      select 1 from public.chat_thread_participants as ctp
      where ctp.thread_id = chat_thread_participants.thread_id and ctp.user_id = auth.uid()
    )
  );

create policy "users_insert_participants" on public.chat_thread_participants
  for insert with check (auth.uid() is not null);

create policy "users_update_participants" on public.chat_thread_participants
  for update using (user_id = auth.uid());

create policy "users_select_messages" on public.direct_messages
  for select using (
    exists (
      select 1 from public.chat_thread_participants
      where thread_id = direct_messages.thread_id and user_id = auth.uid()
    )
  );

create policy "users_insert_messages" on public.direct_messages
  for insert with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.chat_thread_participants
      where thread_id = direct_messages.thread_id and user_id = auth.uid()
    )
  );
