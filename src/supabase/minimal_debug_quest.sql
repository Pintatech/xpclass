-- Minimal Debug Version - This will show us exactly what's happening

-- First, let's make sure daily_quests table exists with minimal structure
CREATE TABLE IF NOT EXISTS public.daily_quests (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    session_id uuid,
    quest_date date NOT NULL,
    status text DEFAULT 'available',
    xp_reward integer DEFAULT 50,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Disable RLS temporarily for testing
ALTER TABLE public.daily_quests DISABLE ROW LEVEL SECURITY;

-- Super minimal function that just returns info about what it finds
CREATE OR REPLACE FUNCTION public.get_today_daily_quest_simple(user_uuid uuid)
RETURNS json AS $$
DECLARE
    today_date date;
    exercise_count integer;
    quest_exists boolean;
    random_exercise record;
    insert_result uuid;
BEGIN
    today_date := CURRENT_DATE;

    -- Count total exercises
    SELECT COUNT(*) INTO exercise_count FROM public.exercises;

    -- Check if quest already exists
    SELECT EXISTS(
        SELECT 1 FROM public.daily_quests
        WHERE user_id = user_uuid AND quest_date = today_date
    ) INTO quest_exists;

    -- If quest exists, return existing
    IF quest_exists THEN
        RETURN json_build_object(
            'debug', 'quest_exists',
            'exercise_count', exercise_count,
            'quest_date', today_date
        );
    END IF;

    -- Get any exercise (simplest possible)
    SELECT e.id, e.title, s.id as session_id
    INTO random_exercise
    FROM public.exercises e
    LEFT JOIN public.sessions s ON e.session_id = s.id
    ORDER BY RANDOM()
    LIMIT 1;

    -- Debug: return what we found
    IF random_exercise.id IS NULL THEN
        RETURN json_build_object(
            'debug', 'no_exercise_found',
            'exercise_count', exercise_count
        );
    END IF;

    -- Try to insert
    BEGIN
        INSERT INTO public.daily_quests (user_id, exercise_id, session_id, quest_date)
        VALUES (user_uuid, random_exercise.id, random_exercise.session_id, today_date)
        RETURNING id INTO insert_result;

        RETURN json_build_object(
            'debug', 'success',
            'quest_id', insert_result,
            'exercise_id', random_exercise.id,
            'exercise_title', random_exercise.title,
            'session_id', random_exercise.session_id,
            'status', 'available',
            'xp_reward', 50,
            'quest_date', today_date
        );

    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object(
            'debug', 'insert_failed',
            'error', SQLERRM,
            'exercise_found', random_exercise.title,
            'exercise_count', exercise_count
        );
    END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.get_today_daily_quest_simple(uuid) TO authenticated;

SELECT 'Debug function created. This will tell us exactly what is happening.' as message;