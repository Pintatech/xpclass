-- Add image_url column to exercises table
-- Run this in Supabase SQL Editor if the column doesn't exist

-- Check if image_url column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'exercises' 
        AND column_name = 'image_url'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises ADD COLUMN image_url text;
        RAISE NOTICE 'Added image_url column to exercises table';
    ELSE
        RAISE NOTICE 'image_url column already exists in exercises table';
    END IF;
END $$;
