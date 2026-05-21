


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."decrement_follow_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."decrement_follow_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."decrement_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_post_comments"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."decrement_post_comments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_post_shares_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.posts
  set shares_count = greatest(shares_count - 1, 0)
  where id = old.shared_post_id;

  return old;
end;
$$;


ALTER FUNCTION "public"."decrement_post_shares_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.users (id, email, username, full_name, created_at, updated_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.created_at,
    new.created_at
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_follow_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."increment_follow_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."increment_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_post_comments"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."increment_post_comments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_post_shares_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.posts
  set shares_count = shares_count + 1
  where id = new.shared_post_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."increment_post_shares_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."init_user_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."init_user_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookmarks" (
    "id" "uuid" DEFAULT public.uuid_generate_v7() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT public.uuid_generate_v7() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "content" "text" NOT NULL,
    "likes_count" integer DEFAULT 0,
    "replies_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT public.uuid_generate_v7() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "follows_check" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT public.uuid_generate_v7() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "comment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "likes_check" CHECK (((("post_id" IS NOT NULL) AND ("comment_id" IS NULL)) OR (("post_id" IS NULL) AND ("comment_id" IS NOT NULL))))
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media" (
    "id" "uuid" DEFAULT public.uuid_generate_v7() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "file_size" integer,
    "width" integer,
    "height" integer,
    "duration" integer,
    "thumbnail_url" "text",
    "alt_text" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "media_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT public.uuid_generate_v7() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text",
    "likes_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "shares_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "deleted_at" timestamp with time zone,
    "shared_post_id" "uuid",
    CONSTRAINT "posts_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text", 'followers'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_stats" (
    "user_id" "uuid" NOT NULL,
    "followers_count" integer DEFAULT 0,
    "following_count" integer DEFAULT 0,
    "posts_count" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "username" "text",
    "avatar" "text",
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "deleted_at" timestamp with time zone,
    "full_name" "text" DEFAULT '''user_'' || substr(gen_random_uuid()::text, 1, 6)'::"text" NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."full_name" IS 'User full name or display name';



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_comment_id_key" UNIQUE ("user_id", "comment_id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "idx_bookmarks_created_at" ON "public"."bookmarks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_bookmarks_post_id" ON "public"."bookmarks" USING "btree" ("post_id");



CREATE INDEX "idx_bookmarks_user_id" ON "public"."bookmarks" USING "btree" ("user_id");



CREATE INDEX "idx_comments_created_at" ON "public"."comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_comments_parent_id" ON "public"."comments" USING "btree" ("parent_id");



CREATE INDEX "idx_comments_post_id" ON "public"."comments" USING "btree" ("post_id");



CREATE INDEX "idx_comments_user_id" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "idx_follows_created_at" ON "public"."follows" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_follows_follower_id" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "idx_follows_following_id" ON "public"."follows" USING "btree" ("following_id");



CREATE INDEX "idx_likes_comment_id" ON "public"."likes" USING "btree" ("comment_id") WHERE ("comment_id" IS NOT NULL);



CREATE INDEX "idx_likes_created_at" ON "public"."likes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_likes_post_id" ON "public"."likes" USING "btree" ("post_id") WHERE ("post_id" IS NOT NULL);



CREATE INDEX "idx_likes_user_id" ON "public"."likes" USING "btree" ("user_id");



CREATE INDEX "idx_media_created_at" ON "public"."media" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_media_display_order" ON "public"."media" USING "btree" ("post_id", "display_order");



CREATE INDEX "idx_media_post_id" ON "public"."media" USING "btree" ("post_id");



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_deleted_at" ON "public"."posts" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_posts_shared_post_id" ON "public"."posts" USING "btree" ("shared_post_id") WHERE ("shared_post_id" IS NOT NULL);



CREATE INDEX "idx_posts_user_id" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_user_stats_user_id" ON "public"."user_stats" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_users_username_lower" ON "public"."users" USING "btree" ("lower"("username"));



CREATE OR REPLACE TRIGGER "decrement_comments_count" AFTER DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_post_comments"();



CREATE OR REPLACE TRIGGER "decrement_follow_counts_trigger" AFTER DELETE ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_follow_counts"();



CREATE OR REPLACE TRIGGER "decrement_likes_count_trigger" AFTER DELETE ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_likes_count"();



CREATE OR REPLACE TRIGGER "increment_comments_count" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."increment_post_comments"();



CREATE OR REPLACE TRIGGER "increment_follow_counts_trigger" AFTER INSERT ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."increment_follow_counts"();



CREATE OR REPLACE TRIGGER "increment_likes_count_trigger" AFTER INSERT ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."increment_likes_count"();



CREATE OR REPLACE TRIGGER "init_user_stats_trigger" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."init_user_stats"();



CREATE OR REPLACE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_shared_post_id_fkey" FOREIGN KEY ("shared_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Comments are viewable by everyone." ON "public"."comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "comments"."post_id") AND (("posts"."visibility" = 'public'::"text") OR ("posts"."user_id" = "auth"."uid"()) OR (("posts"."visibility" = 'followers'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."follows"
          WHERE (("follows"."follower_id" = "auth"."uid"()) AND ("follows"."following_id" = "posts"."user_id"))))))))));



CREATE POLICY "Follows are viewable by everyone." ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "Likes are viewable by everyone." ON "public"."likes" FOR SELECT USING (true);



CREATE POLICY "Media are viewable by everyone." ON "public"."media" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "media"."post_id") AND (("posts"."visibility" = 'public'::"text") OR ("posts"."user_id" = "auth"."uid"()) OR (("posts"."visibility" = 'followers'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."follows"
          WHERE (("follows"."follower_id" = "auth"."uid"()) AND ("follows"."following_id" = "posts"."user_id"))))))))));



CREATE POLICY "Posts are viewable by everyone." ON "public"."posts" FOR SELECT USING (((("visibility" = 'public'::"text") AND ("deleted_at" IS NULL)) OR ("user_id" = "auth"."uid"()) OR (("visibility" = 'followers'::"text") AND ("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."follows"
  WHERE (("follows"."follower_id" = "auth"."uid"()) AND ("follows"."following_id" = "posts"."user_id")))))));



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "User stats are viewable by everyone." ON "public"."user_stats" FOR SELECT USING (true);



CREATE POLICY "Users can create bookmarks." ON "public"."bookmarks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete media from their own posts." ON "public"."media" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "media"."post_id") AND ("posts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own bookmarks." ON "public"."bookmarks" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments." ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own posts." ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow others." ON "public"."follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can insert comments." ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert media for their own posts." ON "public"."media" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "media"."post_id") AND ("posts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own posts." ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile." ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can like posts/comments." ON "public"."likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unfollow others." ON "public"."follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can unlike posts/comments." ON "public"."likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile." ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own comments." ON "public"."comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own posts." ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own bookmarks." ON "public"."bookmarks" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."bookmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."decrement_follow_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_follow_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_follow_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_post_comments"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_post_comments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_post_comments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_post_shares_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_post_shares_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_post_shares_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_follow_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_follow_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_follow_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_post_comments"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_post_comments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_post_comments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_post_shares_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_post_shares_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_post_shares_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."init_user_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."init_user_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."init_user_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."media" TO "anon";
GRANT ALL ON TABLE "public"."media" TO "authenticated";
GRANT ALL ON TABLE "public"."media" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


