-- ==========================================
-- MEDIA TABLE (For Post Attachments)
-- ==========================================

-- 1. Create media table
create table if not exists public.media (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  file_size integer, -- in bytes
  width integer,
  height integer,
  duration integer, -- for videos, in seconds
  thumbnail_url text, -- thumbnail for videos
  alt_text text, -- accessibility description
  display_order integer default 0, -- order in which media appears in post
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create indexes for performance
create index if not exists idx_media_post_id on public.media(post_id);
create index if not exists idx_media_display_order on public.media(post_id, display_order);
create index if not exists idx_media_created_at on public.media(created_at desc);

-- 3. Enable Row Level Security
alter table public.media enable row level security;

-- Drop existing policies
drop policy if exists "Media are viewable by everyone." on public.media;
drop policy if exists "Users can insert media for their own posts." on public.media;
drop policy if exists "Users can delete media from their own posts." on public.media;

-- 4. Create RLS Policies
-- Media viewable if post is viewable
create policy "Media are viewable by everyone."
  on public.media for select
  using (
    exists (
      select 1 from public.posts
      where posts.id = media.post_id
      and (
        posts.visibility = 'public'
        or posts.user_id = auth.uid()
        or (posts.visibility = 'followers' and exists (
          select 1 from public.follows
          where follower_id = auth.uid() and following_id = posts.user_id
        ))
      )
    )
  );

-- Users can add media to their own posts
create policy "Users can insert media for their own posts."
  on public.media for insert
  with check (
    exists (
      select 1 from public.posts
      where posts.id = media.post_id
      and posts.user_id = auth.uid()
    )
  );

-- Users can delete media from their own posts
create policy "Users can delete media from their own posts."
  on public.media for delete
  using (
    exists (
      select 1 from public.posts
      where posts.id = media.post_id
      and posts.user_id = auth.uid()
    )
  );
