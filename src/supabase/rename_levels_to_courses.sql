-- =================================================================
-- Rename Levels to Courses Migration
-- =================================================================
-- This script renames the "levels" table to "courses" and adds teacher assignment functionality

-- Step 1: Rename levels table to courses
ALTER TABLE public.levels RENAME TO courses;

-- Step 2: Add teacher_id column to courses
ALTER TABLE public.courses
ADD COLUMN teacher_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 3: Update user roles to include teacher
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
ADD CONSTRAINT users_role_check
CHECK (role IN ('user', 'admin', 'teacher'));

-- Step 4: Create course_enrollments table for student assignments
CREATE TABLE public.course_enrollments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.users(id), -- admin who assigned
  assigned_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(course_id, student_id)
);

-- Step 5: Update foreign key references
-- Rename level_id to course_id in units table
ALTER TABLE public.units RENAME COLUMN level_id TO course_id;

-- Rename level_id to course_id in user_progress table
ALTER TABLE public.user_progress RENAME COLUMN level_id TO course_id;

-- Rename level_progress table to course_progress
ALTER TABLE public.level_progress RENAME TO course_progress;
ALTER TABLE public.course_progress RENAME COLUMN level_id TO course_id;

-- Step 6: Enable RLS for new table
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for teacher access

-- Teachers can view courses they are assigned to
CREATE POLICY "Teachers view assigned courses" ON public.courses
FOR SELECT USING (teacher_id = auth.uid() OR auth.uid() IN (
  SELECT id FROM public.users WHERE role = 'admin'
));

-- Teachers can view enrollments for their courses
CREATE POLICY "Teachers view course enrollments" ON public.course_enrollments
FOR SELECT USING (
  course_id IN (
    SELECT id FROM public.courses WHERE teacher_id = auth.uid()
  ) OR
  auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
);

-- Teachers can view progress of their students
CREATE POLICY "Teachers view student progress" ON public.user_progress
FOR SELECT USING (
  user_id IN (
    SELECT ce.student_id
    FROM public.course_enrollments ce
    JOIN public.courses c ON c.id = ce.course_id
    WHERE c.teacher_id = auth.uid() AND ce.is_active = true
  ) OR
  auth.uid() = user_id OR
  auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
);

-- Admins can manage course enrollments
CREATE POLICY "Admins manage enrollments" ON public.course_enrollments
FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
);

-- Step 8: Update existing RLS policies that reference levels
DROP POLICY IF EXISTS "Users manage own level progress" ON public.course_progress;
CREATE POLICY "Users manage own course progress" ON public.course_progress
FOR ALL USING (auth.uid() = user_id);

-- Step 9: Update triggers
DROP TRIGGER IF EXISTS update_level_progress_updated_at ON public.course_progress;
CREATE TRIGGER update_course_progress_updated_at
BEFORE UPDATE ON public.course_progress
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Step 10: Add trigger for course_enrollments
CREATE TRIGGER update_course_enrollments_updated_at
BEFORE UPDATE ON public.course_enrollments
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Step 11: Add some sample data for testing
-- First, let's create a sample teacher user (you can skip this if you have teachers already)
-- INSERT INTO public.users (id, email, full_name, role)
-- VALUES (uuid_generate_v4(), 'teacher@example.com', 'Sample Teacher', 'teacher')
-- ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE public.courses IS 'Courses (formerly levels) that students can enroll in';
COMMENT ON TABLE public.course_enrollments IS 'Student enrollments in courses, managed by admins';
COMMENT ON COLUMN public.courses.teacher_id IS 'Teacher assigned to this course';