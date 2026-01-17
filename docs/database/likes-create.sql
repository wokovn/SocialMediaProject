-- ==========================================
-- LIKES TABLE (For Posts and Comments)
-- ==========================================

-- 1. Create likes table
create table if not exists public.likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Must like either a post or comment, not both
  check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  ),
  
  -- Prevent duplicate likes
  unique(user_id, post_id),
  unique(user_id, comment_id)
);

-- 2. Create indexes for performance
create index if not exists idx_likes_user_id on public.likes(user_id);
create index if not exists idx_likes_post_id on public.likes(post_id) where post_id is not null;
create index if not exists idx_likes_comment_id on public.likes(comment_id) where comment_id is not null;
create index if not exists idx_likes_created_at on public.likes(created_at desc);

-- 3. Enable Row Level Security
alter table public.likes enable row level security;

-- Drop existing policies
drop policy if exists "Likes are viewable by everyone." on public.likes;
drop policy if exists "Users can like posts/comments." on public.likes;
drop policy if exists "Users can unlike posts/comments." on public.likes;

-- 4. Create RLS Policies
-- Likes are public
create policy "Likes are viewable by everyone."
  on public.likes for select
  using ( true );

-- Users can like
create policy "Users can like posts/comments."
  on public.likes for insert
  with check ( auth.uid() = user_id );

-- Users can unlike
create policy "Users can unlike posts/comments."
  on public.likes for delete
  using ( auth.uid() = user_id );

-- 5. Create function to increment likes count
create or replace function public.increment_likes_count()
returns trigger
language plpgsql
as $$
begin
  if new.post_id is not null then
    update public.posts
    set likes_count = likes_count + 1
    where id = new.post_id;
  elsif new.comment_id is not null then
    update public.comments
    set likes_count = likes_count + 1
    where id = new.comment_id;
  end if;
  
  return new;
end;
$$;

-- 6. Create function to decrement likes count
create or replace function public.decrement_likes_count()
returns trigger
language plpgsql
as $$
begin
  if old.post_id is not null then
    update public.posts
    set likes_count = likes_count - 1
    where id = old.post_id;
  elsif old.comment_id is not null then
    update public.comments
    set likes_count = likes_count - 1
    where id = old.comment_id;
  end if;
  
  return old;
end;
$$;

-- 7. Create triggers for likes
drop trigger if exists increment_likes_count_trigger on public.likes;
create trigger increment_likes_count_trigger
  after insert on public.likes
  for each row
  execute procedure public.increment_likes_count();

drop trigger if exists decrement_likes_count_trigger on public.likes;
create trigger decrement_likes_count_trigger
  after delete on public.likes
  for each row
  execute procedure public.decrement_likes_count();
