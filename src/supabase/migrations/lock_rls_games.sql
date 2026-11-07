-- Step 2c of the lock: row level security for the multiplayer tables (PvP, tournaments, Live Battle).
--
-- Found 2026-11-07 (security_check.sql sections 10 and 11, rls_precheck.sql):
--   - RLS is OFF on pvp_challenges, pvp_matchmaking, tournaments, tournament_matches and tournament_participants, so
--     any signed-in user (anyone, since sign-up is open) can rewrite any match, set any winner, delete tournaments or
--     add themselves to one that is already running;
--   - live_battle_sessions and live_battle_participants allow everything to every signed-in user;
--   - tournament_teams and tournament_team_members allow insert and delete, by anyone, of any team or member.
--
-- After this file (every signed-in user still reads all of them, as today; realtime on pvp_challenges keeps working):
--   pvp_challenges           start: as the challenger   change, delete: the two players   admins: anything
--   pvp_matchmaking          join, leave, change: own queue row; a player may also mark a waiting player as matched
--                            (status 'matching', then 'matched' with a challenge they started against that player),
--                            which is how PvPMatchmaking pairs two players   admins: anything
--   tournament_matches       the two players post their scores (PetDisplay); teachers and admins: anything
--   tournament_participants  a student signs up only for a tournament in registration; teachers and admins: anything
--   tournament_teams         a student creates a team only in a tournament in registration; teachers and admins: anything
--   tournament_team_members  a student joins (as themselves) only a team of a tournament in registration;
--                            teachers and admins: anything
--   tournaments, live_battle_sessions, live_battle_participants   teachers and admins only (TournamentManagement,
--                            Live Battle page)
-- Not fixed here: a player can still change their own match (own score, winner), the same "own numbers" problem as XP.
-- Unaffected: SECURITY DEFINER functions (award_pvp_win, currency functions), the service role, the SQL editor.
--
-- Run after lock_anon_writes.sql. Every policy it drops and every table it switches RLS on for is recorded for the undo.
-- Safe to run twice. Undo: unlock_rls_games.sql.
-- The last result: 9 rows, each rls_on = true with only "rls games:" policies.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.pvp_challenges', 'DELETE') OR has_table_privilege('anon', 'public.pvp_challenges', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Run lock_anon_writes.sql first: anon can still delete rows of pvp_challenges.';
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


-- 1. Keep a copy of every policy now on these tables, then drop them all.
INSERT INTO public.security_lock_policies (table_name, policy_name, permissive, roles, cmd, qual, with_check, dropped_by)
SELECT p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check, 'lock_rls_games'
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN (SELECT unnest(ARRAY['pvp_challenges', 'pvp_matchmaking', 'tournaments', 'tournament_matches', 'tournament_participants', 'tournament_teams', 'tournament_team_members', 'live_battle_sessions', 'live_battle_participants']))
  AND p.policyname NOT LIKE 'rls games: %'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (SELECT unnest(ARRAY['pvp_challenges', 'pvp_matchmaking', 'tournaments', 'tournament_matches', 'tournament_participants', 'tournament_teams', 'tournament_team_members', 'live_battle_sessions', 'live_battle_participants']))
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$$;

-- 2. Switch RLS on, remembering which tables had it off.
INSERT INTO public.security_lock_rls (table_name, enabled_by)
SELECT c.relname, 'lock_rls_games'
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public' AND c.relname IN (SELECT unnest(ARRAY['pvp_challenges', 'pvp_matchmaking', 'tournaments', 'tournament_matches', 'tournament_participants', 'tournament_teams', 'tournament_team_members', 'live_battle_sessions', 'live_battle_participants'])) AND NOT c.relrowsecurity
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['pvp_challenges', 'pvp_matchmaking', 'tournaments', 'tournament_matches', 'tournament_participants', 'tournament_teams', 'tournament_team_members', 'live_battle_sessions', 'live_battle_participants']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

-- 3. The new policies.
DO $$
DECLARE
  t text;
