-- Step 1: Check what exercise types currently exist in the database
-- Run this first to see what values are in your table
SELECT DISTINCT exercise_type, COUNT(*) as count
FROM exercises
GROUP BY exercise_type
ORDER BY exercise_type;

-- Step 2: Drop the existing constraint (if any)
ALTER TABLE exercises
DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;

-- Step 3: Add the updated constraint with all possible types
-- Include all types that exist in your database plus the new 'pronunciation' type
ALTER TABLE exercises
ADD CONSTRAINT exercises_exercise_type_check
CHECK (exercise_type IN (
  'flashcard',
  'fill_blank',
  'multiple_choice',
  'video',
  'quiz',
  'listening',
  'speaking',
  'pronunciation',
  'dropdown',
  'drag_drop',
  'ai_fill_blank'
));

-- Step 4: Verify the constraint was added successfully
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'exercises'::regclass
  AND conname = 'exercises_exercise_type_check';
