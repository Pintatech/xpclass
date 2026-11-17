-- Undo lock_rls_guest_reads.sql: give the six read policies it changed their old roles back (TO public).
-- WARNING: guests with only the anon key then read students' videos, names + XP per lesson, equipment, Class War
-- members and event progress again. Safe to run twice.
-- The last result: the six policies with their roles.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  p record;
  role_list text;
BEGIN
  IF to_regclass('public.security_lock_policies') IS NULL THEN
    RETURN;
  END IF;

  FOR p IN
    SELECT s.* FROM public.security_lock_policies s
    WHERE s.dropped_by = 'lock_rls_guest_reads'
  LOOP
    IF EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = p.table_name AND policyname = p.policy_name) THEN
      SELECT string_agg(CASE WHEN x::text = 'public' THEN 'PUBLIC' ELSE quote_ident(x::text) END, ', ')
        INTO role_list
        FROM unnest(p.roles) AS x;
      EXECUTE format('ALTER POLICY %I ON public.%I TO %s', p.policy_name, p.table_name, role_list);
    END IF;
  END LOOP;

  DELETE FROM public.security_lock_policies WHERE dropped_by = 'lock_rls_guest_reads';
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
