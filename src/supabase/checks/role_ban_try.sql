-- XPclass check RK-01 (2026-11-16): can a student make themselves admin, or lift their own ban?
-- NOTHING IS SAVED: every step is undone right after it runs, and the last line stops with an error that undoes
-- everything this block did.
-- Run it in the Supabase SQL editor. The result is an error that starts with "RK-01 CHECK": that error text is the
-- report. Copy it and send it.
--
-- It picks a student who is not banned (or the account in target_email below), signs in as that student the way the
-- app does (PostgREST: role authenticated + the JWT claims), and sends the UPDATEs anyone can send from F12 with
-- supabase.from('users').update({...}).eq('id', <own id>):
--   1 own avatar_url, as the profile page does: must be rows=1, or steps 2-3 prove nothing;
--   2 role = 'admin': must be BLOCKED 42501 "Only an admin can change roles or bans";
--   3 is_banned = false while the account is banned (it is banned first, inside the step): must be BLOCKED.
-- A step that is NOT blocked also reports what it gave: is_admin_user() and whether another student's row can then
-- be updated.
DO $$
DECLARE
  target_email text := '';  -- optional: put the e-mail of the account to test with between the quotes
  v_uid uuid;
  v_other uuid;
  v_role text;
  v_rows integer;
  v_text text;
  report text;
BEGIN
  -- If the users row is busy for more than 5 seconds, stop instead of making the app wait.
  SET LOCAL lock_timeout = '5s';

  IF target_email <> '' THEN
    SELECT u.id, u.role INTO v_uid, v_role FROM public.users u WHERE lower(u.email) = lower(target_email);
  ELSE
    SELECT u.id, u.role INTO v_uid, v_role
    FROM public.users u
    WHERE u.role = 'user' AND NOT COALESCE(u.is_banned, false)
    ORDER BY u.last_activity_date DESC NULLS LAST, u.id
    LIMIT 1;
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'RK-01 CHECK: no account found (check target_email)';
  END IF;
  SELECT u.id INTO v_other FROM public.users u WHERE u.role = 'user' AND u.id <> v_uid ORDER BY u.id LIMIT 1;

  report := 'account role=' || COALESCE(v_role, '?')
            || ' | guard trigger=' || CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                                                         WHERE tgrelid = 'public.users'::regclass
                                                           AND tgname = 'trg_guard_user_row' AND tgenabled <> 'D')
                                           THEN 'on' ELSE 'MISSING' END
            || ' | users RLS=' || (SELECT c.relrowsecurity::text FROM pg_class c WHERE c.oid = 'public.users'::regclass);

  -- Sign in as the student, as PostgREST does for each request from the app.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  -- 1. Control: the student's own row, as the profile page does (the value stays the same).
  BEGIN
    UPDATE public.users SET avatar_url = avatar_url WHERE id = v_uid;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    report := report || ' || 1 own avatar: rows=' || v_rows
              || CASE WHEN v_rows = 1 THEN ' (ok)' ELSE ' (expected 1: steps 2-3 prove nothing)' END;
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || 1 own avatar ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;

  -- 2. role = 'admin' on the student's own row. The 'rk01-undo' error undoes the step.
  v_rows := 0;
  v_text := '';
  BEGIN
    UPDATE public.users SET role = 'admin' WHERE id = v_uid;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      BEGIN
        v_text := ', is_admin_user()=' || public.is_admin_user()::text;
        IF v_other IS NOT NULL THEN
          UPDATE public.users SET full_name = full_name WHERE id = v_other;
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          v_text := v_text || ', another student''s row now updatable: rows=' || v_rows;
          v_rows := 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_text := v_text || ', ERROR after it ' || SQLSTATE || ': ' || SQLERRM;
        v_rows := 1;
      END;
    END IF;
    RAISE EXCEPTION 'rk01-undo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'rk01-undo' THEN
      report := report || ' || 2 role=admin: '
                || CASE WHEN v_rows > 0 THEN 'NOT BLOCKED, the student became admin' ELSE 'no row changed' END
                || v_text;
    ELSE
      report := report || ' || 2 role=admin: BLOCKED ' || SQLSTATE || ': ' || SQLERRM;
    END IF;
  END;

  -- 3. Lift the student's own ban. The account is banned first, by the SQL editor's role, inside this step only.
  v_rows := 0;
  BEGIN
    RESET ROLE;
    UPDATE public.users SET is_banned = true WHERE id = v_uid;
    SET LOCAL ROLE authenticated;
    UPDATE public.users SET is_banned = false WHERE id = v_uid;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE EXCEPTION 'rk01-undo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'rk01-undo' THEN
      report := report || ' || 3 lift own ban: '
                || CASE WHEN v_rows > 0 THEN 'NOT BLOCKED, the ban was lifted' ELSE 'no row changed' END;
    ELSE
      report := report || ' || 3 lift own ban: BLOCKED ' || SQLSTATE || ': ' || SQLERRM;
    END IF;
  END;
  RESET ROLE;

  -- Read without RLS: what the row holds now (the steps were undone, so it must be what it was).
  SELECT ' || stored now: role=' || COALESCE(u.role, 'null') || ' banned=' || COALESCE(u.is_banned::text, 'null')
    INTO v_text
  FROM public.users u WHERE u.id = v_uid;
  report := report || v_text;

  RAISE EXCEPTION 'RK-01 CHECK (nothing was saved): %', report;
END;
$$;
