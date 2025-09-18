-- Add progress_data column to user_progress table for storing detailed progress
-- This allows resume functionality without creating a new table

-- Add progress_data JSONB column to store detailed question-level progress
ALTER TABLE public.user_progress
ADD COLUMN IF NOT EXISTS progress_data jsonb DEFAULT '{}'::jsonb;

-- Add an index for performance on the JSONB column
CREATE INDEX IF NOT EXISTS idx_user_progress_progress_data ON public.user_progress USING gin(progress_data);