-- Add 'level' column to users if missing

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'level'
  ) THEN
    ALTER TABLE public.users ADD COLUMN level integer DEFAULT 1;
    RAISE NOTICE 'Added level column to users table';
  ELSE
    RAISE NOTICE 'Level column already exists in users table';
  END IF;
END $$;
