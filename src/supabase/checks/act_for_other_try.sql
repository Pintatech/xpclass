-- XPclass check RK-02 (2026-11-16): can a student (or a guest) make the server functions act for ANOTHER user?
-- NOTHING IS SAVED: every step is undone right after it runs, and the last line stops with an error that undoes
-- everything this block did.
-- Run it in the Supabase SQL editor. The result is an error that starts with "RK-02 CHECK": that error text is the
-- report. Copy it and send it.
--
-- It picks two students, A and B (or the account in target_email below as A), and calls the functions the app calls
-- (guard_user_functions.sql wraps them with require_acting_for), the way PostgREST does for a request from the app:
--   1 A calls update_mission_progress for A, with a goal that matches no mission (control): must be OK, or steps
--     2-6 prove nothing;
--   2 A calls update_mission_progress for B: must be BLOCKED 42501;
--   3 A calls get_user_missions for B: must be BLOCKED 42501;
--   4 A calls the original, unwrapped function in schema lock_unguarded for B: must be BLOCKED (no access);
--   5 A calls award_single_challenge_winners (admin only): must be BLOCKED 42501;
--   6 a guest (anon role, no login) calls update_mission_progress for B: must be BLOCKED.
-- The last part of the report is "verdict=PASS" when every step did what is expected, else "verdict=FAIL" and the
-- numbers of the steps that did not.
DO $$
DECLARE
  target_email text := '';  -- optional: put the e-mail of the account to use as student A between the quotes
  v_a uuid;
  v_b uuid;
  v_role text;
  v_state text;
  s record;
  v_sql text;
  v_got text;
  v_fail text := '';
  report text;
BEGIN
  -- If a row is busy for more than 5 seconds, stop instead of making the app wait.
  SET LOCAL lock_timeout = '5s';

  IF target_email <> '' THEN
    SELECT u.id, u.role INTO v_a, v_role FROM public.users u WHERE lower(u.email) = lower(target_email);
  ELSE
    SELECT u.id, u.role INTO v_a, v_role
    FROM public.users u
    WHERE u.role = 'user' AND NOT COALESCE(u.is_banned, false)
    ORDER BY u.last_activity_date DESC NULLS LAST, u.id
    LIMIT 1;
  END IF;
  IF v_a IS NULL THEN
    RAISE EXCEPTION 'RK-02 CHECK: no account found (check target_email)';
  END IF;
  SELECT u.id INTO v_b FROM public.users u WHERE u.role = 'user' AND u.id <> v_a ORDER BY u.id LIMIT 1;
  IF v_b IS NULL THEN
    RAISE EXCEPTION 'RK-02 CHECK: no second student found';
  END IF;

  v_state := CASE WHEN to_regprocedure('public.require_acting_for(uuid,text,text,integer)') IS NULL
                  THEN 'MISSING: guard_user_functions.sql has not been run' ELSE 'present' END;
  report := 'A role=' || COALESCE(v_role, '?')
            || ' | require_acting_for=' || v_state
            || ' | lock_unguarded schema=' || CASE WHEN to_regnamespace('lock_unguarded') IS NULL THEN 'MISSING' ELSE 'present' END
            || ' | update_mission_progress wrapped='
            || COALESCE((SELECT (position('require_acting_for' IN p.prosrc) > 0)::text
                         FROM pg_proc p WHERE p.proname = 'update_mission_progress' AND p.pronamespace = 'public'::regnamespace
                         LIMIT 1), 'function missing');

  FOR s IN
    SELECT * FROM (VALUES
      (1, 'A calls it for A (control)',        'a',    'ok',      format('SELECT public.update_mission_progress(%L, %L, 1)', v_a, 'rk02_no_such_goal')),
      (2, 'A: update_mission_progress for B',  'a',    'blocked', format('SELECT public.update_mission_progress(%L, %L, 1)', v_b, 'rk02_no_such_goal')),
      (3, 'A: get_user_missions for B',        'a',    'blocked', format('SELECT public.get_user_missions(%L)', v_b)),
      (4, 'A: original in lock_unguarded for B', 'a',  'blocked', format('SELECT lock_unguarded.update_mission_progress(%L, %L, 1)', v_b, 'rk02_no_such_goal')),
      (5, 'A: award_single_challenge_winners', 'a',    'blocked', format('SELECT public.award_single_challenge_winners(%L)', '00000000-0000-0000-0000-000000000000')),
      (6, 'guest: update_mission_progress for B', 'anon', 'blocked', format('SELECT public.update_mission_progress(%L, %L, 1)', v_b, 'rk02_no_such_goal'))
    ) AS t(n, label, who, expected, sql)
    ORDER BY n
  LOOP
    v_got := 'ok';
    BEGIN
      -- Sign in the way PostgREST does for each request from the app. The 'rk02-undo' error below undoes the step,
      -- the role and the claims with it.
      IF s.who = 'a' THEN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
        PERFORM set_config('request.jwt.claim.sub', v_a::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        SET LOCAL ROLE authenticated;
      ELSE
        PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', 'anon', true);
        SET LOCAL ROLE anon;
      END IF;
      EXECUTE s.sql;
      RAISE EXCEPTION 'rk02-undo';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'rk02-undo' THEN
        -- 42883 / 3F000 = the function or the schema does not exist: that is a broken check, not a blocked call.
        v_got := CASE WHEN SQLSTATE IN ('42883', '3F000') THEN 'error ' ELSE 'blocked ' END
                 || SQLSTATE || ': ' || left(SQLERRM, 80);
      END IF;
    END;
    report := report || ' || ' || s.n || ' ' || s.label || ': ' || CASE WHEN v_got = 'ok' THEN 'OK (allowed)' ELSE upper(left(v_got, 1)) || substr(v_got, 2) END;
    IF split_part(v_got, ' ', 1) <> s.expected THEN
      v_fail := v_fail || CASE WHEN v_fail = '' THEN '' ELSE ',' END || s.n;
    END IF;
  END LOOP;
  RESET ROLE;

  report := report || ' || verdict=' || CASE WHEN v_fail = '' THEN 'PASS' ELSE 'FAIL (steps ' || v_fail || ')' END;
  RAISE EXCEPTION 'RK-02 CHECK (nothing was saved): %', report;
END;
$$;
