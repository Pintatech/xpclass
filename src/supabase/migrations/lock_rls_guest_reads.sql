-- Step 2d of the lock: guests (anon key only, no login) stop reading student rows.
--
-- Found 2026-11-17 (checks/anon_try.sql part E, run live): six read policies say USING (true) for every role, so anyone
-- with the anon key (it is in the site's JS) reads them:
--   video_submissions       2799 rows, video_url of the students' videos (bucket is public)   "Students can view all submissions for same exercise"
--   session_reward_claims   3397 rows, full_name + XP/gems per lesson                         "Anyone can view session reward claims for leaderboard"
--   user_equipment           292 rows                                                         "Anyone can view user equipment"
--   class_war_members        306 rows                                                         class_war_members_select
--   event_stage_clears       565 rows                                                         event_stage_clears_select
--   event_character_stats      7 rows                                                         event_character_stats_select
-- The last three come from add_class_wars.sql, add_event_stage_ladder.sql, add_event_character_stats.sql; the first
-- three exist only on live (made on the Dashboard).
--
-- After this file: the same six policies, same names, same USING (true), but only for signed-in users. Every reader in
-- src/ is behind login (Profile, useAuth, useClassWar, useLiveBattle, useEventLadder, VideoUploadExercise, teacher
-- reports); the guest pages (/guest, /guest/session) read none of these tables.
-- Not fixed here: every signed-in student still reads every student's videos (all classes), as today.
-- Unaffected: writes (anon has no write grant since lock_anon_writes.sql), definer functions, the service role.
--
-- Only a policy that is still exactly "TO public USING (true)" is changed, and it is recorded for the undo.
-- Safe to run twice. Undo: unlock_rls_guest_reads.sql.
-- The last result: 6 rows, each roles = {authenticated}.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

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

DO $$
DECLARE
  t record;
  p record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('video_submissions',     'Students can view all submissions for same exercise'),
      ('session_reward_claims', 'Anyone can view session reward claims for leaderboard'),
      ('user_equipment',        'Anyone can view user equipment'),
      ('class_war_members',     'class_war_members_select'),
      ('event_stage_clears',    'event_stage_clears_select'),
      ('event_character_stats', 'event_character_stats_select')
    ) AS v(table_name, policy_name)
  LOOP
    SELECT * INTO p FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t.table_name AND policyname = t.policy_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Policy "%" on % is missing. Nothing changed; check pg_policies first.', t.policy_name, t.table_name;
    END IF;

    IF p.roles = ARRAY['authenticated']::name[] THEN
      CONTINUE;  -- already done (second run)
    END IF;

    IF p.roles <> ARRAY['public']::name[] OR p.cmd <> 'SELECT' OR p.qual IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Policy "%" on % is not "SELECT TO public USING (true)" any more (roles %, qual %). Nothing changed.',
        t.policy_name, t.table_name, p.roles, p.qual;
    END IF;

    INSERT INTO public.security_lock_policies (table_name, policy_name, permissive, roles, cmd, qual, with_check, dropped_by)
    VALUES (p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check, 'lock_rls_guest_reads')
    ON CONFLICT (table_name, policy_name) DO NOTHING;

    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', t.policy_name, t.table_name);
  END LOOP;
END;
$$;

COMMIT;

SELECT tablename, policyname, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename, policyname) IN (
    ('video_submissions',     'Students can view all submissions for same exercise'),
    ('session_reward_claims', 'Anyone can view session reward claims for leaderboard'),
    ('user_equipment',        'Anyone can view user equipment'),
    ('class_war_members',     'class_war_members_select'),
    ('event_stage_clears',    'event_stage_clears_select'),
    ('event_character_stats', 'event_character_stats_select'))
ORDER BY tablename;
