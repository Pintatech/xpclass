-- Fix: Allow teachers to manage enrollments for their courses
DROP POLICY IF EXISTS "Teachers manage enrollments for their courses" ON public.course_enrollments;

CREATE POLICY "Teachers manage enrollments for their courses" ON public.course_enrollments
FOR INSERT, UPDATE, DELETE USING (
  course_id IN (
    SELECT id FROM public.courses WHERE teacher_id = auth.uid()
  ) OR
  auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
);