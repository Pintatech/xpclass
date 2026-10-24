-- Vibate exercise: students answer an exercise prompt with a face-filter video, classmates reply with video responses.
-- Each feed is scoped to (exercise, course) so the same bank exercise used in two courses keeps separate feeds.
-- Top-level posts have parent_id NULL; responses point at the post they answer.
-- Videos live in the existing 'exercise-videos' bucket under {user_id}/vibate/.

CREATE TABLE public.vibate_posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  exercise_id uuid NOT NULL,
  course_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid,
  caption text,
  video_url text NOT NULL,
  video_path text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vibate_posts_pkey PRIMARY KEY (id),
  CONSTRAINT vibate_posts_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE,
  CONSTRAINT vibate_posts_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
  CONSTRAINT vibate_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT vibate_posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.vibate_posts(id) ON DELETE CASCADE
);

CREATE INDEX vibate_posts_feed_idx ON public.vibate_posts (exercise_id, course_id, parent_id, created_at DESC);
CREATE INDEX vibate_posts_parent_idx ON public.vibate_posts (parent_id);

ALTER TABLE public.vibate_posts ENABLE ROW LEVEL SECURITY;

-- Course members: enrolled students, plus admins/teachers
CREATE OR REPLACE FUNCTION public.is_vibate_course_member(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher')
  ) OR EXISTS (
    SELECT 1 FROM public.course_enrollments
    WHERE course_id = p_course_id AND student_id = auth.uid() AND is_active = true
  )
$$;

CREATE POLICY "vibate_posts_select" ON public.vibate_posts FOR SELECT USING (
  public.is_vibate_course_member(course_id)
);

-- Members post as themselves; a response must stay in its parent's exercise feed
CREATE POLICY "vibate_posts_insert" ON public.vibate_posts FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND public.is_vibate_course_member(course_id)
  AND (
    parent_id IS NULL
    OR EXISTS (SELECT 1 FROM public.vibate_posts p WHERE p.id = parent_id AND p.course_id = vibate_posts.course_id AND p.exercise_id = vibate_posts.exercise_id)
  )
);

-- Owners delete their own; admins/teachers can moderate
CREATE POLICY "vibate_posts_delete" ON public.vibate_posts FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);
