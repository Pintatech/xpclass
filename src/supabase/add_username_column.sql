-- Add username column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Add index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- Update existing users to have username = email prefix (temporary)
UPDATE public.users
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL;
