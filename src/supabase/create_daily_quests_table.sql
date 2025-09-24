-- Create daily_quests table if it doesn't exist
-- Tracks a user's daily quest tied to a specific exercise

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_quests'
  ) THEN
    CREATE TABLE public.daily_quests (
      id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
      quest_date date NOT NULL,
      status text NOT NULL CHECK (status IN ('available', 'completed', 'claimed')) DEFAULT 'available',
      reward_xp integer DEFAULT 10,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      UNIQUE(user_id, quest_date)
    );

    -- Helpful indexes
    CREATE INDEX IF NOT EXISTS idx_daily_quests_user_date ON public.daily_quests(user_id, quest_date);
    CREATE INDEX IF NOT EXISTS idx_daily_quests_exercise ON public.daily_quests(exercise_id);

    RAISE NOTICE 'Created table public.daily_quests';
  ELSE
    RAISE NOTICE 'Table public.daily_quests already exists';
  END IF;
END $$;






