-- Add real_name and real_avatar_url columns to users table
-- These are set by admin/teacher and cannot be changed by students.
-- Used in reports so parents see actual names, not nicknames/anime avatars.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS real_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS real_avatar_url text;

-- Backfill: set real_name to full_name for existing users (admin can correct later)
UPDATE public.users SET real_name = full_name WHERE real_name IS NULL AND full_name IS NOT NULL;
