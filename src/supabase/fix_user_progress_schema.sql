-- Fix user_progress table schema for drag & drop exercises
-- Add missing columns for question-level tracking and XP

-- Add question_index column for tracking individual questions
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS question_index integer DEFAULT 0;

-- Add xp_earned column for tracking XP rewards
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS xp_earned integer DEFAULT 0;

-- Update status constraint to include 'attempted' status
ALTER TABLE public.user_progress 
DROP CONSTRAINT IF EXISTS user_progress_status_check;

ALTER TABLE public.user_progress 
ADD CONSTRAINT user_progress_status_check 
CHECK (status IN ('not_started', 'in_progress', 'completed', 'attempted'));

-- Add comment to document the new columns
COMMENT ON COLUMN public.user_progress.question_index IS 'Index of the current question (0-based)';
COMMENT ON COLUMN public.user_progress.xp_earned IS 'XP points earned from this exercise attempt';
