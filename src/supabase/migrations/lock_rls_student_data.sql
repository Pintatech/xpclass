-- Step 2b of the lock: row level security for each student's own rows (answers, progress, tests, achievements,
-- purchases, game scores, teacher reports), the guest page tables, and the open write policies on notifications,
-- weekly_xp_tracking, giftcode_redemptions and wild_area_logs.
--
-- Found 2026-11-07 (security_check.sql sections 10 and 11, rls_precheck.sql):
--   - RLS is OFF on question_attempts (443k rows), user_progress, test_attempts, student_reports, user_achievements,
--     user_purchases, training_scores, pet_interactions, guest_visitors and guest_attempts: any signed-in user (anyone,
--     since sign-up is open) can rewrite or delete every student's answers, progress, test results and game scores,
--     and read every test answer and every teacher report;
--   - notifications lets anyone insert any row (WITH CHECK true), so a student can send a message to everyone;
--   - weekly_xp_tracking lets any signed-in user insert or change anyone's weekly XP;
--   - giftcode_redemptions and wild_area_logs let anyone insert rows. Only SECURITY DEFINER functions write them
--     (redeem_giftcode, the wild area functions), and those skip RLS.
--
-- After this file:
--   question_attempts      read: own rows; teachers/admins all   add: own   change, delete: teachers and admins
--   test_attempts          read: own rows; teachers/admins all   add, change: own   delete: teachers and admins
--   student_reports        read: the student's own; teachers/admins all   write: teachers and admins
--   user_progress          read: signed-in users   add, change: own, or teachers/admins for anyone   delete: teachers, admins
--   user_achievements      read: signed-in users   add, change: own, or admins   delete: admins
--   user_purchases         read: signed-in users   add: own, or admins   change, delete: admins
--   training_scores        read: signed-in users   add, change: own, or admins   delete: admins (End & Award)
--   pet_interactions       read: signed-in users   add: own, or admins   change, delete: admins
--   guest_visitors         guests add their name and get its id back; teachers and admins read the list
--   guest_attempts         guests add and read results as today   change, delete: admins
--   notifications          a student adds notifications for themselves only (achievement, daily challenge), never a
--                          competition_winner one, which every user sees; admins as before. The other policies stay.
--   weekly_xp_tracking     add, change: own, or teachers/admins. The trigger on user_progress writes it as the user who
--                          saves the progress (a teacher grading a video writes the student's row).
--   giftcode_redemptions, wild_area_logs: the open INSERT policy goes; reads stay.
-- No student-side code reads another student's answers, tests or reports (checked in src/), so those reads go. Every
-- other read stays, so leaderboards, profiles and dashboards see the same rows.
-- Not fixed here: a student can still raise their own numbers (their own score rows, XP), because the browser computes
-- rewards. That needs server-side rewards.
-- Unaffected: SECURITY DEFINER functions (rewards, chests, challenge results, clear_competition_scores), the service
-- role (Vercel cron, Edge Functions), the SQL editor.
--
-- Run after lock_anon_writes.sql. Every policy it drops and every table it switches RLS on for is recorded for the undo.
-- Safe to run twice. Undo: unlock_rls_student_data.sql.
-- The last result: every table with rls_on = true; no "Service ... insert" or "System can ..." policy left.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.question_attempts', 'DELETE') OR has_table_privilege('anon', 'public.question_attempts', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Run lock_anon_writes.sql first: anon can still delete rows of question_attempts.';
  END IF;
END;
$$;

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



-- 1. Keep a copy of the policies that go, then drop them (and this file's own policies, when run again).
INSERT INTO public.security_lock_policies (table_name, policy_name, permissive, roles, cmd, qual, with_check, dropped_by)
SELECT p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check, 'lock_rls_student_data'
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.policyname NOT LIKE 'rls students: %'
  AND (p.tablename IN (SELECT unnest(ARRAY['question_attempts', 'test_attempts', 'student_reports', 'user_progress', 'user_achievements', 'user_purchases', 'training_scores', 'pet_interactions', 'guest_visitors', 'guest_attempts']))
       OR (p.tablename, p.policyname) IN (SELECT * FROM (VALUES ('notifications', 'Service role can insert notifications'), ('weekly_xp_tracking', 'System can insert weekly XP tracking'), ('weekly_xp_tracking', 'System can update weekly XP tracking'), ('giftcode_redemptions', 'Service can insert redemptions'), ('wild_area_logs', 'Service can insert wild area logs')) AS o(table_name, policy_name)))
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND (tablename IN (SELECT unnest(ARRAY['question_attempts', 'test_attempts', 'student_reports', 'user_progress', 'user_achievements', 'user_purchases', 'training_scores', 'pet_interactions', 'guest_visitors', 'guest_attempts']))
           OR (tablename, policyname) IN (SELECT * FROM (VALUES ('notifications', 'Service role can insert notifications'), ('weekly_xp_tracking', 'System can insert weekly XP tracking'), ('weekly_xp_tracking', 'System can update weekly XP tracking'), ('giftcode_redemptions', 'Service can insert redemptions'), ('wild_area_logs', 'Service can insert wild area logs')) AS o(table_name, policy_name))
           OR policyname LIKE 'rls students: %')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$$;

-- 2. Switch RLS on, remembering which tables had it off.
INSERT INTO public.security_lock_rls (table_name, enabled_by)
SELECT c.relname, 'lock_rls_student_data'
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public' AND c.relname IN (SELECT unnest(ARRAY['question_attempts', 'test_attempts', 'student_reports', 'user_progress', 'user_achievements', 'user_purchases', 'training_scores', 'pet_interactions', 'guest_visitors', 'guest_attempts'])) AND NOT c.relrowsecurity
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['question_attempts', 'test_attempts', 'student_reports', 'user_progress', 'user_achievements', 'user_purchases', 'training_scores', 'pet_interactions', 'guest_visitors', 'guest_attempts']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

-- 3. The new policies. (SELECT ...) around auth.uid() and the role checks makes Postgres work them out once per query.

-- Answers to each question. Students add their own (exercise pages); teachers fix them (StudentExerciseMatrix).
CREATE POLICY "rls students: own rows, teachers and admins all" ON public.question_attempts
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: add own" ON public.question_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: teachers and admins change" ON public.question_attempts
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()))
  WITH CHECK ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: teachers and admins delete" ON public.question_attempts
  FOR DELETE TO authenticated
  USING ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));

