-- Add dropdown support to exercise types
-- Run this in Supabase SQL editor

-- First, drop the existing constraint
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;

-- Add the new constraint with dropdown support
ALTER TABLE public.exercises ADD CONSTRAINT exercises_exercise_type_check
CHECK (exercise_type IN ('flashcard', 'pronunciation', 'fill_blank', 'video', 'quiz', 'multiple_choice', 'listening', 'speaking', 'drag_drop', 'dropdown', 'ai_fill_blank'));

-- Add comment to document the new exercise type
COMMENT ON COLUMN public.exercises.exercise_type IS 'Exercise types: flashcard, pronunciation, fill_blank, video, quiz, multiple_choice, listening, speaking, drag_drop, dropdown, ai_fill_blank';