BEGIN
  -- Leaderboards, the dashboard, the tournament widget and the PvP screens read everyone's rows.
  FOR t IN SELECT unnest(ARRAY['pvp_challenges', 'pvp_matchmaking', 'tournaments', 'tournament_matches', 'tournament_participants', 'tournament_teams', 'tournament_team_members', 'live_battle_sessions', 'live_battle_participants']) LOOP
    EXECUTE format('CREATE POLICY "rls games: signed-in users read" ON public.%I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['tournaments', 'tournament_matches', 'tournament_participants', 'tournament_teams',
                           'tournament_team_members', 'live_battle_sessions', 'live_battle_participants'] LOOP
    EXECUTE format('CREATE POLICY "rls games: teachers and admins change" ON public.%I FOR ALL TO authenticated '
                   'USING ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user())) '
                   'WITH CHECK ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user()))', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['pvp_challenges', 'pvp_matchmaking'] LOOP
    EXECUTE format('CREATE POLICY "rls games: admins change" ON public.%I FOR ALL TO authenticated '
                   'USING ((SELECT public.is_admin_user())) WITH CHECK ((SELECT public.is_admin_user()))', t);
  END LOOP;
END;
$$;

-- PvP matches (PvPChallengeModal, PvPIncomingBanner, PvPMatchmaking, the realtime games).
CREATE POLICY "rls games: challenger starts a match" ON public.pvp_challenges
  FOR INSERT TO authenticated
  WITH CHECK (challenger_id = (SELECT auth.uid()));
CREATE POLICY "rls games: players change their match" ON public.pvp_challenges
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IN (challenger_id, opponent_id))
  WITH CHECK ((SELECT auth.uid()) IN (challenger_id, opponent_id));
CREATE POLICY "rls games: players delete their match" ON public.pvp_challenges
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IN (challenger_id, opponent_id));

-- Quick-match queue (PvPMatchmaking). The player with the lower id claims the other one's row ('matching'), starts
-- the challenge, then marks that row 'matched' with the challenge id.
CREATE POLICY "rls games: join the queue" ON public.pvp_matchmaking
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "rls games: leave the queue" ON public.pvp_matchmaking
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "rls games: change own queue row" ON public.pvp_matchmaking
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "rls games: match a waiting player" ON public.pvp_matchmaking
  FOR UPDATE TO authenticated
  USING (status IN ('waiting', 'matching'))
  WITH CHECK (
    (status = 'matching' AND challenge_id IS NULL)
    OR (status = 'matched' AND challenge_id IN (
          SELECT c.id FROM public.pvp_challenges c
          WHERE c.challenger_id = (SELECT auth.uid()) AND c.opponent_id = pvp_matchmaking.user_id))
  );

-- Tournament matches: after a game the pet page writes the best scores into the player's ready matches (PetDisplay).
CREATE POLICY "rls games: players post their scores" ON public.tournament_matches
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IN (player1_id, player2_id))
  WITH CHECK ((SELECT auth.uid()) IN (player1_id, player2_id));

-- Registration (TournamentWidget: registerForTournament, createTeam, joinTeam).
CREATE POLICY "rls games: sign up for an open tournament" ON public.tournament_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND eliminated_in_round IS NULL
    AND tournament_id IN (SELECT t.id FROM public.tournaments t WHERE t.status = 'registration')
  );
CREATE POLICY "rls games: create a team in an open tournament" ON public.tournament_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    eliminated_in_round IS NULL
    AND tournament_id IN (SELECT t.id FROM public.tournaments t WHERE t.status = 'registration')
  );
CREATE POLICY "rls games: join a team in an open tournament" ON public.tournament_team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND team_id IN (SELECT tt.id FROM public.tournament_teams tt
                    JOIN public.tournaments t ON t.id = tt.tournament_id
                    WHERE t.status = 'registration')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: 9 rows, each rls_on = true with only "rls games:" policies.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
       (SELECT string_agg(p.policyname || ' (' || p.cmd || ')', ' | ' ORDER BY p.policyname)
          FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public'
  AND c.relname IN ('pvp_challenges', 'pvp_matchmaking', 'tournaments', 'tournament_matches', 'tournament_participants',
                    'tournament_teams', 'tournament_team_members', 'live_battle_sessions', 'live_battle_participants')
ORDER BY 1;
