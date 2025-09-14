-- Add progress tracking for individual questions in exercises
-- This allows users to resume from where they left off

-- Add current_question_index to user_progress table
ALTER TABLE public.user_progress
ADD COLUMN IF NOT EXISTS current_question_index integer DEFAULT 0;

-- Add session progress tracking table for detailed session-level progress
CREATE TABLE IF NOT EXISTS public.exercise_progress (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  current_question_index integer DEFAULT 0,
  total_questions integer DEFAULT 0,
  questions_answered integer DEFAULT 0,
  questions_correct integer DEFAULT 0,
  question_results jsonb DEFAULT '[]'::jsonb, -- Array of question results for review
  last_resumed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

-- Enable RLS for exercise_progress table
ALTER TABLE public.exercise_progress ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for exercise_progress
DROP POLICY IF EXISTS "Users manage own exercise progress" ON public.exercise_progress;
CREATE POLICY "Users manage own exercise progress" ON public.exercise_progress
  FOR ALL USING (auth.uid() = user_id);

-- Add updated_at trigger for exercise_progress
DROP TRIGGER IF EXISTS update_exercise_progress_updated_at ON public.exercise_progress;
CREATE TRIGGER update_exercise_progress_updated_at
  BEFORE UPDATE ON public.exercise_progress
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_exercise_progress_user_exercise ON public.exercise_progress(user_id, exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_progress_session ON public.exercise_progress(session_id);