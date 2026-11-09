-- XPclass pet check, part 2 (2026-11-07). NOTHING IS SAVED: the last line always stops with an error, and that error
-- undoes everything this block did.
-- Run it in the Supabase SQL editor. The result is an error that starts with "PET CHECK": that error text is the
-- report. Copy it and send it.
--
-- It picks a student who has 2 or more pets (or the account in target_email below), signs in as that student the way
-- the app does, and then does what the pet page does:
--   1 Set Active on one of the student's pets that is not active (set_active_pet);
--   2 reads the active pet the way the dashboard does (get_active_pet);
--   3 renames that pet (the same UPDATE the rename box sends);
--   4 saves its place in the pet home (the same UPDATE Place Pets > Save sends);
--   5 tries to raise its level by 100, as someone could from F12 (after add_own_pet_updates.sql it must be kept);
--   6 reads the pet list the way the pet page does;
--   7 reads another student's pets the way a profile page and PvP do (after add_pet_reads.sql: seen N of N).
-- "active before/after" and "stored" are read without RLS, so they show what is really saved.
DO $$
DECLARE
  target_email text := '';  -- optional: put the e-mail of the account you tested with between the quotes
  v_uid uuid;
  v_role text;
  v_pet uuid;
  v_text text;
  v_json jsonb;
  v_rows integer;
  v_level integer;
  v_other uuid;
  v_other_pets integer;
  report text;
BEGIN
  -- If a pet row is busy for more than 5 seconds, stop instead of making the app wait.
  SET LOCAL lock_timeout = '5s';

  IF target_email <> '' THEN
    SELECT u.id, u.role INTO v_uid, v_role FROM public.users u WHERE lower(u.email) = lower(target_email);
  ELSE
    SELECT u.id, u.role INTO v_uid, v_role
    FROM public.users u
    JOIN public.user_pets up ON up.user_id = u.id
    WHERE u.role = 'user'
    GROUP BY u.id, u.role
    HAVING count(*) >= 2
    ORDER BY max(up.obtained_at) DESC
    LIMIT 1;
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PET CHECK: no account found (check target_email)';
  END IF;

  -- The pet to activate and rename: a pet that is not active, else the newest one.
  SELECT up.id INTO v_pet
  FROM public.user_pets up
  WHERE up.user_id = v_uid
  ORDER BY COALESCE(up.is_active, false), up.obtained_at DESC
  LIMIT 1;

  SELECT up.level INTO v_level FROM public.user_pets up WHERE up.id = v_pet;
  -- Another student, with the most pets, for step 7.
  SELECT up.user_id, count(*) INTO v_other, v_other_pets
  FROM public.user_pets up
  JOIN public.users u ON u.id = up.user_id
  WHERE up.user_id <> v_uid AND u.role = 'user'
  GROUP BY up.user_id
  ORDER BY count(*) DESC, up.user_id
  LIMIT 1;
  SELECT string_agg(up.id::text, ',') INTO v_text FROM public.user_pets up WHERE up.user_id = v_uid AND up.is_active;
  report := 'account role=' || COALESCE(v_role, '?')
            || ' | pets=' || (SELECT count(*) FROM public.user_pets up WHERE up.user_id = v_uid)
            || ' | active before=' || COALESCE(v_text, 'none')
            || ' | pet tried=' || COALESCE(v_pet::text, 'none');

  -- Sign in as the student, as PostgREST does for each request from the app.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- 1. Set Active
  SET LOCAL ROLE authenticated;
  BEGIN
    v_text := public.set_active_pet(v_uid, v_pet)::text;
    report := report || ' || 1 set_active_pet returned: ' || COALESCE(v_text, 'null');
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || 1 set_active_pet ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;
  RESET ROLE;
  SELECT string_agg(up.id::text, ',') INTO v_text FROM public.user_pets up WHERE up.user_id = v_uid AND up.is_active;
  report := report || ' | active after=' || COALESCE(v_text, 'none');

  -- 2. Dashboard
  SET LOCAL ROLE authenticated;
  BEGIN
    v_json := public.get_active_pet(v_uid)::jsonb;
    report := report || ' || 2 get_active_pet: '
              || CASE WHEN v_json -> 'pet' ->> 'id' IS NOT NULL
                      THEN 'pet ' || (v_json -> 'pet' ->> 'id') || ' (the pet tried: ' || ((v_json -> 'pet' ->> 'id') = v_pet::text) || ')'
                      ELSE COALESCE(v_json::text, 'null') END;
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || 2 get_active_pet ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;

  -- 3. Rename
  BEGIN
    UPDATE public.user_pets SET nickname = 'pet check' WHERE id = v_pet;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    report := report || ' || 3 rename: rows changed=' || v_rows;
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || 3 rename ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;

  -- 4. Pet home
  BEGIN
    UPDATE public.user_pets SET habitat_x = 42, habitat_y = 58, habitat_flip = true WHERE id = v_pet;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    report := report || ' || 4 pet home: rows changed=' || v_rows;
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || 4 pet home ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;

  -- 5. Level change from F12
  BEGIN
    UPDATE public.user_pets SET level = COALESCE(level, 1) + 100 WHERE id = v_pet;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    report := report || ' || 5 level try: rows=' || v_rows;
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || 5 level try ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;

  -- 6. Pet list
  BEGIN
    SELECT count(*) || ' rows seen, ' || count(p.id) || ' with species'
      INTO v_text
    FROM public.user_pets up
    LEFT JOIN public.pets p ON p.id = up.pet_id
    WHERE up.user_id = v_uid;
    report := report || ' || 6 pet list: ' || v_text;
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || 6 pet list ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;

  -- 7. Another student's pets
  BEGIN
    SELECT count(*) INTO v_rows FROM public.user_pets up WHERE up.user_id = v_other;
    report := report || ' || 7 another student''s pets: seen ' || v_rows || ' of ' || COALESCE(v_other_pets, 0);
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || 7 another student''s pets ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;
  RESET ROLE;

  SELECT 'nickname=' || COALESCE(up.nickname, 'null')
         || ' home=' || COALESCE(up.habitat_x::text, 'null') || '/' || COALESCE(up.habitat_y::text, 'null')
         || ' level kept=' || (up.level IS NOT DISTINCT FROM v_level)
    INTO v_text
  FROM public.user_pets up
  WHERE up.id = v_pet;
  report := report || ' || stored for the pet tried: ' || v_text;

  RAISE EXCEPTION 'PET CHECK (nothing was saved): %', report;
END;
$$;
