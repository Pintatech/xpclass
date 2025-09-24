-- Exercise Bank Database Schema
-- This adds folder structure and exercise bank functionality

-- Create exercise folders table
CREATE TABLE IF NOT EXISTS public.exercise_folders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  parent_folder_id uuid REFERENCES public.exercise_folders(id) ON DELETE CASCADE,
  description text,
  color text DEFAULT 'blue',
  icon text DEFAULT 'folder',
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add folder support to exercises table
DO $$
BEGIN
    -- Add folder_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'exercises'
        AND column_name = 'folder_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises ADD COLUMN folder_id uuid REFERENCES public.exercise_folders(id);
        RAISE NOTICE 'Added folder_id column to exercises table';
    END IF;

    -- Add is_in_bank column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'exercises'
        AND column_name = 'is_in_bank'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises ADD COLUMN is_in_bank boolean DEFAULT false;
        RAISE NOTICE 'Added is_in_bank column to exercises table';
    END IF;

    -- Add tags column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'exercises'
        AND column_name = 'tags'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises ADD COLUMN tags text[];
        RAISE NOTICE 'Added tags column to exercises table';
    END IF;

    -- Add category column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'exercises'
        AND column_name = 'category'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises ADD COLUMN category text;
        RAISE NOTICE 'Added category column to exercises table';
    END IF;
END $$;

-- Make session_id optional for exercises in bank
ALTER TABLE public.exercises ALTER COLUMN session_id DROP NOT NULL;

-- Create exercise assignments table for linking bank exercises to sessions
CREATE TABLE IF NOT EXISTS public.exercise_assignments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(session_id, order_index)
);

-- Enable RLS
ALTER TABLE public.exercise_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exercise_folders
CREATE POLICY "Folders readable by authenticated users" ON public.exercise_folders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage folders" ON public.exercise_folders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- RLS Policies for exercise_assignments
CREATE POLICY "Assignments readable by authenticated users" ON public.exercise_assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage assignments" ON public.exercise_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Create triggers for updated_at
CREATE TRIGGER update_exercise_folders_updated_at
  BEFORE UPDATE ON public.exercise_folders
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_exercise_assignments_updated_at
  BEFORE UPDATE ON public.exercise_assignments
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Insert default folders
INSERT INTO public.exercise_folders (id, name, description, color, icon, sort_order) VALUES
('550e8400-e29b-41d4-a716-446655440f01', 'Vocabulary', 'Từ vựng và ý nghĩa', 'green', 'book-open', 1),
('550e8400-e29b-41d4-a716-446655440f02', 'Grammar', 'Ngữ pháp và cấu trúc câu', 'blue', 'edit-3', 2),
('550e8400-e29b-41d4-a716-446655440f03', 'Pronunciation', 'Phát âm và luyện nói', 'red', 'mic', 3),
('550e8400-e29b-41d4-a716-446655440f04', 'Listening', 'Luyện nghe và hiểu', 'purple', 'headphones', 4),
('550e8400-e29b-41d4-a716-446655440f05', 'Multiple Choice', 'Câu hỏi trắc nghiệm', 'orange', 'help-circle', 5)
ON CONFLICT (id) DO NOTHING;

-- Insert subfolders for Vocabulary
INSERT INTO public.exercise_folders (id, name, parent_folder_id, description, color, icon, sort_order) VALUES
('550e8400-e29b-41d4-a716-446655440f11', 'Basic Words', '550e8400-e29b-41d4-a716-446655440f01', 'Từ vựng cơ bản hàng ngày', 'green', 'folder', 1),
('550e8400-e29b-41d4-a716-446655440f12', 'Family & Friends', '550e8400-e29b-41d4-a716-446655440f01', 'Gia đình và bạn bè', 'green', 'folder', 2),
('550e8400-e29b-41d4-a716-446655440f13', 'Food & Drinks', '550e8400-e29b-41d4-a716-446655440f01', 'Đồ ăn và thức uống', 'green', 'folder', 3)
ON CONFLICT (id) DO NOTHING;

-- Insert subfolders for Grammar
INSERT INTO public.exercise_folders (id, name, parent_folder_id, description, color, icon, sort_order) VALUES
('550e8400-e29b-41d4-a716-446655440f21', 'Present Tense', '550e8400-e29b-41d4-a716-446655440f02', 'Thì hiện tại', 'blue', 'folder', 1),
('550e8400-e29b-41d4-a716-446655440f22', 'Past Tense', '550e8400-e29b-41d4-a716-446655440f02', 'Thì quá khứ', 'blue', 'folder', 2),
('550e8400-e29b-41d4-a716-446655440f23', 'Questions', '550e8400-e29b-41d4-a716-446655440f02', 'Câu hỏi', 'blue', 'folder', 3)
ON CONFLICT (id) DO NOTHING;

SELECT 'Exercise bank schema created successfully!' as message;