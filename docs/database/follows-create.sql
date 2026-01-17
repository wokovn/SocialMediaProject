-- ==========================================
-- FOLLOWS TABLE (Follow/Following Relationships)
-- ==========================================

-- 1. Create follows table
create table if not exists public.follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references public.users(id) on delete cascade not null,
  following_id uuid references public.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent duplicate follows and self-follows
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

-- 2. Create indexes for performance
create index if not exists idx_follows_follower_id on public.follows(follower_id);
create index if not exists idx_follows_following_id on public.follows(following_id);
create index if not exists idx_follows_created_at on public.follows(created_at desc);

-- 3. Enable Row Level Security
alter table public.follows enable row level security;

-- Drop existing policies
drop policy if exists "Follows are viewable by everyone." on public.follows;
drop policy if exists "Users can follow others." on public.follows;
drop policy if exists "Users can unfollow others." on public.follows;

-- 4. Create RLS Policies
-- Follows are public (for follower/following counts)
create policy "Follows are viewable by everyone."
  on public.follows for select
  using ( true );

-- Users can follow others
create policy "Users can follow others."
  on public.follows for insert
  with check ( auth.uid() = follower_id );

-- Users can unfollow
create policy "Users can unfollow others."
  on public.follows for delete
  using ( auth.uid() = follower_id );

-- 5. Create user_stats table to track follower/following counts
create table if not exists public.user_stats (
  user_id uuid references public.users(id) on delete cascade primary key,
  followers_count integer default 0,
  following_count integer default 0,
  posts_count integer default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index
create index if not exists idx_user_stats_user_id on public.user_stats(user_id);

-- Enable RLS
alter table public.user_stats enable row level security;

drop policy if exists "User stats are viewable by everyone." on public.user_stats;
create policy "User stats are viewable by everyone."
  on public.user_stats for select
  using ( true );

-- 6. Create function to initialize user stats
create or replace function public.init_user_stats()
returns trigger
language plpgsql
as $$
begin
  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- 7. Create trigger to init stats when user is created
drop trigger if exists init_user_stats_trigger on public.users;
create trigger init_user_stats_trigger
  after insert on public.users
  for each row
  execute procedure public.init_user_stats();

-- 8. Create function to update follower counts
create or replace function public.increment_follow_counts()
returns trigger
language plpgsql
as $$
begin
  -- Increment following_count for follower
  update public.user_stats
  set following_count = following_count + 1,
      updated_at = timezone('utc'::text, now())
  where user_id = new.follower_id;
  
  -- Increment followers_count for following
  update public.user_stats
  set followers_count = followers_count + 1,
      updated_at = timezone('utc'::text, now())
  where user_id = new.following_id;
  
  return new;
end;
$$;

create or replace function public.decrement_follow_counts()
returns trigger
language plpgsql
as $$
begin
  -- Decrement following_count for follower
  update public.user_stats
  set following_count = following_count - 1,
      updated_at = timezone('utc'::text, now())
  where user_id = old.follower_id;
  
  -- Decrement followers_count for following
  update public.user_stats
  set followers_count = followers_count - 1,
      updated_at = timezone('utc'::text, now())
  where user_id = old.following_id;
  
  return old;
end;
$$;

-- 9. Create triggers for follow counts
drop trigger if exists increment_follow_counts_trigger on public.follows;
create trigger increment_follow_counts_trigger
  after insert on public.follows
  for each row
  execute procedure public.increment_follow_counts();

drop trigger if exists decrement_follow_counts_trigger on public.follows;
create trigger decrement_follow_counts_trigger
  after delete on public.follows
  for each row
  execute procedure public.decrement_follow_counts();
