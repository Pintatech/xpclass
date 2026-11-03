-- Full undo of lock_exercise_folder_access.sql: puts back the permissions the exercises and
-- exercise_folders tables had before the lock (saved by that file), and turns the lock off.
-- Folder grants are kept, so locking again later needs no new setup.
--
-- Warning: before the lock these tables had only read policies, so writes worked only because
-- RLS was off, which let anyone with the public key edit or delete exercises and folders.
-- This file brings that back. Prefer unlock_exercise_folder_access.sql, which keeps writes
-- limited to admins and teachers.
BEGIN;

CREATE OR REPLACE FUNCTION public.exercise_bank_lock_enabled()
RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';

DROP TRIGGER IF EXISTS guard_exercise_folder_changes ON public.exercise_folders;

DO $$
DECLARE
  p record;
  b record;
  statement text;
BEGIN
  IF to_regclass('public.exercise_bank_rls_backup') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.exercise_bank_rls_backup) THEN
    RAISE EXCEPTION 'No saved permissions found: lock_exercise_folder_access.sql was never run';
  END IF;

  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('exercises', 'exercise_folders')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;

  FOR b IN SELECT * FROM public.exercise_bank_policy_backup LOOP
    statement := format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      b.policyname, b.tablename, b.permissive, b.cmd,
      (SELECT string_agg(CASE WHEN r = 'public' THEN 'PUBLIC' ELSE quote_ident(r) END, ', ')
       FROM unnest(b.roles) AS r)
    );
    IF b.qual IS NOT NULL THEN
      statement := statement || format(' USING (%s)', b.qual);
    END IF;
    IF b.with_check IS NOT NULL THEN
      statement := statement || format(' WITH CHECK (%s)', b.with_check);
    END IF;
    EXECUTE statement;
  END LOOP;

  FOR b IN SELECT * FROM public.exercise_bank_rls_backup LOOP
    EXECUTE format(
      'ALTER TABLE public.%I %s ROW LEVEL SECURITY',
      b.tablename, CASE WHEN b.rls_enabled THEN 'ENABLE' ELSE 'DISABLE' END
    );
  END LOOP;
END $$;

COMMIT;
