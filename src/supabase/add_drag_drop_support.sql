-- Add drag_drop support to exercise types
-- Run this in Supabase SQL editor

-- First, drop the existing constraint
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;

-- Add the new constraint with drag_drop support
ALTER TABLE public.exercises ADD CONSTRAINT exercises_exercise_type_check 
CHECK (exercise_type IN ('flashcard', 'pronunciation', 'fill_blank', 'video', 'quiz', 'multiple_choice', 'listening', 'speaking', 'drag_drop'));

-- Add comment to document the new exercise type
COMMENT ON COLUMN public.exercises.exercise_type IS 'Exercise types: flashcard, pronunciation, fill_blank, video, quiz, multiple_choice, listening, speaking, drag_drop';

-- Example content structure for drag_drop exercises:
-- {
--   "question": "Sắp xếp các từ để tạo thành câu hoàn chỉnh",
--   "items": [
--     {"id": "1", "text": "I", "type": "word", "image": "optional_image_url"},
--     {"id": "2", "text": "am", "type": "word"},
--     {"id": "3", "text": "a", "type": "word"},
--     {"id": "4", "text": "student", "type": "word"}
--   ],
--   "correct_order": ["1", "2", "3", "4"],
--   "drop_zones": [
--     {"id": "zone1", "position": 1, "label": "Position 1"},
--     {"id": "zone2", "position": 2, "label": "Position 2"},
--     {"id": "zone3", "position": 3, "label": "Position 3"},
--     {"id": "zone4", "position": 4, "label": "Position 4"}
--   ],
--   "settings": {
--     "allow_undo": true,
--     "show_hints": true,
--     "max_attempts": 3,
--     "time_limit": 300
--   }
-- }
