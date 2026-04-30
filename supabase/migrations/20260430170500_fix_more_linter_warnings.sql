-- Fix "Suboptimal query performance" warnings by replacing auth.uid() with (select auth.uid())

DROP POLICY IF EXISTS "Comments are viewable by everyone." ON "public"."comments";
CREATE POLICY "Comments are viewable by everyone." ON "public"."comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "comments"."post_id") AND (("posts"."visibility" = 'public'::text) OR ("posts"."user_id" = (select auth.uid())) OR (("posts"."visibility" = 'followers'::text) AND (EXISTS ( SELECT 1
           FROM "public"."follows"
          WHERE (("follows"."follower_id" = (select auth.uid())) AND ("follows"."following_id" = "posts"."user_id"))))))))));

DROP POLICY IF EXISTS "Media are viewable by everyone." ON "public"."media";
CREATE POLICY "Media are viewable by everyone." ON "public"."media" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "media"."post_id") AND (("posts"."visibility" = 'public'::text) OR ("posts"."user_id" = (select auth.uid())) OR (("posts"."visibility" = 'followers'::text) AND (EXISTS ( SELECT 1
           FROM "public"."follows"
          WHERE (("follows"."follower_id" = (select auth.uid())) AND ("follows"."following_id" = "posts"."user_id"))))))))));

DROP POLICY IF EXISTS "Posts are viewable by everyone." ON "public"."posts";
CREATE POLICY "Posts are viewable by everyone." ON "public"."posts" FOR SELECT USING (((("visibility" = 'public'::text) AND ("deleted_at" IS NULL)) OR ("user_id" = (select auth.uid())) OR (("visibility" = 'followers'::text) AND ("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."follows"
  WHERE (("follows"."follower_id" = (select auth.uid())) AND ("follows"."following_id" = "posts"."user_id")))))));

DROP POLICY IF EXISTS "Users can create bookmarks." ON "public"."bookmarks";
CREATE POLICY "Users can create bookmarks." ON "public"."bookmarks" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can delete media from their own posts." ON "public"."media";
CREATE POLICY "Users can delete media from their own posts." ON "public"."media" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "media"."post_id") AND ("posts"."user_id" = (select auth.uid()))))));

DROP POLICY IF EXISTS "Users can delete their own bookmarks." ON "public"."bookmarks";
CREATE POLICY "Users can delete their own bookmarks." ON "public"."bookmarks" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can delete their own comments." ON "public"."comments";
CREATE POLICY "Users can delete their own comments." ON "public"."comments" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can delete their own posts." ON "public"."posts";
CREATE POLICY "Users can delete their own posts." ON "public"."posts" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can follow others." ON "public"."follows";
CREATE POLICY "Users can follow others." ON "public"."follows" FOR INSERT WITH CHECK (((select auth.uid()) = "follower_id"));

DROP POLICY IF EXISTS "Users can insert comments." ON "public"."comments";
CREATE POLICY "Users can insert comments." ON "public"."comments" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can insert media for their own posts." ON "public"."media";
CREATE POLICY "Users can insert media for their own posts." ON "public"."media" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "media"."post_id") AND ("posts"."user_id" = (select auth.uid()))))));

DROP POLICY IF EXISTS "Users can insert their own posts." ON "public"."posts";
CREATE POLICY "Users can insert their own posts." ON "public"."posts" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can insert their own profile." ON "public"."users";
CREATE POLICY "Users can insert their own profile." ON "public"."users" FOR INSERT WITH CHECK (((select auth.uid()) = "id"));

DROP POLICY IF EXISTS "Users can like posts/comments." ON "public"."likes";
CREATE POLICY "Users can like posts/comments." ON "public"."likes" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can unfollow others." ON "public"."follows";
CREATE POLICY "Users can unfollow others." ON "public"."follows" FOR DELETE USING (((select auth.uid()) = "follower_id"));

DROP POLICY IF EXISTS "Users can unlike posts/comments." ON "public"."likes";
CREATE POLICY "Users can unlike posts/comments." ON "public"."likes" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can update own profile." ON "public"."users";
CREATE POLICY "Users can update own profile." ON "public"."users" FOR UPDATE USING (((select auth.uid()) = "id"));

DROP POLICY IF EXISTS "Users can update their own comments." ON "public"."comments";
CREATE POLICY "Users can update their own comments." ON "public"."comments" FOR UPDATE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can update their own posts." ON "public"."posts";
CREATE POLICY "Users can update their own posts." ON "public"."posts" FOR UPDATE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can view their own bookmarks." ON "public"."bookmarks";
CREATE POLICY "Users can view their own bookmarks." ON "public"."bookmarks" FOR SELECT USING (((select auth.uid()) = "user_id"));

-- Fix "Function SECURITY DEFINER" warning for handle_new_user
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
