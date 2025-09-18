-- Add multiple_choice to exercise_type enum
-- Note: This requires dropping and recreating the constraint, or using ALTER TYPE if supported

-- First, add the new exercise type to the check constraint
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_exercise_type_check
  CHECK (exercise_type IN ('flashcard', 'pronunciation', 'audio_flashcard', 'video', 'quiz', 'multiple_choice', 'listening', 'speaking'));

-- Create the question_attempts table for tracking wrong questions and retry functionality
CREATE TABLE IF NOT EXISTS public.question_attempts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE,
  question_id text NOT NULL, -- identifier for specific question within exercise
  selected_answer text,
  correct_answer text,
  is_correct boolean NOT NULL,
  attempt_number integer DEFAULT 1,
  response_time integer, -- in milliseconds
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for question_attempts table
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for question_attempts
DROP POLICY IF EXISTS "Users manage own question attempts" ON public.question_attempts;
CREATE POLICY "Users manage own question attempts" ON public.question_attempts
  FOR ALL USING (auth.uid() = user_id);

-- Add updated_at trigger for question_attempts
DROP TRIGGER IF EXISTS update_question_attempts_updated_at ON public.question_attempts;
CREATE TRIGGER update_question_attempts_updated_at
  BEFORE UPDATE ON public.question_attempts
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Insert sample multiple choice exercise
INSERT INTO public.exercises (id, session_id, title, exercise_type, content, difficulty_level, xp_reward, order_index)
VALUES (
  '550e8400-e29b-41d4-a716-446655440034',
  '550e8400-e29b-41d4-a716-446655440021',
  'Trắc nghiệm chào hỏi',
  'multiple_choice',
  '{"questions": [
    {
      "id": "q1",
      "question": "What does \"Hello\" mean in Vietnamese?",
      "options": ["Xin chào", "Tạm biệt", "Cảm ơn", "Xin lỗi"],
      "correct_answer": 0,
      "explanation": "Hello means Xin chào in Vietnamese. It is the most common greeting used in both formal and informal situations."
    },
    {
      "id": "q2",
      "question": "How do you say \"Good morning\" in Vietnamese?",
      "options": ["Chào buổi tối", "Chào buổi chiều", "Chào buổi sáng", "Tạm biệt"],
      "correct_answer": 2,
      "explanation": "Good morning is Chào buổi sáng in Vietnamese. Buổi sáng specifically means morning time."
    }
  ]}',
  1,
  15,
  3
) ON CONFLICT (id) DO NOTHING;