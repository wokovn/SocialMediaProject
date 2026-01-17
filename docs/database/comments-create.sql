-- ==========================================
-- COMMENTS TABLE
-- ==========================================

-- 1. Create comments table (supports nested comments/replies)
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  parent_id uuid references public.comments(id) on delete cascade, -- For nested replies
  content text not null,
  likes_count integer default 0,
  replies_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone
);

-- 2. Create indexes for performance
create index if not exists idx_comments_post_id on public.comments(post_id);
create index if not exists idx_comments_user_id on public.comments(user_id);
create index if not exists idx_comments_parent_id on public.comments(parent_id);
create index if not exists idx_comments_created_at on public.comments(created_at desc);

-- 3. Enable Row Level Security
alter table public.comments enable row level security;

-- Drop existing policies
drop policy if exists "Comments are viewable by everyone." on public.comments;
drop policy if exists "Users can insert comments." on public.comments;
drop policy if exists "Users can update their own comments." on public.comments;
drop policy if exists "Users can delete their own comments." on public.comments;

-- 4. Create RLS Policies
-- Comments viewable if the post is viewable
create policy "Comments are viewable by everyone."
  on public.comments for select
  using (
    exists (
      select 1 from public.posts
      where posts.id = comments.post_id
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

-- Authenticated users can comment
create policy "Users can insert comments."
  on public.comments for insert
  with check ( auth.uid() = user_id );

-- Users can update their own comments
create policy "Users can update their own comments."
  on public.comments for update
  using ( auth.uid() = user_id );

-- Users can delete their own comments
create policy "Users can delete their own comments."
  on public.comments for delete
  using ( auth.uid() = user_id );

-- 5. Create function to increment post comment count
create or replace function public.increment_post_comments()
returns trigger
language plpgsql
as $$
begin
  -- Increment parent comment replies_count if it's a reply
  if new.parent_id is not null then
    update public.comments
    set replies_count = replies_count + 1
    where id = new.parent_id;
  end if;
  
  -- Increment post comments_count
  update public.posts
  set comments_count = comments_count + 1
  where id = new.post_id;
  
  return new;
end;
$$;

-- 6. Create function to decrement post comment count
create or replace function public.decrement_post_comments()
returns trigger
language plpgsql
as $$
begin
  -- Decrement parent comment replies_count if it's a reply
  if old.parent_id is not null then
    update public.comments
    set replies_count = replies_count - 1
    where id = old.parent_id;
  end if;
  
  -- Decrement post comments_count
  update public.posts
  set comments_count = comments_count - 1
  where id = old.post_id;
  
  return old;
end;
$$;

-- 7. Create triggers
drop trigger if exists increment_comments_count on public.comments;
create trigger increment_comments_count
  after insert on public.comments
  for each row
  execute procedure public.increment_post_comments();

drop trigger if exists decrement_comments_count on public.comments;
create trigger decrement_comments_count
  after delete on public.comments
  for each row
  execute procedure public.decrement_post_comments();

drop trigger if exists update_comments_updated_at on public.comments;
create trigger update_comments_updated_at
  before update on public.comments
  for each row
  execute procedure public.update_updated_at_column();
