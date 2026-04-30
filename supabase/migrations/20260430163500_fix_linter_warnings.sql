-- Fix "Function Search Path Mutable" warnings
ALTER FUNCTION public.decrement_follow_counts() SET search_path = '';
ALTER FUNCTION public.decrement_likes_count() SET search_path = '';
ALTER FUNCTION public.decrement_post_comments() SET search_path = '';
ALTER FUNCTION public.decrement_post_shares_count() SET search_path = '';
ALTER FUNCTION public.increment_follow_counts() SET search_path = '';
ALTER FUNCTION public.increment_likes_count() SET search_path = '';
ALTER FUNCTION public.increment_post_comments() SET search_path = '';
ALTER FUNCTION public.increment_post_shares_count() SET search_path = '';
ALTER FUNCTION public.init_user_stats() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Fix "Public Can See Object in GraphQL Schema" warnings
-- Revoke SELECT on these tables from anon so they aren't visible in GraphQL schema to unauthorized users
REVOKE SELECT ON TABLE public.bookmarks FROM anon;
REVOKE SELECT ON TABLE public.comments FROM anon;
