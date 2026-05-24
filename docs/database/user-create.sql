-- 1. Tạo bảng users (Nếu TypeORM chưa tạo kịp)
-- Mình link cứng id của bảng này với id của auth.users luôn cho chắc cú.
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique,
  username text unique,
  full_name text,
  avatar text,
  banner text,           -- URL ảnh bìa (cover photo)
  bio text,
  website text,          -- Link website cá nhân
  show_email boolean not null default false,  -- Hiện/ẩn email trên profile công khai
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone
);

-- 2. Bật Row Level Security (RLS) lên cho an toàn (Best Practice)
alter table public.users enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Public profiles are viewable by everyone." on public.users;
drop policy if exists "Users can insert their own profile." on public.users;
drop policy if exists "Users can update own profile." on public.users;

-- Tạo Policy: Ai cũng xem được Profile công khai
create policy "Public profiles are viewable by everyone."
  on public.users for select
  using ( true );

-- Tạo Policy: Chỉ chính chủ mới được sửa Profile của mình
create policy "Users can insert their own profile."
  on public.users for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on public.users for update
  using ( auth.uid() = id );

-- 3. Tạo Hàm xử lý (Function)
-- Hàm này sẽ được gọi khi có user mới đăng ký
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
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

-- 4. Tạo Trigger
-- Gắn cái hàm trên vào bảng auth.users
-- Cứ có INSERT bên auth.users là hàm này chạy ngay lập tức!
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();