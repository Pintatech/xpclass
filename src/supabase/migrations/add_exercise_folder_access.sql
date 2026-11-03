-- Exercise Bank folder access, part 1 of 2. Safe to run: nothing is hidden yet.
-- Admins grant folders to teachers (Exercise Bank > "Phân quyền"); the lock only
-- starts when lock_exercise_folder_access.sql is run.
--
-- Rules once locked:
--   admins see everything
--   teachers see the folders granted to them and everything inside those folders
--     (parent folders show by name only, so the tree keeps its path)
--   everyone still reads the exercises their courses use, guest courses and daily challenges

-- 1. Indexes for the access checks (they also speed up reports)
CREATE INDEX IF NOT EXISTS exercises_folder_id_idx ON public.exercises (folder_id);
CREATE INDEX IF NOT EXISTS exercises_session_id_idx ON public.exercises (session_id);
CREATE INDEX IF NOT EXISTS exercise_folders_parent_folder_id_idx ON public.exercise_folders (parent_folder_id);
CREATE INDEX IF NOT EXISTS exercise_assignments_session_id_idx ON public.exercise_assignments (session_id);
CREATE INDEX IF NOT EXISTS exercise_assignments_exercise_id_idx ON public.exercise_assignments (exercise_id);
CREATE INDEX IF NOT EXISTS sessions_unit_id_idx ON public.sessions (unit_id);
CREATE INDEX IF NOT EXISTS units_course_id_idx ON public.units (course_id);
CREATE INDEX IF NOT EXISTS course_enrollments_student_id_idx ON public.course_enrollments (student_id);
CREATE INDEX IF NOT EXISTS course_teachers_teacher_id_idx ON public.course_teachers (teacher_id);

-- 2. Lock switch, off until lock_exercise_folder_access.sql turns it on.
--    Created only once, so running this file again never turns an active lock off.
DO $$
BEGIN
  IF to_regprocedure('public.exercise_bank_lock_enabled()') IS NULL THEN
    CREATE FUNCTION public.exercise_bank_lock_enabled()
    RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';
  END IF;
END $$;

-- 3. Role checks. Security definer so policies can use them without recursion.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'teacher')
$$;

