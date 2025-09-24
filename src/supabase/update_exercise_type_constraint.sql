-- Update exercise_type constraint to support fill_blank and remove audio_flashcard
-- Run this in Supabase SQL editor

-- First, drop the existing constraint
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;

-- Add the new constraint with updated exercise types
ALTER TABLE public.exercises ADD CONSTRAINT exercises_exercise_type_check 
CHECK (exercise_type IN ('flashcard', 'pronunciation', 'fill_blank', 'video', 'quiz', 'multiple_choice', 'listening', 'speaking'));

-- Update any existing audio_flashcard exercises to fill_blank (optional)
-- Uncomment the following line if you want to migrate existing data
-- UPDATE public.exercises SET exercise_type = 'fill_blank' WHERE exercise_type = 'audio_flashcard';





