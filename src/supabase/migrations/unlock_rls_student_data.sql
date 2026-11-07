-- Undo lock_rls_student_data.sql: drop its "rls students:" policies, put back the policies it dropped (including the
-- open INSERT policies on notifications, weekly_xp_tracking, giftcode_redemptions and wild_area_logs), and switch RLS
-- off again on the tables where it was off.
-- WARNING: every signed-in user can then rewrite or delete every student's answers, progress, tests and scores again,
-- read all test answers and teacher reports, and send notifications to everyone. Safe to run twice.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  p record;
  r record;
  role_list text;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'rls students: %'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;

  IF to_regclass('public.security_lock_policies') IS NOT NULL THEN
    FOR p IN
      SELECT s.* FROM public.security_lock_policies s
      WHERE s.dropped_by = 'lock_rls_student_data'
        AND to_regclass(format('public.%I', s.table_name)) IS NOT NULL
    LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = p.table_name AND policyname = p.policy_name) THEN
        SELECT string_agg(CASE WHEN x::text = 'public' THEN 'PUBLIC' ELSE quote_ident(x::text) END, ', ')
          INTO role_list
          FROM unnest(p.roles) AS x;
        EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s',
          p.policy_name, p.table_name, p.permissive, p.cmd, role_list,
          CASE WHEN p.qual IS NOT NULL THEN format(' USING (%s)', p.qual) ELSE '' END,
          CASE WHEN p.with_check IS NOT NULL THEN format(' WITH CHECK (%s)', p.with_check) ELSE '' END);
      END IF;
    END LOOP;
    DELETE FROM public.security_lock_policies WHERE dropped_by = 'lock_rls_student_data';
  END IF;

  IF to_regclass('public.security_lock_rls') IS NOT NULL THEN
    FOR r IN
      SELECT s.table_name FROM public.security_lock_rls s
      WHERE s.enabled_by = 'lock_rls_student_data'
        AND to_regclass(format('public.%I', s.table_name)) IS NOT NULL
    LOOP
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.table_name);
    END LOOP;
    DELETE FROM public.security_lock_rls WHERE enabled_by = 'lock_rls_student_data';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