-- Tests. Students start, save drafts and submit their own (useTests); teachers grade (TestResultsView, ExerciseReviewMode).
CREATE POLICY "rls students: own rows, teachers and admins all" ON public.test_attempts
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: add own" ON public.test_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: change own, teachers and admins any" ON public.test_attempts
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()))
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: teachers and admins delete" ON public.test_attempts
  FOR DELETE TO authenticated
  USING ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));

-- Teacher reports (UnitReportPage).
CREATE POLICY "rls students: own report, teachers and admins all" ON public.student_reports
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: teachers and admins write" ON public.student_reports
  FOR ALL TO authenticated
  USING ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()))
  WITH CHECK ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));

-- Progress. Students save their own (useProgress); teachers grade videos and fix scores (VideoSubmissionReview,
-- StudentExerciseMatrix). Leaderboards, profiles and dashboards read everyone's.
CREATE POLICY "rls students: signed-in users read" ON public.user_progress
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls students: add own, teachers and admins any" ON public.user_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: change own, teachers and admins any" ON public.user_progress
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()))
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: teachers and admins delete" ON public.user_progress
  FOR DELETE TO authenticated
  USING ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));

-- Achievements. A student records the ones they earn (useAchievements, check_and_award_achievements).
CREATE POLICY "rls students: signed-in users read" ON public.user_achievements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls students: add own" ON public.user_achievements
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "rls students: change own" ON public.user_achievements
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "rls students: admins change" ON public.user_achievements
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user())) WITH CHECK ((SELECT public.is_admin_user()));

-- Purchases. The shop records the student's own (Shop); admins give items (UserManagement).
CREATE POLICY "rls students: signed-in users read" ON public.user_purchases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls students: add own" ON public.user_purchases
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "rls students: admins change" ON public.user_purchases
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user())) WITH CHECK ((SELECT public.is_admin_user()));

-- Mini-game scores. The pet page saves the student's own attempt (PetDisplay); End & Award clears them (admins).
CREATE POLICY "rls students: signed-in users read" ON public.training_scores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls students: add own" ON public.training_scores
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "rls students: change own" ON public.training_scores
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "rls students: admins change" ON public.training_scores
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user())) WITH CHECK ((SELECT public.is_admin_user()));

-- Pet log, written by the pet functions (check_pet_evolution runs as the student).
CREATE POLICY "rls students: signed-in users read" ON public.pet_interactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls students: add own" ON public.pet_interactions
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "rls students: admins change" ON public.pet_interactions
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user())) WITH CHECK ((SELECT public.is_admin_user()));

-- Guest page (/guest, no login). GuestEntry saves the name and reads the new id back (INSERT ... RETURNING): a guest
-- sees only the row added by that same request (created_at = now() is true only inside it).
CREATE POLICY "rls students: guests add their name" ON public.guest_visitors
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "rls students: guests see the row they just added" ON public.guest_visitors
  FOR SELECT TO anon, authenticated USING (created_at = now());
CREATE POLICY "rls students: teachers and admins read" ON public.guest_visitors
  FOR SELECT TO authenticated
  USING ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: admins change" ON public.guest_visitors
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user())) WITH CHECK ((SELECT public.is_admin_user()));

-- Guest results: GuestSessionRunner adds them and GuestEntry lists a guest's own by guest_id, as today.
CREATE POLICY "rls students: guests add results" ON public.guest_attempts
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "rls students: guests read results" ON public.guest_attempts
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rls students: admins change" ON public.guest_attempts
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user())) WITH CHECK ((SELECT public.is_admin_user()));

-- Notifications. Students add their own (achievement earned, daily challenge result); admins send to anyone through
-- "Admins can manage all notifications", which stays. competition_winner notifications are shown to every user, so
-- only admins and the SECURITY DEFINER award functions make them.
CREATE POLICY "rls students: add own notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = (SELECT auth.uid()) AND type IS DISTINCT FROM 'competition_winner')
              OR (SELECT public.is_admin_user()));

-- Weekly XP, written by the trigger on user_progress as whoever saves the progress.
CREATE POLICY "rls students: add own, teachers and admins any" ON public.weekly_xp_tracking
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));
CREATE POLICY "rls students: change own, teachers and admins any" ON public.weekly_xp_tracking
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()))
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()));

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: 14 rows, each rls_on = true. notifications, weekly_xp_tracking, giftcode_redemptions and
-- wild_area_logs keep their other policies; none of them still has a "Service ... insert" or "System can ..." policy.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
       (SELECT string_agg(p.policyname || ' (' || p.cmd || ')', ' | ' ORDER BY p.policyname)
          FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public'
  AND c.relname IN ('question_attempts', 'test_attempts', 'student_reports', 'user_progress', 'user_achievements',
                    'user_purchases', 'training_scores', 'pet_interactions', 'guest_visitors', 'guest_attempts',
                    'notifications', 'weekly_xp_tracking', 'giftcode_redemptions', 'wild_area_logs')
ORDER BY 1;
