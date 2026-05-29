-- 1. Create Storage Bucket for Community Media
insert into storage.buckets (id, name, public)
values ('community_media', 'community_media', true)
on conflict (id) do nothing;

-- Storage RLS
drop policy if exists "Public Access to community_media" on storage.objects;
create policy "Public Access to community_media"
on storage.objects for select
using (bucket_id = 'community_media');

drop policy if exists "Authenticated users can upload media" on storage.objects;
create policy "Authenticated users can upload media"
on storage.objects for insert
with check (
  bucket_id = 'community_media' and auth.role() = 'authenticated'
);

drop policy if exists "Users can update their own media" on storage.objects;
create policy "Users can update their own media"
on storage.objects for update
using (
  bucket_id = 'community_media' and auth.uid() = owner
);

drop policy if exists "Users can delete their own media" on storage.objects;
create policy "Users can delete their own media"
on storage.objects for delete
using (
  bucket_id = 'community_media' and auth.uid() = owner
);

-- 2. Community Spaces
create table if not exists public.community_spaces (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    icon text,
    order_idx integer default 0,
    created_at timestamptz default now()
);

-- 3. Community Posts
create table if not exists public.community_posts (
    id uuid primary key default gen_random_uuid(),
    space_id uuid not null references public.community_spaces(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    user_name text not null,
    user_role text not null,
    title text,
    content text not null,
    media_url text,
    created_at timestamptz default now()
);

-- 4. Community Comments
create table if not exists public.community_comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.community_posts(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    user_name text not null,
    user_role text not null,
    content text not null,
    created_at timestamptz default now()
);

-- 5. Community Reactions
create table if not exists public.community_reactions (
    id uuid primary key default gen_random_uuid(),
    entity_type text not null check (entity_type in ('post', 'comment')),
    entity_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    emoji text not null,
    created_at timestamptz default now(),
    unique(entity_type, entity_id, user_id, emoji)
);

-- 6. Enable RLS
alter table public.community_spaces enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;

-- 7. RLS Policies
-- Spaces
create policy "community_spaces_select" on public.community_spaces for select using (auth.uid() is not null);
create policy "community_spaces_insert" on public.community_spaces for insert with check (public.is_admin());
create policy "community_spaces_update" on public.community_spaces for update using (public.is_admin());
create policy "community_spaces_delete" on public.community_spaces for delete using (public.is_admin());

-- Posts
create policy "community_posts_select" on public.community_posts for select using (auth.uid() is not null);
create policy "community_posts_insert" on public.community_posts for insert with check (auth.uid() = user_id);
create policy "community_posts_update" on public.community_posts for update using (auth.uid() = user_id or public.is_admin());
create policy "community_posts_delete" on public.community_posts for delete using (auth.uid() = user_id or public.is_admin());

-- Comments
create policy "community_comments_select" on public.community_comments for select using (auth.uid() is not null);
create policy "community_comments_insert" on public.community_comments for insert with check (auth.uid() = user_id);
create policy "community_comments_update" on public.community_comments for update using (auth.uid() = user_id or public.is_admin());
create policy "community_comments_delete" on public.community_comments for delete using (auth.uid() = user_id or public.is_admin());

-- Reactions
create policy "community_reactions_select" on public.community_reactions for select using (auth.uid() is not null);
create policy "community_reactions_insert" on public.community_reactions for insert with check (auth.uid() = user_id);
create policy "community_reactions_delete" on public.community_reactions for delete using (auth.uid() = user_id);

-- 8. Default Spaces
insert into public.community_spaces (id, name, description, icon, order_idx)
values 
  ('00000000-0000-0000-0000-000000000001', 'General Discussion', 'Talk about anything related to startups and investing.', '💬', 1),
  ('00000000-0000-0000-0000-000000000002', 'Startup Pitches', 'Share your startup idea and get feedback.', '🚀', 2),
  ('00000000-0000-0000-0000-000000000003', 'Networking', 'Introduce yourself and meet other founders and investors.', '🤝', 3),
  ('00000000-0000-0000-0000-000000000004', 'Announcements', 'Official news and updates from Investraders.', '📢', 0)
on conflict do nothing;

-- 9. Migrate old forum messages
insert into public.community_posts (space_id, user_id, user_name, user_role, content, created_at)
select 
  '00000000-0000-0000-0000-000000000001',
  user_id,
  user_name,
  user_role,
  message,
  created_at
from public.forum_messages
on conflict do nothing;
