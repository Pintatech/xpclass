-- Exercise Bank folder access, part 2 of 2: turns the lock on.
-- Run add_exercise_folder_access.sql first, then grant folders to every teacher
-- (Exercise Bank > "Phân quyền"). From the moment this runs, teachers only see their
-- folders, also through the API. Students, guests and reports keep working.
--
-- Emergency switch (everything readable again): unlock_exercise_folder_access.sql
-- Full undo (old permissions back):             restore_exercise_bank_policies.sql
BEGIN;

-- 1. Keep a copy of the current permissions (first run only) so they can be restored.
--    RLS on with no policies: hidden from the API.
CREATE TABLE IF NOT EXISTS public.exercise_bank_policy_backup (
  tablename name NOT NULL,
  policyname name NOT NULL,
  permissive text,
  roles name[],
  cmd text,
  qual text,
  with_check text,
  saved_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (tablename, policyname)
);
CREATE TABLE IF NOT EXISTS public.exercise_bank_rls_backup (
  tablename name PRIMARY KEY,
  rls_enabled boolean NOT NULL,
  saved_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.exercise_bank_policy_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_bank_rls_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exercise_bank_policy_backup FROM anon, authenticated;
REVOKE ALL ON public.exercise_bank_rls_backup FROM anon, authenticated;

INSERT INTO public.exercise_bank_rls_backup (tablename, rls_enabled)
SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('exercises', 'exercise_folders')
ON CONFLICT (tablename) DO NOTHING;

INSERT INTO public.exercise_bank_policy_backup (tablename, policyname, permissive, roles, cmd, qual, with_check)
SELECT p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN ('exercises', 'exercise_folders')
  AND p.policyname NOT LIKE 'bank\_%'
  AND NOT EXISTS (SELECT 1 FROM public.exercise_bank_policy_backup b WHERE b.tablename = p.tablename);

-- 2. Replace every policy on the two tables with the rules below
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('exercises', 'exercise_folders')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_folders ENABLE ROW LEVEL SECURITY;

-- Exercises: admins read everything, teachers read their folders,
-- everyone reads what their courses, guest courses and daily challenges use
CREATE POLICY bank_exercises_select ON public.exercises FOR SELECT USING (
  NOT (SELECT public.exercise_bank_lock_enabled())
  OR (SELECT public.is_admin_user())
  OR folder_id IN (SELECT public.accessible_exercise_folder_ids())
  OR id IN (SELECT public.my_course_exercise_ids())
);

-- Exercises: admins change anything, teachers only inside their folders
CREATE POLICY bank_exercises_insert ON public.exercises FOR INSERT WITH CHECK (
  (SELECT public.is_admin_user())
  OR ((SELECT public.is_teacher_user()) AND (
    NOT (SELECT public.exercise_bank_lock_enabled())
    OR folder_id IN (SELECT public.accessible_exercise_folder_ids())
  ))
);
CREATE POLICY bank_exercises_update ON public.exercises FOR UPDATE USING (
  (SELECT public.is_admin_user())
  OR ((SELECT public.is_teacher_user()) AND (
    NOT (SELECT public.exercise_bank_lock_enabled())
    OR folder_id IN (SELECT public.accessible_exercise_folder_ids())
  ))
) WITH CHECK (
  (SELECT public.is_admin_user())
  OR ((SELECT public.is_teacher_user()) AND (
    NOT (SELECT public.exercise_bank_lock_enabled())
    OR folder_id IN (SELECT public.accessible_exercise_folder_ids())
  ))
);
CREATE POLICY bank_exercises_delete ON public.exercises FOR DELETE USING (
  (SELECT public.is_admin_user())
  OR ((SELECT public.is_teacher_user()) AND (
    NOT (SELECT public.exercise_bank_lock_enabled())
    OR folder_id IN (SELECT public.accessible_exercise_folder_ids())
  ))
);

-- Folders: teachers see the folders they may open plus their parents (name only)
CREATE POLICY bank_folders_select ON public.exercise_folders FOR SELECT USING (
  NOT (SELECT public.exercise_bank_lock_enabled())
  OR (SELECT public.is_admin_user())
  OR id IN (SELECT public.visible_exercise_folder_ids())
);

-- Folders: teachers create subfolders inside their folders, never top-level folders
CREATE POLICY bank_folders_insert ON public.exercise_folders FOR INSERT WITH CHECK (
  (SELECT public.is_admin_user())
  OR ((SELECT public.is_teacher_user()) AND (
    NOT (SELECT public.exercise_bank_lock_enabled())
    OR parent_folder_id IN (SELECT public.accessible_exercise_folder_ids())
  ))
);
CREATE POLICY bank_folders_update ON public.exercise_folders FOR UPDATE USING (
  (SELECT public.is_admin_user())
  OR ((SELECT public.is_teacher_user()) AND (
    NOT (SELECT public.exercise_bank_lock_enabled())
    OR id IN (SELECT public.accessible_exercise_folder_ids())
  ))
) WITH CHECK (
  (SELECT public.is_admin_user())
  OR ((SELECT public.is_teacher_user()) AND (
    NOT (SELECT public.exercise_bank_lock_enabled())
    OR id IN (SELECT public.accessible_exercise_folder_ids())
  ))
);
CREATE POLICY bank_folders_delete ON public.exercise_folders FOR DELETE USING (
  (SELECT public.is_admin_user())
  OR ((SELECT public.is_teacher_user()) AND (
    NOT (SELECT public.exercise_bank_lock_enabled())
    OR id IN (SELECT public.accessible_exercise_folder_ids())
  ))
);

-- 3. Only admins move folders or change "Read only" (the app already hides these from teachers)
CREATE OR REPLACE FUNCTION public.guard_exercise_folder_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- SQL editor and server jobs have no signed-in user
  IF auth.uid() IS NULL OR public.is_admin_user() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.read_only IS TRUE THEN
    RAISE EXCEPTION 'Only admins can create read-only folders';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.read_only IS DISTINCT FROM OLD.read_only THEN
    RAISE EXCEPTION 'Only admins can change the read-only setting';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.parent_folder_id IS DISTINCT FROM OLD.parent_folder_id THEN
    RAISE EXCEPTION 'Only admins can move folders';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_exercise_folder_changes ON public.exercise_folders;
CREATE TRIGGER guard_exercise_folder_changes
  BEFORE INSERT OR UPDATE ON public.exercise_folders
  FOR EACH ROW EXECUTE FUNCTION public.guard_exercise_folder_changes();

-- 4. Turn the lock on
CREATE OR REPLACE FUNCTION public.exercise_bank_lock_enabled()
RETURNS boolean LANGUAGE sql STABLE AS 'SELECT true';

-- 5. List other policies that read these tables: check they still work after the lock
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename NOT IN ('exercises', 'exercise_folders')
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '\m(exercises|exercise_folders)\M'
  LOOP
    RAISE NOTICE 'Policy "%" on table % reads exercises or folders: check it still works', p.policyname, p.tablename;
  END LOOP;
END $$;

COMMIT;
