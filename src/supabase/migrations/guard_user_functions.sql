-- Step 5a of the lock: functions that act for a user (p_user_id) may only be called for oneself.
--
-- Found 2026-11-07 (security_check.sql section 5): about 28 SECURITY DEFINER functions take the user as an argument
-- (p_user_id, user_id_param or user_id) and never check it against the caller. A signed-in student could open
-- another student's chests, spend their gems on eggs and balls, feed or evolve their pets, claim their missions and
-- achievements, redeem gift codes for them, or read their notifications. award_single_challenge_winners (pays the
-- daily challenge winners) could be called by any student. increment_user_currency, spend_user_gems, spend_user_xp,
-- add_xp_batch and award_pvp_win already check the caller (lock_currency_rpcs.sql, lock_add_xp_batch.sql).
--
-- How: each listed function moves, unchanged and under the same name, to the schema lock_unguarded, which the API does
-- not expose and nobody but its owner may use. A function with the original name, arguments and result type takes
-- its place in public: it checks the caller, then calls the original. (The name stays the same so that bodies that
-- refer to a parameter as <function name>.<parameter> keep working.) A call is let through when:
--   - the user argument is the caller (auth.uid()), or
--   - the caller is a teacher or an admin (users.role), or
--   - it does not come from a browser: the service role (Vercel cron, Edge Functions), pg_cron, the SQL editor;
-- plus two rules found in the app (src/, checked 2026-11-07):
--   - update_mission_progress(winner, 'win_pvp', 1): after a PvP match the loser's browser counts the win for the
--     winner (PvPChallengeModal, PvPIncomingBanner). Allowed only when the caller played a completed match against
--     that user in the last 7 days and the user won it;
--   - award_single_challenge_winners: admins (and the server) only. The app calls it from the admin daily challenge
--     page.
-- Everything else is refused with error 42501. Every call the app makes today passes these rules.
--
-- Not fixed here: a student can still call these functions for themselves with made-up input (a score of 100, a
-- big mission increment). That is step 5d.
-- Safe to run twice (functions already wrapped are skipped). Undo: unguard_user_functions.sql.
-- The last result lists each function with wrapped = true; "not found" rows are functions this project lacks.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.security_lock_wrapped_functions (
  function_name text NOT NULL,
  identity_args text NOT NULL,
  acl aclitem[],
  wrapped_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (function_name, identity_args)
);
ALTER TABLE public.security_lock_wrapped_functions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_lock_wrapped_functions FROM PUBLIC, anon, authenticated;

CREATE SCHEMA IF NOT EXISTS lock_unguarded;
REVOKE ALL ON SCHEMA lock_unguarded FROM PUBLIC, anon, authenticated, service_role;

