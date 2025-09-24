-- Add description column to exercises table

-- Add description column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'exercises'
        AND column_name = 'description'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises ADD COLUMN description text;
        RAISE NOTICE 'Added description column to exercises table';
    ELSE
        RAISE NOTICE 'Description column already exists in exercises table';
    END IF;
END $$;





