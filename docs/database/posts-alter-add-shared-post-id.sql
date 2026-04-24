-- ==========================================
-- ALTER POSTS: ADD SHARED POST REFERENCE
-- ==========================================

alter table public.posts
add column if not exists shared_post_id uuid references public.posts(id) on delete set null;

create index if not exists idx_posts_shared_post_id
on public.posts(shared_post_id)
where shared_post_id is not null;
