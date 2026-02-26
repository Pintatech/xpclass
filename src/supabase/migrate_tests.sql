-- Drop old test tables (no longer needed - tests are now session-based)
DROP TABLE IF EXISTS public.test_exercises CASCADE;
DROP TABLE IF EXISTS public.tests CASCADE;

-- Drop old test_attempts/test_question_attempts if they reference the old tests table
DROP TABLE IF EXISTS public.test_question_attempts CASCADE;
DROP TABLE IF EXISTS public.test_attempts CASCADE;

-- Add test-related columns to sessions table
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS time_limit_minutes integer DEFAULT 30;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS passing_score integer DEFAULT 70;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 1;

-- Test attempts: tracks each student's test submission (linked to session)
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  score integer CHECK (score >= 0 AND score <= 100),
  passed boolean,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  time_used_seconds integer,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT test_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT test_attempts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT test_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Individual question tracking within a test attempt
CREATE TABLE IF NOT EXISTS public.test_question_attempts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  test_attempt_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  question_index integer NOT NULL DEFAULT 0,
  exercise_type text,
  selected_answer jsonb,
  correct_answer jsonb,
  is_correct boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT test_question_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT test_question_attempts_attempt_id_fkey FOREIGN KEY (test_attempt_id) REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  CONSTRAINT test_question_attempts_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);

-- Add draft_answers column for saving progress mid-test
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS draft_answers jsonb;

-- RLS policies
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_question_attempts ENABLE ROW LEVEL SECURITY;

-- Students can create/view their own attempts
CREATE POLICY "Users manage own test attempts" ON public.test_attempts
  FOR ALL USING (user_id = auth.uid());

-- Teachers can view all attempts for sessions they teach
CREATE POLICY "Teachers view test attempts" ON public.test_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );

-- Users manage own question attempts
CREATE POLICY "Users manage own test question attempts" ON public.test_question_attempts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.test_attempts
      WHERE id = test_question_attempts.test_attempt_id AND user_id = auth.uid()
    )
  );

-- Teachers can view question attempts
CREATE POLICY "Teachers view test question attempts" ON public.test_question_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );
