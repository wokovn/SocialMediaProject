-- ==========================================
-- BOOKMARKS TABLE (Save Posts for Later)
-- ==========================================

-- 1. Create bookmarks table
create table if not exists public.bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent duplicate bookmarks
  unique(user_id, post_id)
);

-- 2. Create indexes for performance
create index if not exists idx_bookmarks_user_id on public.bookmarks(user_id);
create index if not exists idx_bookmarks_post_id on public.bookmarks(post_id);
create index if not exists idx_bookmarks_created_at on public.bookmarks(created_at desc);

-- 3. Enable Row Level Security
alter table public.bookmarks enable row level security;

-- Drop existing policies
drop policy if exists "Users can view their own bookmarks." on public.bookmarks;
drop policy if exists "Users can create bookmarks." on public.bookmarks;
drop policy if exists "Users can delete their own bookmarks." on public.bookmarks;

-- 4. Create RLS Policies
-- Users can only see their own bookmarks (private)
create policy "Users can view their own bookmarks."
  on public.bookmarks for select
  using ( auth.uid() = user_id );

-- Users can bookmark posts
create policy "Users can create bookmarks."
  on public.bookmarks for insert
  with check ( auth.uid() = user_id );

-- Users can remove bookmarks
create policy "Users can delete their own bookmarks."
  on public.bookmarks for delete
  using ( auth.uid() = user_id );
