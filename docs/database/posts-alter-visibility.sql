-- ==========================================
-- ALTER POSTS TABLE - Update Visibility Check Constraint
-- ==========================================

-- 1. Drop the old check constraint
-- Note: The constraint name might be auto-generated, so you may need to find it first
-- Run this query to find the constraint name:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.posts'::regclass AND contype = 'c';

-- Drop constraint by name (replace 'posts_visibility_check' with actual name if different)
alter table public.posts drop constraint if exists posts_visibility_check;

-- 2. Add the new check constraint with 'deleted' option
alter table public.posts 
  add constraint posts_visibility_check 
  check (visibility in ('public', 'private', 'followers', 'deleted'));

-- 3. Optionally update the RLS policy to handle deleted posts
drop policy if exists "Posts are viewable by everyone." on public.posts;

create policy "Posts are viewable by everyone."
  on public.posts for select
  using (
    (visibility = 'public' and deleted_at is null)
    or user_id = auth.uid()
    or (visibility = 'followers' and deleted_at is null and exists (
      select 1 from public.follows 
      where follower_id = auth.uid() and following_id = posts.user_id
    ))
  );
