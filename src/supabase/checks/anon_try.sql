-- XPclass check RK-03 (2026-11-17): what can a guest (only the public anon key, no login) read, change or call?
-- NOTHING IS SAVED: every step is undone right after it runs, and the last line stops with an error that undoes
-- everything this block did.
-- Run it in the Supabase SQL editor. The result is an error that starts with "RK-03 CHECK": that error text is the
-- report. Copy it and send it.
--
-- Part 1, real tries. Each one runs as a guest the way PostgREST runs a request sent with the anon key (role anon +
-- the anon JWT claims):
--   1 read courses (control): must be OK, or the tries below prove nothing;
--   2 add a name to guest_visitors, as /guest does (control): must be OK (1 row);
--   3 read users: must see 0 rows;
--   4 change a student's xp in users: must be BLOCKED (42501 or 0 rows);
--   5 delete that student's users row: must be BLOCKED;
--   6 delete one row of question_attempts: must be BLOCKED;
--   7 change one row of site_settings: must be BLOCKED;
--   8 empty guest_attempts (TRUNCATE skips RLS): must be BLOCKED;
--   9 read giftcodes: must see 0 rows;
--  10 increment_user_currency for the student: must be BLOCKED;
--  11 award_weekly_xp_champion (cron only): must be BLOCKED;
--  12 redeem_giftcode for the student: must be BLOCKED;
--  13 read the view v_cohort_members_detailed (names, e-mails): must be BLOCKED;
--  14 login_email_for_username: OK by design (the login form needs it; RK-06 is about it).
--  "n/a" = this project has no such table or function, so there is nothing to try.
-- Part 2, the whole database, read from the catalog:
--   A write grants (INSERT, UPDATE, DELETE, TRUNCATE) guests hold on tables and views: must be only INSERT on
--     guest_attempts and guest_visitors;
--   B tables with RLS off that guests can read: must be none (RLS off = a guest reads every row);
--   C views guests can read that run as their owner (they skip RLS): must be none;
--   D SECURITY DEFINER functions guests can call: every one must be login_email_for_username, a helper an RLS policy
--     calls, or a function that checks the caller (require_acting_for). Any other one is listed as FAIL;
--   E tables where a guest sees rows, counted as a guest (seen/total): a table with people's data (a user_id,
--     student_id, email, guest_id, challenger_id or player1_id column) must show none, except guest_attempts
--     (by design, RK-29). Other tables outside the guest pages' list are WARN;
--   F what a NEW table, view and function made later in the SQL editor give guests. It makes three throwaway objects
--     (rk03_probe_*) and undoes them. A new table must not give guests write access (FAIL); guest read or call on new
--     objects is WARN: each new SQL file then has to revoke it itself.
-- The last part of the report is "verdict=PASS" when every try and A-F are as expected, else "verdict=FAIL" with
-- what was not. WARN lines do not change the verdict.
DO $$
DECLARE
  target_email text := '';  -- optional: put the e-mail of the student to aim the tries at between the quotes
  people_cols constant text[] := ARRAY['user_id', 'student_id', 'email', 'guest_id', 'challenger_id', 'player1_id'];
  guest_tables constant text[] := ARRAY['courses', 'site_settings', 'student_levels', 'units', 'sessions',
                                        'exercise_assignments', 'exercises', 'guest_attempts', 'guest_visitors'];
  v_s uuid;
  v_qa uuid;
  v_setting uuid;
  s record;
  t record;
  v_val text;
  v_rows bigint;
  v_total bigint;
  v_err text;
  v_msg text;
  v_got text;
  v_line text;
  v_list text;
  v_fail text := '';
  v_warn text := '';
  report text := '';
  e_seen text := '';
  e_people text := '';
  e_other text := '';
  e_error text := '';
  f_tab_read boolean;
  f_tab_write text;
  f_view_read boolean;
  f_fn boolean;
  f_err text;
