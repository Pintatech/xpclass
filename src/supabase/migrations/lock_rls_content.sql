-- Step 2a of the lock: turn row level security on for course content and site configuration.
--
-- Found 2026-11-07 (security_check.sql section 11, rls_precheck.sql): these tables have RLS OFF, so every signed-in
-- user can change or delete any row: course names, lessons, the exercise list of every lesson, shop prices, site
-- settings (invite codes, login picture), levels, pets, achievements, cohorts, enrollments, daily challenges.
-- Sign-up is open and auto-confirmed, so "signed-in" means anyone who calls signUp. The policies already written on
-- these tables do nothing while RLS is off, and two of them ("Enable insert/update for authenticated users only" on
-- courses) would let any signed-in user add or edit courses once it is on, so all of them are replaced.
-- Also found: v_cohort_members_detailed runs as its owner, so it skips RLS on users. With only the public anon key,
-- no login, anyone could read the name, e-mail and XP of all 258 cohort members through it.
--
-- After this file:
--   courses, site_settings, student_levels         read: everyone, guests too     change: admins
--   units, sessions, exercise_assignments          read: everyone, guests too     change: teachers and admins
--   achievements, cohorts, cohort_members, course_teachers, course_enrollments, daily_challenges,
--   daily_challenge_attempts, daily_challenge_participations, leaderboard_rewards, pets, pet_bonuses, shop_items
--                                                  read: signed-in users          change: admins
--   course_enrollments also lets an account enrol itself, as sign-up does (useAuth signUp), but only in the courses
--   the register page offers (site_settings register_course_ids) or the demo course (demo_course_id).
--   Guests (no login) can no longer read any view in public, and v_cohort_members_detailed now follows RLS
--   (security_invoker). The app reads that view only on admin pages.
-- Reads by signed-in users stay as they are, so dashboards, leaderboards and teacher reports see the same rows.
-- "Teacher" and "admin" are users.role, read by is_teacher_user() and is_admin_user(); since add_user_row_guard.sql
-- only an admin can change a role.
-- Unaffected: SECURITY DEFINER functions (daily challenge results, rewards, leaderboards), the service role (Vercel
-- cron, Edge Functions such as bulk-create-users), the SQL editor.
--
-- Run after lock_anon_writes.sql; this file stops if anon can still delete rows. Every policy it drops, every table it
-- switches RLS on for and every grant it takes away is recorded for the undo. Safe to run twice.
-- Undo: unlock_rls_content.sql.
-- The last result: every table with rls_on = true and only "rls content:" policies, and no "view guests can read" row.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.courses', 'DELETE') OR has_table_privilege('anon', 'public.courses', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Run lock_anon_writes.sql first: anon can still delete rows of courses.';
  END IF;
END;
$$;

-- Records for the undo files (the first two are the same tables lock_anon_writes.sql made). Only the SQL editor and
-- the service role can read them.
CREATE TABLE IF NOT EXISTS public.security_lock_table_grants (
  table_name text NOT NULL,
  grantee text NOT NULL,
  privilege_type text NOT NULL,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, grantee, privilege_type)
);
ALTER TABLE public.security_lock_table_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_lock_table_grants FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.security_lock_policies (
  table_name text NOT NULL,
  policy_name text NOT NULL,
  permissive text NOT NULL,
  roles name[] NOT NULL,
  cmd text NOT NULL,
  qual text,
  with_check text,
  dropped_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, policy_name)
);
ALTER TABLE public.security_lock_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_lock_policies FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.security_lock_rls (
  table_name text PRIMARY KEY,
  enabled_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_lock_rls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_lock_rls FROM PUBLIC, anon, authenticated;


-- 1. Keep a copy of every policy now on these tables, then drop them all.
INSERT INTO public.security_lock_policies (table_name, policy_name, permissive, roles, cmd, qual, with_check, dropped_by)
SELECT p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check, 'lock_rls_content'
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN (SELECT unnest(ARRAY['courses', 'site_settings', 'student_levels', 'units', 'sessions', 'exercise_assignments', 'achievements', 'cohorts', 'cohort_members', 'course_teachers', 'course_enrollments', 'daily_challenges', 'daily_challenge_attempts', 'daily_challenge_participations', 'leaderboard_rewards', 'pets', 'pet_bonuses', 'shop_items']))
  AND p.policyname NOT LIKE 'rls content: %'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (SELECT unnest(ARRAY['courses', 'site_settings', 'student_levels', 'units', 'sessions', 'exercise_assignments', 'achievements', 'cohorts', 'cohort_members', 'course_teachers', 'course_enrollments', 'daily_challenges', 'daily_challenge_attempts', 'daily_challenge_participations', 'leaderboard_rewards', 'pets', 'pet_bonuses', 'shop_items']))
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$$;

-- 2. Switch RLS on, remembering which tables had it off.
INSERT INTO public.security_lock_rls (table_name, enabled_by)
SELECT c.relname, 'lock_rls_content'
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public' AND c.relname IN (SELECT unnest(ARRAY['courses', 'site_settings', 'student_levels', 'units', 'sessions', 'exercise_assignments', 'achievements', 'cohorts', 'cohort_members', 'course_teachers', 'course_enrollments', 'daily_challenges', 'daily_challenge_attempts', 'daily_challenge_participations', 'leaderboard_rewards', 'pets', 'pet_bonuses', 'shop_items'])) AND NOT c.relrowsecurity
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['courses', 'site_settings', 'student_levels', 'units', 'sessions', 'exercise_assignments', 'achievements', 'cohorts', 'cohort_members', 'course_teachers', 'course_enrollments', 'daily_challenges', 'daily_challenge_attempts', 'daily_challenge_participations', 'leaderboard_rewards', 'pets', 'pet_bonuses', 'shop_items']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

-- 3. The new policies.
DO $$
DECLARE
  t text;
BEGIN
  -- The login, register and guest pages read these without a login.
  FOREACH t IN ARRAY ARRAY['courses', 'site_settings', 'student_levels', 'units', 'sessions', 'exercise_assignments'] LOOP
    EXECUTE format('CREATE POLICY "rls content: everyone reads" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['achievements', 'cohorts', 'cohort_members', 'course_teachers', 'course_enrollments',
                           'daily_challenges', 'daily_challenge_attempts', 'daily_challenge_participations',
                           'leaderboard_rewards', 'pets', 'pet_bonuses', 'shop_items'] LOOP
    EXECUTE format('CREATE POLICY "rls content: signed-in users read" ON public.%I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;

  -- Lessons: teachers edit them (study pages, Exercise Bank), as well as admins.
  FOREACH t IN ARRAY ARRAY['units', 'sessions', 'exercise_assignments'] LOOP
    EXECUTE format('CREATE POLICY "rls content: teachers and admins change" ON public.%I FOR ALL TO authenticated '
                   'USING ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user())) '
                   'WITH CHECK ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()))', t);
  END LOOP;

  -- Everything else is changed on admin pages only.
  FOREACH t IN ARRAY ARRAY['courses', 'site_settings', 'student_levels', 'achievements', 'cohorts', 'cohort_members',
                           'course_teachers', 'course_enrollments', 'daily_challenges', 'daily_challenge_attempts',
                           'daily_challenge_participations', 'leaderboard_rewards', 'pets', 'pet_bonuses', 'shop_items'] LOOP
    EXECUTE format('CREATE POLICY "rls content: admins change" ON public.%I FOR ALL TO authenticated '
                   'USING ((SELECT public.is_admin_user())) WITH CHECK ((SELECT public.is_admin_user()))', t);
  END LOOP;
END;
$$;

-- 4. Sign-up enrols the new account in the course picked on the register page, or in the demo course. These are the
--    only courses an account may enrol itself in. Settings that are not a uuid / JSON array of uuids are ignored.
CREATE OR REPLACE FUNCTION public.self_enroll_course_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v text;
  uuid_re constant text := '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$';
BEGIN
  SELECT btrim(s.setting_value, E' \t\r\n"') INTO v
  FROM public.site_settings s WHERE s.setting_key = 'demo_course_id';
  IF v ~ uuid_re THEN
    RETURN NEXT v::uuid;
  END IF;

  SELECT s.setting_value INTO v
  FROM public.site_settings s WHERE s.setting_key = 'register_course_ids';
  IF v IS NOT NULL THEN
    BEGIN
      RETURN QUERY
        SELECT btrim(e)::uuid FROM jsonb_array_elements_text(v::jsonb) AS e WHERE btrim(e) ~ uuid_re;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- not a JSON array: only the demo course counts
    END;
  END IF;
END;
$$;

CREATE POLICY "rls content: new account enrols itself" ON public.course_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND cohort_id IS NULL
    AND course_id IN (SELECT public.self_enroll_course_ids())
  );

-- 5. Views run as their owner and skip RLS, so guests read none of them. The app reads views only on admin pages.
INSERT INTO public.security_lock_table_grants (table_name, grantee, privilege_type, recorded_by)
SELECT c.relname, r.rolname, a.privilege_type, 'lock_rls_content'
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(c.relacl) a
JOIN pg_roles r ON r.oid = a.grantee
WHERE ns.nspname = 'public'
  AND c.relkind IN ('v', 'm')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
  AND r.rolname = 'anon' AND a.privilege_type = 'SELECT'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public'
      AND c.relkind IN ('v', 'm')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
  LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON %s FROM anon', v.rel);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped %: %', v.rel, SQLERRM;
    END;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.v_cohort_members_detailed') IS NOT NULL THEN
    ALTER VIEW public.v_cohort_members_detailed SET (security_invoker = true);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'v_cohort_members_detailed still runs as its owner: %', SQLERRM;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: 18 table rows, each rls_on = true with only "rls content:" policies; no "view guests can read" row.
SELECT 'table' AS kind, c.relname AS name, c.relrowsecurity AS rls_on,
       (SELECT string_agg(p.policyname, ' | ' ORDER BY p.policyname)
          FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public'
  AND c.relname IN ('courses', 'site_settings', 'student_levels', 'units', 'sessions', 'exercise_assignments',
                    'achievements', 'cohorts', 'cohort_members', 'course_teachers', 'course_enrollments',
                    'daily_challenges', 'daily_challenge_attempts', 'daily_challenge_participations',
                    'leaderboard_rewards', 'pets', 'pet_bonuses', 'shop_items')
UNION ALL
SELECT 'view guests can read', c.relname, NULL, NULL
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public' AND c.relkind IN ('v', 'm') AND has_table_privilege('anon', c.oid, 'SELECT')
ORDER BY 1, 2;
