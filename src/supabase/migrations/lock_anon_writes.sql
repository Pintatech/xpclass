-- URGENT. Stop every write made without a login, and stop everyone but admins from reading the giftcodes.
--
-- Found 2026-11-07 with src/supabase/checks/security_check.sql:
--   - Section 11: 33 tables in public have row level security OFF, and anon and authenticated hold every table
--     privilege on them (Supabase's default grants). With only the public anon key, no login, anyone can read,
--     change or delete every row of courses, units, sessions, exercise_assignments, course_enrollments,
--     course_teachers, cohorts, question_attempts, user_progress, test_attempts, student_reports, shop_items,
--     site_settings, training_scores, tournaments, pvp_challenges and the rest of that list.
--   - Section 10: some tables that do have RLS carry write policies open to every role, for example
--     notifications ("Service role can insert notifications", WITH CHECK true) and tournament_teams, so anon can
--     write to those too.
--   - Section 12: giftcodes has "Anyone can read active giftcodes" (USING true), so anon and every student can list
--     every code. The redeem screen even downloads them all: useGiftcodes reads the table for any signed-in user,
--     so the codes show up in the F12 Network tab.
--
-- After this file:
--   - anon (no login) can no longer INSERT, UPDATE or DELETE any table or view in public, except the two tables the
--     guest page writes: guest_visitors (the name a guest types) and guest_attempts (their result). anon keeps
--     SELECT, so the guest pages, the login page and the register page work as before;
--   - nobody can TRUNCATE through the API (TRUNCATE skips RLS); TRIGGER and REFERENCES go too;
--   - tables created later from the SQL editor no longer give anon those privileges by default;
--   - only admins can read giftcodes. Students redeem through redeem_giftcode(), which is SECURITY DEFINER and does
--     not need the policy.
-- NOT fixed yet: a signed-in user can still change or delete rows of the RLS-off tables, and sign-up is open
-- (anyone can call signUp, e-mail is auto-confirmed). That needs RLS with policies per table, which is the next step.
-- Unaffected: SECURITY DEFINER functions, the service role (Vercel cron, Edge Functions), Supabase Auth, the SQL
-- editor, and every signed-in user (sign-up runs signed in because e-mail confirmation is off).
--
-- Every grant and policy removed here is recorded for the undo. Safe to run twice. Undo: unlock_anon_writes.sql.
-- The last result should list only guest_attempts and guest_visitors, each with INSERT.

BEGIN;

-- What this file (and later lock files) took away, for the undo files. Only the SQL editor and service role can
-- read these.
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

-- 1. Record, then revoke. Grants are read from the ACL itself, so the undo gives back exactly what was there.
INSERT INTO public.security_lock_table_grants (table_name, grantee, privilege_type, recorded_by)
SELECT c.relname, r.rolname, a.privilege_type, 'lock_anon_writes'
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(c.relacl) a
JOIN pg_roles r ON r.oid = a.grantee
WHERE ns.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v')
  AND c.relname NOT IN ('security_lock_table_grants', 'security_lock_policies', 'security_lock_function_grants')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
  AND ((r.rolname = 'anon' AND a.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES'))
    OR (r.rolname = 'authenticated' AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')))
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e') -- extension tables
  LOOP
    BEGIN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON %s FROM anon', t.rel);
      EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON %s FROM authenticated', t.rel);
    EXCEPTION WHEN insufficient_privilege THEN
      -- A table this role does not own and holds no privilege on. The check at the end lists it.
      RAISE NOTICE 'Skipped %: %', t.rel, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- 2. The guest page (/guest) saves the guest's name and their result without a login.
DO $$
BEGIN
  IF to_regclass('public.guest_visitors') IS NOT NULL THEN
    GRANT INSERT ON public.guest_visitors TO anon;
  END IF;
  IF to_regclass('public.guest_attempts') IS NOT NULL THEN
    GRANT INSERT ON public.guest_attempts TO anon;
  END IF;
END;
$$;

-- 3. Tables created later by the SQL editor (role postgres) stop handing anon write access by default.
--    A future guest feature that writes a new table needs its own GRANT INSERT ... TO anon.
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Default privileges for new tables were left as they were: %', SQLERRM;
END;
$$;

-- 4. Giftcodes: admins only ("Admins can manage giftcodes" stays).
INSERT INTO public.security_lock_policies (table_name, policy_name, permissive, roles, cmd, qual, with_check, dropped_by)
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check, 'lock_anon_writes'
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'giftcodes' AND policyname = 'Anyone can read active giftcodes'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.giftcodes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone can read active giftcodes" ON public.giftcodes;
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check: what anon can still write. Expected: guest_attempts INSERT, guest_visitors INSERT.
SELECT c.relname AS table_name,
       concat_ws(',',
         CASE WHEN has_table_privilege('anon', c.oid, 'INSERT') THEN 'INSERT' END,
         CASE WHEN has_table_privilege('anon', c.oid, 'UPDATE') THEN 'UPDATE' END,
         CASE WHEN has_table_privilege('anon', c.oid, 'DELETE') THEN 'DELETE' END,
         CASE WHEN has_table_privilege('anon', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END) AS anon_can_still
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v')
  AND (has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('anon', c.oid, 'UPDATE')
    OR has_table_privilege('anon', c.oid, 'DELETE') OR has_table_privilege('anon', c.oid, 'TRUNCATE'))
ORDER BY 1;