BEGIN
  -- If a row or table is busy for more than 5 seconds, stop instead of making the app wait.
  SET LOCAL lock_timeout = '5s';

  IF target_email <> '' THEN
    SELECT u.id INTO v_s FROM public.users u WHERE lower(u.email) = lower(target_email);
  ELSE
    SELECT u.id INTO v_s FROM public.users u WHERE u.role = 'user'
    ORDER BY u.last_activity_date DESC NULLS LAST, u.id LIMIT 1;
  END IF;
  IF v_s IS NULL THEN
    RAISE EXCEPTION 'RK-03 CHECK: no student found (check target_email)';
  END IF;
  IF to_regclass('public.question_attempts') IS NOT NULL THEN
    EXECUTE 'SELECT id FROM public.question_attempts LIMIT 1' INTO v_qa;
  END IF;
  IF to_regclass('public.site_settings') IS NOT NULL THEN
    EXECUTE 'SELECT id FROM public.site_settings LIMIT 1' INTO v_setting;
  END IF;

  -- ── Part 1: real tries as a guest ───────────────────────────────────────────────────────────────────────────────
  -- mode v: the statement returns a row count; mode x: count the rows it changed.
  -- open_if rows: the try worked only if it touched rows; ran: it worked if it ran at all.
  FOR s IN
    SELECT * FROM (VALUES
      (1,  'read courses (control)',           'ok',      'v', 'ran',  'SELECT count(*) FROM public.courses'),
      (2,  'add a guest name (control)',       'ok',      'x', 'rows', 'INSERT INTO public.guest_visitors (name) VALUES (''rk03 check'')'),
      (3,  'read users',                       'blocked', 'v', 'rows', 'SELECT count(*) FROM public.users'),
      (4,  'change a student''s xp',           'blocked', 'x', 'rows', format('UPDATE public.users SET xp = xp WHERE id = %L', v_s)),
      (5,  'delete a student',                 'blocked', 'x', 'rows', format('DELETE FROM public.users WHERE id = %L', v_s)),
      (6,  'delete a question_attempts row',   'blocked', 'x', 'rows', format('DELETE FROM public.question_attempts WHERE id = %L', COALESCE(v_qa, '00000000-0000-0000-0000-000000000000'::uuid))),
      (7,  'change a site_settings row',       'blocked', 'x', 'rows', format('UPDATE public.site_settings SET setting_value = setting_value WHERE id = %L', COALESCE(v_setting, '00000000-0000-0000-0000-000000000000'::uuid))),
      (8,  'TRUNCATE guest_attempts',          'blocked', 'x', 'ran',  'TRUNCATE public.guest_attempts'),
      (9,  'read giftcodes',                   'blocked', 'v', 'rows', 'SELECT count(*) FROM public.giftcodes'),
      (10, 'increment_user_currency +1 xp',    'blocked', 'x', 'ran',  format('SELECT public.increment_user_currency(%L::uuid, 1, 0)', v_s)),
      (11, 'award_weekly_xp_champion (cron)',  'blocked', 'x', 'ran',  'SELECT public.award_weekly_xp_champion()'),
      (12, 'redeem_giftcode for the student',  'blocked', 'x', 'ran',  format('SELECT public.redeem_giftcode(%L::uuid, %L)', v_s, 'rk03-no-such-code')),
      (13, 'read v_cohort_members_detailed',   'blocked', 'v', 'rows', 'SELECT count(*) FROM public.v_cohort_members_detailed'),
      (14, 'login_email_for_username (RK-06)', 'ok',      'x', 'ran',  format('SELECT public.login_email_for_username(%L)', 'rk03_no_such_user'))
    ) AS q(n, label, expected, mode, open_if, sql)
    ORDER BY n
  LOOP
    v_rows := NULL; v_err := NULL; v_msg := NULL;
    BEGIN
      -- A request with the anon key. The 'rk03-undo' error below undoes the step, the role and the claims with it.
      PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', 'anon', true);
      SET LOCAL ROLE anon;
      IF s.mode = 'v' THEN
        EXECUTE s.sql INTO v_val;
        v_rows := v_val::bigint;
      ELSE
        EXECUTE s.sql;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
      END IF;
      RAISE EXCEPTION 'rk03-undo';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'rk03-undo' THEN
        v_err := SQLSTATE;
        v_msg := left(SQLERRM, 70);
      END IF;
    END;

    IF v_err IN ('42P01', '42883', '3F000') THEN
      v_got := 'n/a';
      v_line := 'n/a (' || v_msg || ')';
    ELSIF v_err = '42501' THEN
      v_got := 'blocked';
      v_line := 'BLOCKED 42501: ' || v_msg;
    ELSIF v_err IS NOT NULL THEN
      -- It got past the permission check and failed on something else: a guest can run it.
      v_got := 'ok';
      v_line := 'NOT BLOCKED (ran, then error ' || v_err || ': ' || v_msg || ')';
    ELSIF s.open_if = 'rows' AND v_rows = 0 THEN
      v_got := 'blocked';
      v_line := CASE WHEN s.mode = 'v' THEN 'BLOCKED (sees 0 rows)' ELSE 'BLOCKED (0 rows changed)' END;
    ELSE
      v_got := 'ok';
      v_line := CASE WHEN s.expected = 'ok' THEN 'OK' ELSE 'OPEN' END
                || CASE WHEN s.mode = 'v' THEN ' (sees ' || v_rows || ' rows)'
                        WHEN s.open_if = 'rows' THEN ' (' || v_rows || ' rows changed)' ELSE '' END;
    END IF;
    report := report || s.n || ' ' || s.label || ': ' || v_line || ' || ';
    IF v_got <> s.expected AND v_got <> 'n/a' THEN
      v_fail := v_fail || CASE WHEN v_fail = '' THEN '' ELSE ',' END || s.n;
    END IF;
  END LOOP;

  -- ── Part 2: the catalog ─────────────────────────────────────────────────────────────────────────────────────────
  -- A. Write grants guests hold (lists stop after 15 names).
  WITH g AS (
    SELECT c.relname, string_agg(p.priv, ',' ORDER BY p.ord) AS privs
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) WITH ORDINALITY AS p(priv, ord)
    WHERE ns.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND CASE WHEN p.priv IN ('INSERT', 'UPDATE') THEN has_any_column_privilege('anon', c.oid, p.priv)
               ELSE has_table_privilege('anon', c.oid, p.priv) END
    GROUP BY c.relname
  )
  SELECT array_to_string((array_agg(relname || '(' || privs || ')' ORDER BY relname))[1:15], ', ')
         || CASE WHEN count(*) > 15 THEN ' ... and ' || (count(*) - 15) || ' more' ELSE '' END
    INTO v_list
  FROM g
  WHERE NOT (relname IN ('guest_attempts', 'guest_visitors') AND privs = 'INSERT');
  IF v_list IS NULL THEN
    report := report || 'A guest write grants: only guest_attempts(INSERT), guest_visitors(INSERT) or less';
  ELSE
    v_fail := v_fail || CASE WHEN v_fail = '' THEN '' ELSE ',' END || 'A';
    report := report || 'A guest write grants: FAIL, beyond the guest page: ' || v_list;
  END IF;
  IF to_regclass('public.guest_attempts') IS NOT NULL AND to_regclass('public.guest_visitors') IS NOT NULL
     AND NOT (has_table_privilege('anon', 'public.guest_attempts', 'INSERT')
              AND has_table_privilege('anon', 'public.guest_visitors', 'INSERT')) THEN
    v_warn := v_warn || 'the guest page cannot save (a guest INSERT grant is missing); ';
  END IF;
  report := report || ' || ';

  -- B. RLS off and readable by guests.
  SELECT array_to_string((array_agg(c.relname::text ORDER BY c.relname))[1:15], ', ')
         || CASE WHEN count(*) > 15 THEN ' ... and ' || (count(*) - 15) || ' more' ELSE '' END
    INTO v_list
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
    AND has_any_column_privilege('anon', c.oid, 'SELECT');
  report := report || 'B RLS off + guest reads: ' || COALESCE(v_list, 'none');
  IF v_list IS NOT NULL THEN
    v_fail := v_fail || CASE WHEN v_fail = '' THEN '' ELSE ',' END || 'B';
    report := report || ' (FAIL)';
  END IF;
  report := report || ' || ';

  -- C. Views and materialized views guests can read that run as their owner.
  SELECT array_to_string((array_agg(c.relname || CASE c.relkind WHEN 'm' THEN ' (materialized)' ELSE '' END
                                    ORDER BY c.relname))[1:15], ', ')
         || CASE WHEN count(*) > 15 THEN ' ... and ' || (count(*) - 15) || ' more' ELSE '' END
    INTO v_list
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relkind IN ('v', 'm')
    AND has_any_column_privilege('anon', c.oid, 'SELECT')
    AND NOT (c.relkind = 'v' AND EXISTS (SELECT 1 FROM pg_options_to_table(c.reloptions) o
                                          WHERE o.option_name = 'security_invoker' AND o.option_value IN ('true', 'on', '1')));
  report := report || 'C owner-run views guests read: ' || COALESCE(v_list, 'none');
  IF v_list IS NOT NULL THEN
    v_fail := v_fail || CASE WHEN v_fail = '' THEN '' ELSE ',' END || 'C';
    report := report || ' (FAIL)';
  END IF;
  report := report || ' || ';

  -- D. SECURITY DEFINER functions guests can call, sorted into kinds.
  WITH f AS (
    SELECT p.proname,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig,
           CASE
             WHEN p.proname = 'login_email_for_username' THEN 'login'
             WHEN EXISTS (SELECT 1 FROM pg_policies pol
                          WHERE (COALESCE(pol.qual, '') || ' ' || COALESCE(pol.with_check, '')) ~ ('\m' || p.proname || '\s*\('))
               THEN 'policy helper'
             WHEN p.prosrc ~ 'require_acting_for' THEN 'checks caller'
             ELSE 'other'
           END AS kind
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
      AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  )
  SELECT 'login ' || count(*) FILTER (WHERE kind = 'login')
         || ', policy helpers ' || count(*) FILTER (WHERE kind = 'policy helper')
         || COALESCE(' (' || string_agg(DISTINCT proname, ', ') FILTER (WHERE kind = 'policy helper') || ')', '')
         || ', check the caller ' || count(*) FILTER (WHERE kind = 'checks caller')
         || ', other ' || count(*) FILTER (WHERE kind = 'other'),
         array_to_string((array_agg(sig ORDER BY sig) FILTER (WHERE kind = 'other'))[1:15], ', ')
         || CASE WHEN count(*) FILTER (WHERE kind = 'other') > 15
                 THEN ' ... and ' || (count(*) FILTER (WHERE kind = 'other') - 15) || ' more' ELSE '' END
    INTO v_line, v_list
  FROM f;
  report := report || 'D definer functions guests can call: ' || v_line;
  IF v_list IS NOT NULL THEN
    v_fail := v_fail || CASE WHEN v_fail = '' THEN '' ELSE ',' END || 'D';
    report := report || ' (FAIL, other: ' || v_list || ')';
  END IF;
  report := report || ' || ';

  -- E. Rows a guest sees in each table it may read (counted up to 100000).
  FOR t IN
    SELECT c.oid, c.relname,
           EXISTS (SELECT 1 FROM pg_attribute a
                   WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attname = ANY (people_cols)) AS people
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND has_any_column_privilege('anon', c.oid, 'SELECT')
    ORDER BY c.relname
  LOOP
    v_rows := NULL; v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', 'anon', true);
      SET LOCAL ROLE anon;
      EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM %s LIMIT 100001) s', t.oid::regclass) INTO v_rows;
      RAISE EXCEPTION 'rk03-undo';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'rk03-undo' THEN
        v_err := SQLSTATE || ' ' || left(SQLERRM, 50);
      END IF;
    END;
    IF v_rows > 0 THEN
      EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM %s LIMIT 100001) s', t.oid::regclass) INTO v_total;
      v_line := t.relname || '=' || CASE WHEN v_rows > 100000 THEN '>100000' ELSE v_rows::text END
                || '/' || CASE WHEN v_total > 100000 THEN '>100000' ELSE v_total::text END;
      e_seen := e_seen || CASE WHEN e_seen = '' THEN '' ELSE ', ' END || v_line;
      IF t.people AND t.relname <> 'guest_attempts' THEN
        e_people := e_people || CASE WHEN e_people = '' THEN '' ELSE ', ' END || t.relname;
      ELSIF NOT (t.relname = ANY (guest_tables)) THEN
        e_other := e_other || CASE WHEN e_other = '' THEN '' ELSE ', ' END || t.relname;
      END IF;
    ELSIF v_err IS NOT NULL AND v_err NOT LIKE '42501%' THEN
      e_error := e_error || CASE WHEN e_error = '' THEN '' ELSE ', ' END || t.relname || ' (' || v_err || ')';
    END IF;
  END LOOP;
  report := report || 'E guest sees rows (seen/total): ' || CASE WHEN e_seen = '' THEN 'none' ELSE e_seen END;
  IF e_people <> '' THEN
    v_fail := v_fail || CASE WHEN v_fail = '' THEN '' ELSE ',' END || 'E';
    report := report || ' (FAIL, people data: ' || e_people || ')';
  END IF;
  IF e_other <> '' THEN
    v_warn := v_warn || 'guests read tables outside the guest pages: ' || e_other || '; ';
  END IF;
  IF e_error <> '' THEN
    v_warn := v_warn || 'a guest read failed with an error: ' || e_error || '; ';
  END IF;
  report := report || ' || ';

  -- The invite codes for the register page sit in site_settings, which guests read.
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
    EXECUTE 'SELECT count(*) FROM public.site_settings WHERE setting_key = ''register_invite_codes''' INTO v_rows;
    RAISE EXCEPTION 'rk03-undo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rk03-undo' THEN v_rows := 0; END IF;
  END;
  IF v_rows > 0 THEN
    v_warn := v_warn || 'guests read register_invite_codes in site_settings (matters only if sign-up is on, RK-05); ';
  END IF;

  -- F. What new objects made in the SQL editor give guests. Made and undone inside this step.
  BEGIN
    CREATE TABLE public.rk03_probe_t (id integer);
    CREATE VIEW public.rk03_probe_v AS SELECT 1 AS x;
    CREATE FUNCTION public.rk03_probe_f() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1';
    f_tab_read := has_table_privilege('anon', 'public.rk03_probe_t', 'SELECT');
    f_tab_write := concat_ws(',',
      CASE WHEN has_table_privilege('anon', 'public.rk03_probe_t', 'INSERT') THEN 'INSERT' END,
      CASE WHEN has_table_privilege('anon', 'public.rk03_probe_t', 'UPDATE') THEN 'UPDATE' END,
      CASE WHEN has_table_privilege('anon', 'public.rk03_probe_t', 'DELETE') THEN 'DELETE' END,
      CASE WHEN has_table_privilege('anon', 'public.rk03_probe_t', 'TRUNCATE') THEN 'TRUNCATE' END);
    f_view_read := has_table_privilege('anon', 'public.rk03_probe_v', 'SELECT');
    f_fn := has_function_privilege('anon', 'public.rk03_probe_f()', 'EXECUTE');
    RAISE EXCEPTION 'rk03-undo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rk03-undo' THEN f_err := SQLSTATE || ' ' || left(SQLERRM, 60); END IF;
  END;
  IF f_err IS NOT NULL THEN
    report := report || 'F new objects: could not test (' || f_err || ')';
  ELSE
    report := report || 'F new table: guest reads=' || CASE WHEN f_tab_read THEN 'yes' ELSE 'no' END
              || ', guest writes=' || CASE WHEN f_tab_write = '' THEN 'none' ELSE f_tab_write END
              || '; new view: guest reads=' || CASE WHEN f_view_read THEN 'yes' ELSE 'no' END
              || '; new definer function: guest calls=' || CASE WHEN f_fn THEN 'yes' ELSE 'no' END;
    IF f_tab_write <> '' THEN
      v_fail := v_fail || CASE WHEN v_fail = '' THEN '' ELSE ',' END || 'F';
      report := report || ' (FAIL)';
    END IF;
    IF f_tab_read OR f_view_read OR f_fn THEN
      v_warn := v_warn || 'new objects are open to guests by default (' || concat_ws(', ',
                  CASE WHEN f_tab_read THEN 'table read' END,
                  CASE WHEN f_view_read THEN 'view read, runs as owner' END,
                  CASE WHEN f_fn THEN 'definer function call' END)
                || '): each new SQL file must revoke from anon itself; ';
    END IF;
  END IF;
  RESET ROLE;

  report := report || ' || WARN: ' || CASE WHEN v_warn = '' THEN 'none' ELSE rtrim(v_warn, '; ') END
            || ' || verdict=' || CASE WHEN v_fail = '' THEN 'PASS' ELSE 'FAIL (' || v_fail || ')' END;
  RAISE EXCEPTION 'RK-03 CHECK (nothing was saved): %', report;
END;
$$;
