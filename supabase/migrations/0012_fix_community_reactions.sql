-- Drop the polymorphic table
drop table if exists public.community_reactions;

-- Recreate with explicit foreign keys so PostgREST can resolve relations
create table public.community_reactions (
    id uuid primary key default gen_random_uuid(),
    post_id uuid references public.community_posts(id) on delete cascade,
    comment_id uuid references public.community_comments(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    emoji text not null,
    created_at timestamptz default now(),
    check (
        (post_id is not null and comment_id is null) or 
        (post_id is null and comment_id is not null)
    )
);

-- Note: unique nulls not distinct is Postgres 15+ feature. 
-- For broad compatibility, we will create partial unique indexes instead.

drop index if exists unique_post_reaction;
drop index if exists unique_comment_reaction;

create unique index unique_post_reaction on public.community_reactions (post_id, user_id, emoji) where post_id is not null;
create unique index unique_comment_reaction on public.community_reactions (comment_id, user_id, emoji) where comment_id is not null;

alter table public.community_reactions drop constraint if exists community_reactions_post_id_user_id_emoji_key;
alter table public.community_reactions drop constraint if exists community_reactions_comment_id_user_id_emoji_key;

alter table public.community_reactions enable row level security;

create policy "community_reactions_select" on public.community_reactions for select using (auth.uid() is not null);
create policy "community_reactions_insert" on public.community_reactions for insert with check (auth.uid() = user_id);
create policy "community_reactions_delete" on public.community_reactions for delete using (auth.uid() = user_id);
