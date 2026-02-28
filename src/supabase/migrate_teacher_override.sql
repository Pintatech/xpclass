-- Add teacher override columns to test_question_attempts
ALTER TABLE public.test_question_attempts ADD COLUMN IF NOT EXISTS teacher_override boolean DEFAULT false;
ALTER TABLE public.test_question_attempts ADD COLUMN IF NOT EXISTS teacher_is_correct boolean;
ALTER TABLE public.test_question_attempts ADD COLUMN IF NOT EXISTS teacher_note text;
ALTER TABLE public.test_question_attempts ADD COLUMN IF NOT EXISTS overridden_by uuid REFERENCES public.users(id);
ALTER TABLE public.test_question_attempts ADD COLUMN IF NOT EXISTS overridden_at timestamp with time zone;

-- Allow teachers/admins to update test_question_attempts (for overrides)
CREATE POLICY "Teachers update test question attempts" ON public.test_question_attempts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );

-- Allow teachers/admins to update test_attempts (for score recalculation)
CREATE POLICY "Teachers update test attempts" ON public.test_attempts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );
