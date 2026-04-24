-- ==========================================
-- POSTS TABLE
-- ==========================================

-- 1. Create posts table
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  shared_post_id uuid references public.posts(id) on delete set null,
  content text not null,
  visibility text default 'public' check (visibility in ('public', 'private', 'followers', 'deleted')),
  likes_count integer default 0,
  comments_count integer default 0,
  shares_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone
);

-- 2. Create indexes for performance
create index if not exists idx_posts_user_id on public.posts(user_id);
create index if not exists idx_posts_shared_post_id on public.posts(shared_post_id) where shared_post_id is not null;
create index if not exists idx_posts_created_at on public.posts(created_at desc);
create index if not exists idx_posts_deleted_at on public.posts(deleted_at) where deleted_at is null;

-- 3. Enable Row Level Security
alter table public.posts enable row level security;

-- Drop existing policies
drop policy if exists "Posts are viewable by everyone." on public.posts;
drop policy if exists "Users can insert their own posts." on public.posts;
drop policy if exists "Users can update their own posts." on public.posts;
drop policy if exists "Users can delete their own posts." on public.posts;

-- 4. Create RLS Policies
-- Public posts viewable by everyone, private only by owner
create policy "Posts are viewable by everyone."
  on public.posts for select
  using (
    visibility = 'public' 
    or user_id = auth.uid()
    or (visibility = 'followers' and exists (
      select 1 from public.follows 
      where follower_id = auth.uid() and following_id = posts.user_id
    ))
  );

-- Users can insert their own posts
create policy "Users can insert their own posts."
  on public.posts for insert
  with check ( auth.uid() = user_id );

-- Users can update their own posts
create policy "Users can update their own posts."
  on public.posts for update
  using ( auth.uid() = user_id );

-- Users can soft delete their own posts
create policy "Users can delete their own posts."
  on public.posts for delete
  using ( auth.uid() = user_id );

-- 5. Create function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- 6. Create trigger for updated_at
drop trigger if exists update_posts_updated_at on public.posts;
create trigger update_posts_updated_at
  before update on public.posts
  for each row
  execute procedure public.update_updated_at_column();
