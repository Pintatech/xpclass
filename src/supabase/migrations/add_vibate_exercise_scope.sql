-- Upgrade for databases that already ran the course-only version of add_vibate.sql.
-- Scopes vibate_posts to an exercise (feed = exercise + course).
-- Old course-level posts have no exercise, so SET NOT NULL below fails while any remain.
-- The course feed no longer exists in the app; if you're fine losing them, run first:
--   DELETE FROM public.vibate_posts;

ALTER TABLE public.vibate_posts ADD COLUMN IF NOT EXISTS exercise_id uuid;
ALTER TABLE public.vibate_posts ALTER COLUMN exercise_id SET NOT NULL;
ALTER TABLE public.vibate_posts DROP CONSTRAINT IF EXISTS vibate_posts_exercise_id_fkey;
ALTER TABLE public.vibate_posts ADD CONSTRAINT vibate_posts_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.vibate_posts_course_parent_created_idx;
CREATE INDEX IF NOT EXISTS vibate_posts_feed_idx ON public.vibate_posts (exercise_id, course_id, parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vibate_posts_parent_idx ON public.vibate_posts (parent_id);

-- A response must stay in its parent's exercise feed
DROP POLICY IF EXISTS "vibate_posts_insert" ON public.vibate_posts;
CREATE POLICY "vibate_posts_insert" ON public.vibate_posts FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND public.is_vibate_course_member(course_id)
  AND (
    parent_id IS NULL
    OR EXISTS (SELECT 1 FROM public.vibate_posts p WHERE p.id = parent_id AND p.course_id = vibate_posts.course_id AND p.exercise_id = vibate_posts.exercise_id)
  )
);
