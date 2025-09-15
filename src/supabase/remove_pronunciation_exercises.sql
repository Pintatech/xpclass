-- Remove pronunciation and combined_learning exercises from the database
-- This migration cleans up pronunciation, sentence_pronunciation, and combined_learning exercises

-- First, show what will be removed
SELECT
    'Before removal:' as status,
    exercise_type,
    COUNT(*) as count
FROM public.exercises
WHERE exercise_type IN ('pronunciation', 'sentence_pronunciation', 'combined_learning')
GROUP BY exercise_type
ORDER BY exercise_type;

-- Remove pronunciation exercises and their related data
BEGIN;

-- Delete user progress for removed exercises
DELETE FROM public.user_progress
WHERE exercise_id IN (
    SELECT id FROM public.exercises
    WHERE exercise_type IN ('pronunciation', 'sentence_pronunciation', 'combined_learning')
);

-- Delete question attempts for removed exercises (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'question_attempts') THEN
        DELETE FROM public.question_attempts
        WHERE exercise_id IN (
            SELECT id FROM public.exercises
            WHERE exercise_type IN ('pronunciation', 'sentence_pronunciation', 'combined_learning')
        );
    END IF;
END $$;

-- Delete the removed exercises themselves
DELETE FROM public.exercises
WHERE exercise_type IN ('pronunciation', 'sentence_pronunciation', 'combined_learning');

COMMIT;

-- Show results
SELECT
    'After removal - remaining exercise types:' as status,
    exercise_type,
    COUNT(*) as count
FROM public.exercises
GROUP BY exercise_type
ORDER BY exercise_type;

-- Update session types to remove pronunciation
UPDATE public.sessions
SET session_type = 'mixed'
WHERE session_type = 'pronunciation';

RAISE NOTICE 'Pronunciation and combined learning exercises and related data have been removed successfully';