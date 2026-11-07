-- Undo lock_rls_content.sql: drop its "rls content:" policies, put back the policies it dropped, switch RLS off again on
-- the tables where it was off, give guests back the views, and make v_cohort_members_detailed run as its owner again.
-- WARNING: every signed-in user can then change or delete course content, settings, shop items and enrollments again,
-- and guests can read the names and e-mails in v_cohort_members_detailed. Safe to run twice.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  p record;
  g record;
  r record;
  role_list text;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'rls content: %'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;

  IF to_regclass('public.security_lock_policies') IS NOT NULL THEN
    FOR p IN
      SELECT s.* FROM public.security_lock_policies s
      WHERE s.dropped_by = 'lock_rls_content'
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
    DELETE FROM public.security_lock_policies WHERE dropped_by = 'lock_rls_content';
  END IF;

  IF to_regclass('public.security_lock_rls') IS NOT NULL THEN
    FOR r IN
      SELECT s.table_name FROM public.security_lock_rls s
      WHERE s.enabled_by = 'lock_rls_content'
        AND to_regclass(format('public.%I', s.table_name)) IS NOT NULL
    LOOP
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.table_name);
    END LOOP;
    DELETE FROM public.security_lock_rls WHERE enabled_by = 'lock_rls_content';
  END IF;

  IF to_regclass('public.security_lock_table_grants') IS NOT NULL THEN
    FOR g IN
      SELECT s.* FROM public.security_lock_table_grants s
      WHERE s.recorded_by = 'lock_rls_content'
        AND to_regclass(format('public.%I', s.table_name)) IS NOT NULL
    LOOP
      BEGIN
        EXECUTE format('GRANT %s ON public.%I TO %I', g.privilege_type, g.table_name, g.grantee);
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'Could not give back % on % to %: %', g.privilege_type, g.table_name, g.grantee, SQLERRM;
      END;
    END LOOP;
    DELETE FROM public.security_lock_table_grants WHERE recorded_by = 'lock_rls_content';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.v_cohort_members_detailed') IS NOT NULL THEN
    ALTER VIEW public.v_cohort_members_detailed RESET (security_invoker);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'v_cohort_members_detailed left as it was: %', SQLERRM;
END;
$$;

DROP FUNCTION IF EXISTS public.self_enroll_course_ids();

COMMIT;

NOTIFY pgrst, 'reload schema';
