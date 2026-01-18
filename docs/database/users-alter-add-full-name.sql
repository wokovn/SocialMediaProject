-- ==========================================
-- ALTER USERS TABLE - Add Full Name Column
-- ==========================================

-- Add full_name column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS full_name text;

-- Optional: Add a comment to describe the column
COMMENT ON COLUMN public.users.full_name IS 'User full name or display name';

-- Optional: Set a default value for existing rows
-- UPDATE public.users SET full_name = '' WHERE full_name IS NULL;

-- Optional: Make the column NOT NULL (uncomment if needed)
-- ALTER TABLE public.users ALTER COLUMN full_name SET NOT NULL;
