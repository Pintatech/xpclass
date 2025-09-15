-- Fix existing exercises before applying new constraint
-- This script updates old exercise types to valid ones

-- First, let's see what exercise types currently exist
SELECT 
    exercise_type, 
    COUNT(*) as count
FROM public.exercises 
GROUP BY exercise_type 
ORDER BY exercise_type;

-- Update old exercise types to valid ones
UPDATE public.exercises 
SET exercise_type = 'flashcard'
WHERE exercise_type IN ('song', 'karaoke', 'snake_ladder', 'two_player');

-- Show the updated counts
SELECT 
    exercise_type, 
    COUNT(*) as count
FROM public.exercises 
GROUP BY exercise_type 
ORDER BY exercise_type;

-- Now we can safely apply the new constraint
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'exercises_exercise_type_check' 
        AND table_name = 'exercises'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises DROP CONSTRAINT exercises_exercise_type_check;
        RAISE NOTICE 'Dropped existing exercise_type constraint';
    END IF;
    
    -- Add new constraint
    ALTER TABLE public.exercises ADD CONSTRAINT exercises_exercise_type_check 
    CHECK (exercise_type IN ('flashcard', 'audio_flashcard', 'video', 'multiple_choice'));
    RAISE NOTICE 'Added new exercise_type constraint';
END $$;

