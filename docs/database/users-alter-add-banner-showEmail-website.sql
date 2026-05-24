-- Thêm các cột mới vào bảng users (không reset DB, chỉ ALTER)
-- Chạy lệnh này trong Supabase SQL Editor hoặc psql

-- 1. Thêm cột banner (URL ảnh bìa)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS banner TEXT;

-- 2. Thêm cột show_email (hiện/ẩn email trên profile công khai)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Thêm cột website (link website cá nhân)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS website TEXT;

-- 4. Tạo index full-text search cho username và full_name
--    Dùng GIN index + tsvector để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS users_fts_idx
  ON public.users
  USING GIN (
    to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(username, ''))
  );

-- 5. Tạo index full-text search cho posts.content
CREATE INDEX IF NOT EXISTS posts_fts_idx
  ON public.posts
  USING GIN (
    to_tsvector('simple', coalesce(content, ''))
  );
