-- Add image_urls column to exercises table
-- Run this in Supabase SQL Editor

-- Check if image_urls column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'exercises' 
        AND column_name = 'image_urls'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises ADD COLUMN image_urls text[];
        RAISE NOTICE 'Added image_urls column to exercises table';
    ELSE
        RAISE NOTICE 'image_urls column already exists in exercises table';
    END IF;
END $$;

-- If image_url column exists, we can optionally migrate data
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'exercises' 
        AND column_name = 'image_url'
        AND table_schema = 'public'
    ) THEN
        -- Migrate single image_url to image_urls array
        UPDATE public.exercises 
        SET image_urls = CASE 
            WHEN image_url IS NOT NULL AND image_url != '' 
            THEN ARRAY[image_url] 
            ELSE ARRAY[]::text[]
        END
        WHERE image_urls IS NULL;
        
        RAISE NOTICE 'Migrated image_url data to image_urls array';
    END IF;
END $$;
