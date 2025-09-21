-- Fix RLS policies for daily_quests table

-- First, add session_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_quests'
        AND column_name = 'session_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.daily_quests ADD COLUMN session_id uuid;
        RAISE NOTICE 'Added session_id column to daily_quests table';
    END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can read own daily quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users can update own daily quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users can insert own daily quests" ON public.daily_quests;

-- Create proper RLS policies
CREATE POLICY "Users can read own daily quests" ON public.daily_quests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own daily quests" ON public.daily_quests
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily quests" ON public.daily_quests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Also fix the function to use auth.uid() instead of the parameter
CREATE OR REPLACE FUNCTION public.get_today_daily_quest_simple(user_uuid uuid)
RETURNS json AS $$
DECLARE
    today_date date;
    quest_record record;
    random_exercise record;
    new_quest_id uuid;
    current_user_id uuid;
BEGIN
    today_date := CURRENT_DATE;
    current_user_id := auth.uid(); -- Use auth.uid() instead of parameter

    -- Check if user already has a quest for today
    SELECT
        dq.*,
        e.title as exercise_title,
        e.exercise_type,
        COALESCE(s.title, 'Unknown Session') as session_title,
        COALESCE(u.title, 'Unknown Unit') as unit_title,
        COALESCE(l.title, 'Unknown Level') as level_title
    INTO quest_record
    FROM public.daily_quests dq
    JOIN public.exercises e ON dq.exercise_id = e.id
    LEFT JOIN public.sessions s ON e.session_id = s.id
    LEFT JOIN public.units u ON s.unit_id = u.id
    LEFT JOIN public.levels l ON u.level_id = l.id
    WHERE dq.user_id = current_user_id
    AND dq.quest_date = today_date;

    -- If quest exists, return it
    IF quest_record.id IS NOT NULL THEN
        RETURN json_build_object(
            'quest_id', quest_record.id,
            'exercise_id', quest_record.exercise_id,
            'session_id', quest_record.session_id,
            'exercise_title', quest_record.exercise_title,
            'exercise_type', quest_record.exercise_type,
            'session_title', quest_record.session_title,
            'unit_title', quest_record.unit_title,
            'level_title', quest_record.level_title,
            'status', quest_record.status,
            'xp_reward', quest_record.xp_reward,
            'quest_date', quest_record.quest_date
        );
    END IF;

    -- Get a random exercise
    SELECT
        e.*,
        s.title as session_title,
        s.id as session_id,
        u.title as unit_title,
        l.title as level_title
    INTO random_exercise
    FROM public.exercises e
    JOIN public.sessions s ON e.session_id = s.id
    JOIN public.units u ON s.unit_id = u.id
    JOIN public.levels l ON u.level_id = l.id
    ORDER BY RANDOM()
    LIMIT 1;

    -- If no exercise found, return null
    IF random_exercise.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Create new quest
    new_quest_id := uuid_generate_v4();

    INSERT INTO public.daily_quests (
        id,
        user_id,
        exercise_id,
        session_id,
        quest_date,
        status,
        xp_reward
    ) VALUES (
        new_quest_id,
        current_user_id,
        random_exercise.id,
        random_exercise.session_id,
        today_date,
        'available',
        50
    );

    -- Return the new quest
    RETURN json_build_object(
        'quest_id', new_quest_id,
        'exercise_id', random_exercise.id,
        'session_id', random_exercise.session_id,
        'exercise_title', random_exercise.title,
        'exercise_type', random_exercise.exercise_type,
        'session_title', random_exercise.session_title,
        'unit_title', random_exercise.unit_title,
        'level_title', random_exercise.level_title,
        'status', 'available',
        'xp_reward', 50,
        'quest_date', today_date
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error in get_today_daily_quest_simple: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'RLS policies fixed! The frontend should now be able to read daily quests.' as message;