-- 4. Folders granted to each teacher. A grant covers the folder and all its subfolders.
CREATE TABLE IF NOT EXISTS public.exercise_folder_access (
  folder_id uuid NOT NULL REFERENCES public.exercise_folders(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exercise_folder_access_pkey PRIMARY KEY (folder_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS exercise_folder_access_teacher_id_idx ON public.exercise_folder_access (teacher_id);

-- Only admins read or change grants; teachers get theirs through the functions below
ALTER TABLE public.exercise_folder_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise_folder_access_admin" ON public.exercise_folder_access;
CREATE POLICY "exercise_folder_access_admin" ON public.exercise_folder_access FOR ALL
  USING ((SELECT public.is_admin_user()))
  WITH CHECK ((SELECT public.is_admin_user()));

-- 5. Folders the current teacher may open: granted folders and everything below them
CREATE OR REPLACE FUNCTION public.accessible_exercise_folder_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE tree(id) AS (
    SELECT a.folder_id
    FROM public.exercise_folder_access a
    WHERE a.teacher_id = auth.uid() AND public.is_teacher_user()
    UNION
    SELECT f.id FROM public.exercise_folders f JOIN tree t ON f.parent_folder_id = t.id
  )
  SELECT id FROM tree
$$;

-- Folders the current user sees in the tree: the ones they may open plus their parents
CREATE OR REPLACE FUNCTION public.visible_exercise_folder_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE up(id, parent_id) AS (
    SELECT f.id, f.parent_folder_id
    FROM public.exercise_folders f
    WHERE f.id IN (SELECT public.accessible_exercise_folder_ids())
    UNION
    SELECT p.id, p.parent_folder_id FROM public.exercise_folders p JOIN up ON p.id = up.parent_id
  )
  SELECT id FROM up
$$;

-- For the app: folders the current user may open, or NULL when nothing is restricted
CREATE OR REPLACE FUNCTION public.my_exercise_folder_access()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT public.exercise_bank_lock_enabled() OR public.is_admin_user() THEN NULL
    ELSE ARRAY(SELECT public.accessible_exercise_folder_ids())
  END
$$;

-- 6. Exercises the current user needs no matter which folder they are in:
--    their courses (as student or teacher), guest courses and daily challenges
CREATE OR REPLACE FUNCTION public.my_course_exercise_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_courses AS (
    SELECT c.id FROM public.courses c WHERE c.is_guest_accessible IS TRUE
    UNION
    SELECT c.id FROM public.courses c WHERE c.teacher_id = auth.uid()
    UNION
    SELECT ct.course_id FROM public.course_teachers ct WHERE ct.teacher_id = auth.uid()
    UNION
    SELECT ce.course_id FROM public.course_enrollments ce WHERE ce.student_id = auth.uid()
  ),
  my_sessions AS (
    SELECT s.id
    FROM public.sessions s
    JOIN public.units u ON u.id = s.unit_id
    JOIN my_courses mc ON mc.id = u.course_id
  )
  SELECT ea.exercise_id
  FROM public.exercise_assignments ea
  JOIN my_sessions ms ON ms.id = ea.session_id
  WHERE ea.exercise_id IS NOT NULL
  UNION
  SELECT e.id FROM public.exercises e JOIN my_sessions ms ON ms.id = e.session_id
  UNION
  SELECT dc.exercise_id FROM public.daily_challenges dc WHERE auth.uid() IS NOT NULL
$$;

-- 7. What the Exercise Bank screens list: exercises in folders the user may open
CREATE OR REPLACE VIEW public.exercise_bank_visible AS
SELECT e.*
FROM public.exercises e
WHERE NOT (SELECT public.exercise_bank_lock_enabled())
   OR (SELECT public.is_admin_user())
   OR e.folder_id IN (SELECT public.accessible_exercise_folder_ids());

-- Check the caller's own permissions too (Postgres 15+). The filter above is enough on older versions.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    EXECUTE 'ALTER VIEW public.exercise_bank_visible SET (security_invoker = true)';
  END IF;
END $$;

-- Read-only, signed-in users only
REVOKE ALL ON public.exercise_bank_visible FROM anon, authenticated;
GRANT SELECT ON public.exercise_bank_visible TO authenticated;

-- 8. Active bank exercises per folder for the Exercise Bank sidebar, in one request
CREATE OR REPLACE FUNCTION public.exercise_bank_folder_counts()
RETURNS TABLE (folder_id uuid, total bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT v.folder_id, count(*)::bigint
  FROM public.exercise_bank_visible v
  WHERE v.is_in_bank AND v.is_active
  GROUP BY v.folder_id
$$;

-- 9. Folder path such as "Starters / Đề KT tháng 11", for question reports sent by students
CREATE OR REPLACE FUNCTION public.exercise_folder_path(p_folder_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE up(id, parent_id, name, depth) AS (
    SELECT f.id, f.parent_folder_id, f.name, 0
    FROM public.exercise_folders f
    WHERE f.id = p_folder_id
    UNION ALL
    SELECT p.id, p.parent_folder_id, p.name, up.depth + 1
    FROM public.exercise_folders p
    JOIN up ON p.id = up.parent_id
    WHERE up.depth < 20
  )
  SELECT string_agg(name, ' / ' ORDER BY depth DESC) FROM up
$$;

-- 10. Policies and the app call these as the signed-in user or guest
GRANT EXECUTE ON FUNCTION
  public.exercise_bank_lock_enabled(),
  public.is_admin_user(),
  public.is_teacher_user(),
  public.accessible_exercise_folder_ids(),
  public.visible_exercise_folder_ids(),
  public.my_exercise_folder_access(),
  public.my_course_exercise_ids(),
  public.exercise_folder_path(uuid)
TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exercise_bank_folder_counts() TO authenticated;
