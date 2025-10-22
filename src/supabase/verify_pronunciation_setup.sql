-- Verify the current exercise type constraint
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'exercises'::regclass
  AND conname = 'exercises_exercise_type_check';

-- If you need to update it, run this:
-- (Only run if the constraint doesn't include 'pronunciation')

-- ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;
--
-- ALTER TABLE exercises ADD CONSTRAINT exercises_exercise_type_check
-- CHECK (exercise_type IN (
--   'flashcard',
--   'fill_blank',
--   'multiple_choice',
--   'ai_fill_blank',
--   'drag_drop',
--   'dropdown',
--   'pronunciation'
-- ));

-- Verify all exercise types in your database
SELECT DISTINCT exercise_type, COUNT(*) as count
FROM exercises
GROUP BY exercise_type
ORDER BY exercise_type;
