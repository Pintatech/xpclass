-- Add xp_earned field to user_progress table to track XP earned for each exercise completion
-- This will be used for the recent activities feed

ALTER TABLE public.user_progress
ADD COLUMN IF NOT EXISTS xp_earned integer DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.user_progress.xp_earned IS 'XP earned when completing this exercise';

-- Update existing completed exercises to have xp_earned equal to exercise xp_reward
UPDATE public.user_progress 
SET xp_earned = (
  SELECT e.xp_reward 
  FROM public.exercises e 
  WHERE e.id = user_progress.exercise_id
)
WHERE status = 'completed' AND xp_earned = 0;