-- 1. The check. Raises 42501 unless the caller may act for p_user_id under p_rule.
CREATE OR REPLACE FUNCTION public.require_acting_for(
  p_user_id uuid,
  p_rule text DEFAULT 'self',
  p_goal text DEFAULT NULL,
  p_increment integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim_role text := COALESCE(auth.jwt() ->> 'role', '');
  me uuid := auth.uid();
BEGIN
  -- Not from a browser: service role key, pg_cron, the SQL editor.
  IF claim_role = 'service_role' OR (me IS NULL AND claim_role = '') THEN
    RETURN;
  END IF;

  IF me IS NOT NULL THEN
    IF p_rule = 'admin' THEN
      IF EXISTS (SELECT 1 FROM public.users WHERE id = me AND role = 'admin') THEN
        RETURN;
      END IF;
    ELSE
      IF p_user_id = me THEN
        RETURN;
      END IF;
      IF EXISTS (SELECT 1 FROM public.users WHERE id = me AND role IN ('admin', 'teacher')) THEN
        RETURN;
      END IF;
      IF p_rule = 'pvp_win_mission' AND p_goal = 'win_pvp' AND p_increment = 1
         AND EXISTS (SELECT 1 FROM public.pvp_challenges c
                     WHERE c.winner_id = p_user_id
                       AND me IN (c.challenger_id, c.opponent_id)
                       AND c.status = 'completed'
                       AND c.created_at > now() - interval '7 days') THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  RAISE EXCEPTION 'You can only do this for your own account' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.require_acting_for(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;

-- 2. Wrap each function. The user argument is the first input argument named p_user_id, user_id_param or user_id.
DO $$
DECLARE
  targets constant text[][] := ARRAY[
    -- name, rule
    ['adopt_pet', 'self'], ['attempt_catch_pet', 'self'], ['award_competition_items', 'self'],
    ['award_exercise_chest', 'self'], ['award_milestone_chest', 'self'], ['buy_ball', 'self'], ['buy_egg', 'self'],
    ['claim_achievement_xp', 'self'], ['claim_all_mission_rewards', 'self'], ['claim_mission_reward', 'self'],
    ['craft_recipe', 'self'], ['equip_background', 'self'], ['evolve_pet', 'self'], ['feed_pet', 'self'],
    ['get_notifications', 'self'], ['get_user_missions', 'self'], ['get_user_profile', 'self'],
    ['open_chest', 'self'], ['open_egg', 'self'], ['play_with_pet', 'self'],
    ['record_challenge_participation', 'self'], ['redeem_giftcode', 'self'], ['roll_exercise_drop', 'self'],
    ['roll_pet_encounter', 'self'], ['roll_wild_area_encounter', 'self'], ['set_active_pet', 'self'],
    ['update_mission_progress', 'pvp_win_mission'], ['award_single_challenge_winners', 'admin']
  ];
  t text[];
  f record;
  identity text;
  in_names text[];
  call_args text;
  user_arg text;
  check_call text;
  volatility text;
BEGIN
  FOREACH t SLICE 1 IN ARRAY targets LOOP
    FOR f IN
      SELECT p.oid, p.proname, p.proowner, p.proacl, p.provolatile, p.proargnames, p.proargmodes, p.pronargs
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = t[1] AND p.prosecdef AND p.prokind = 'f'
    LOOP
      identity := pg_get_function_identity_arguments(f.oid);

      -- Already wrapped (this is the wrapper): skip.
      IF EXISTS (SELECT 1 FROM pg_proc q
                 WHERE q.pronamespace = 'lock_unguarded'::regnamespace AND q.proname = f.proname
                   AND pg_get_function_identity_arguments(q.oid) = identity) THEN
        CONTINUE;
      END IF;

      -- Input argument names, in order (proargmodes is NULL when every argument is IN).
      in_names := '{}';
      call_args := '';
      IF f.proargnames IS NOT NULL THEN
        SELECT array_agg(a.name ORDER BY a.ord),
               string_agg(CASE WHEN a.mode = 'v' THEN 'VARIADIC ' ELSE '' END || quote_ident(a.name), ', ' ORDER BY a.ord)
          INTO in_names, call_args
        FROM unnest(f.proargnames, COALESCE(f.proargmodes, array_fill('i'::"char", ARRAY[array_length(f.proargnames, 1)])))
               WITH ORDINALITY AS a(name, mode, ord)
        WHERE a.mode IN ('i', 'b', 'v');
      END IF;

      IF f.pronargs > 0 AND (in_names IS NULL OR COALESCE(array_length(in_names, 1), 0) <> f.pronargs OR '' = ANY (in_names)) THEN
        RAISE NOTICE 'Skipped public.%(%): it has an argument without a name', f.proname, identity;
        CONTINUE;
      END IF;

      user_arg := (SELECT n FROM unnest(ARRAY['p_user_id', 'user_id_param', 'user_id']) AS n WHERE n = ANY (in_names) LIMIT 1);

      IF t[2] = 'admin' THEN
        check_call := 'SELECT public.require_acting_for(NULL::uuid, ''admin'');';
      ELSIF user_arg IS NULL THEN
        RAISE NOTICE 'Skipped public.%(%): no p_user_id / user_id_param / user_id argument', f.proname, identity;
        CONTINUE;
      ELSIF t[2] = 'pvp_win_mission' AND 'p_goal_type' = ANY (in_names) AND 'p_increment' = ANY (in_names) THEN
        check_call := format('SELECT public.require_acting_for(%I, ''pvp_win_mission'', p_goal_type::text, p_increment::integer);', user_arg);
      ELSE
        check_call := format('SELECT public.require_acting_for(%I);', user_arg);
      END IF;

      volatility := CASE f.provolatile WHEN 'v' THEN 'VOLATILE' ELSE 'STABLE' END;

      BEGIN
      INSERT INTO public.security_lock_wrapped_functions (function_name, identity_args, acl, wrapped_by)
      VALUES (f.proname, identity, COALESCE(f.proacl, acldefault('f', f.proowner)), 'guard_user_functions')
      ON CONFLICT DO NOTHING;

      EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA lock_unguarded', f.proname, identity);

      EXECUTE format(
        'CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql %s SECURITY DEFINER SET search_path = public AS %L',
        f.proname, pg_get_function_arguments(f.oid), pg_get_function_result(f.oid), volatility,
        check_call || E'\nSELECT * FROM lock_unguarded.' || quote_ident(f.proname) || '(' || COALESCE(call_args, '') || ');');

      -- The new function gets the grants the original had; the original keeps only its owner.
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC', f.proname, identity);
      EXECUTE COALESCE((
        SELECT string_agg(format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO %s', f.proname, identity,
                                 CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END), '; ')
        FROM aclexplode(COALESCE(f.proacl, acldefault('f', f.proowner))) a
        LEFT JOIN pg_roles r ON r.oid = a.grantee
        WHERE a.privilege_type = 'EXECUTE' AND a.grantee <> f.proowner
      ), 'SELECT 1');
      EXECUTE format('REVOKE ALL ON FUNCTION lock_unguarded.%I(%s) FROM PUBLIC, anon, authenticated, service_role',
                     f.proname, identity);
      EXCEPTION WHEN insufficient_privilege THEN
        -- Not owned by the role running this file: leave it as it is, and say so.
        RAISE NOTICE 'Skipped public.%(%): %', f.proname, identity, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: every "wrapped" row has wrapped = true and students_can_call = true. A function this project does
-- not have shows "not found". "called inside" rows (if any) are other functions whose body calls a wrapped one: the
-- check then applies to that inner call too, with the same caller, so send those rows to review.
WITH targets(name) AS (
  SELECT unnest(ARRAY['adopt_pet', 'attempt_catch_pet', 'award_competition_items', 'award_exercise_chest',
                      'award_milestone_chest', 'buy_ball', 'buy_egg', 'claim_achievement_xp', 'claim_all_mission_rewards',
                      'claim_mission_reward', 'craft_recipe', 'equip_background', 'evolve_pet', 'feed_pet',
                      'get_notifications', 'get_user_missions', 'get_user_profile', 'open_chest', 'open_egg',
                      'play_with_pet', 'record_challenge_participation', 'redeem_giftcode', 'roll_exercise_drop',
                      'roll_pet_encounter', 'roll_wild_area_encounter', 'set_active_pet', 'update_mission_progress',
                      'award_single_challenge_winners'])
)
SELECT 'wrapped' AS kind, t.name AS function_name,
       COALESCE(string_agg(DISTINCT pg_get_function_identity_arguments(p.oid), ' | '), 'not found') AS arguments,
       bool_and(EXISTS (SELECT 1 FROM pg_proc q
                        WHERE q.pronamespace = to_regnamespace('lock_unguarded') AND q.proname = t.name
                          AND pg_get_function_identity_arguments(q.oid) = pg_get_function_identity_arguments(p.oid))) AS wrapped,
       bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS students_can_call
FROM targets t
LEFT JOIN pg_proc p ON p.proname = t.name AND p.pronamespace = 'public'::regnamespace AND p.prosecdef AND p.prokind = 'f'
GROUP BY t.name
UNION ALL
SELECT 'called inside', c.proname, string_agg(DISTINCT t.name, ', '), NULL, NULL
FROM pg_proc c
JOIN targets t ON c.prosrc ~ ('\m' || t.name || '\s*\(')
WHERE c.pronamespace IN ('public'::regnamespace, to_regnamespace('lock_unguarded'))
  AND c.prolang <> (SELECT oid FROM pg_language WHERE lanname = 'internal')
  AND c.proname <> t.name
  AND c.proname <> 'require_acting_for'
GROUP BY c.proname
ORDER BY 1, 2;
