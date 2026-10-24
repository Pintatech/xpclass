-- Vibate moderation: every post and response waits for a teacher/admin to approve it.
-- Until approved, only the author and teachers/admins can see it.
-- Existing rows are left pending on purpose, so nothing shows without a teacher looking at it.

ALTER TABLE public.vibate_posts ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
ALTER TABLE public.vibate_posts ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.is_vibate_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
$$;

-- Classmates only see approved posts; authors see their own pending ones; moderators see everything
DROP POLICY IF EXISTS "vibate_posts_select" ON public.vibate_posts;
CREATE POLICY "vibate_posts_select" ON public.vibate_posts FOR SELECT USING (
  public.is_vibate_course_member(course_id)
  AND (approved_at IS NOT NULL OR user_id = auth.uid() OR public.is_vibate_moderator())
);

-- Student posts always start pending, so they can't approve themselves on insert.
-- Teachers' own posts may be inserted already approved.
-- Replies can only target posts the poster can see (approved, or their own).
DROP POLICY IF EXISTS "vibate_posts_insert" ON public.vibate_posts;
CREATE POLICY "vibate_posts_insert" ON public.vibate_posts FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND ((approved_at IS NULL AND approved_by IS NULL) OR public.is_vibate_moderator())
  AND public.is_vibate_course_member(course_id)
  AND (
    parent_id IS NULL
    OR EXISTS (SELECT 1 FROM public.vibate_posts p WHERE p.id = parent_id AND p.course_id = vibate_posts.course_id AND p.exercise_id = vibate_posts.exercise_id)
  )
);

-- Only moderators can update (i.e. approve); students can't edit posts at all
DROP POLICY IF EXISTS "vibate_posts_update" ON public.vibate_posts;
CREATE POLICY "vibate_posts_update" ON public.vibate_posts FOR UPDATE
  USING (public.is_vibate_moderator())
  WITH CHECK (public.is_vibate_moderator());

CREATE INDEX IF NOT EXISTS vibate_posts_pending_idx ON public.vibate_posts (exercise_id, course_id) WHERE approved_at IS NULL;
