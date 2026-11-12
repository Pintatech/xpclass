-- XPclass notification check (2026-11-12, step 4 of the notification work). NOTHING IS SAVED: the last line always
-- stops with an error, and that error undoes everything this block did.
-- Run it in the Supabase SQL editor (after migrations/add_notification_targets.sql). The result is an error that starts
-- with "NOTIFICATION CHECK": that error text is the report. Every item says ok, FAIL or skip. Copy it and send it.
--
-- It picks real accounts by itself (or uses the class named in target_course below):
--   admin                 the oldest admin. Sends the test announcements, and must receive none of them.
--   student in class      an active student of the class
--   teacher of class      a teacher of the class (courses.teacher_id or course_teachers)
--   student outside       a student with no enrollment in the class. The admin picks them by hand, and they join the
--                         class right after the send: they must still not get the class announcement.
--   teacher outside       a teacher who does not teach the class (skipped if there is none)
--   new account           another student whose account counts as made after the send
-- Then, signed in as each of them the way the app does:
--   1 the admin sends 5 test announcements: whole site, teachers, students, the class, the student outside;
--     each one's receivers must match the count shown before sending;
--   2 each account reads its list (get_my_notifications) and must see exactly the ones meant for it;
--   3 the student in class marks them read; the admin history shows the right receivers and reads;
--   4 a student and a teacher try to send, read the history and delete: all refused;
--   5 a student tries to fake a history row from F12: the target and the batch are cleared;
--   6 the admin deletes the class announcement: the student in class no longer sees it;
--   7 the student reads the notifications table directly (F12): must not see teachers-only announcements or other
--     people's personal notifications;
--   8 the student turns their own notification into a "competition winner" from F12: only is_read may change;
--   9 a guest (no account) reads the notifications table: must see nothing.
-- Items 7-9 pass after migrations/lock_notification_access.sql.
DO $$
DECLARE
  target_course text := '';  -- optional: put a class title between the quotes to test that class
  marker constant text := 'NOTIF CHECK ';
  targets constant text[] := ARRAY['all', 'teachers', 'students', 'courses', 'users'];
  v_admin uuid;
  v_course uuid;
  v_course_title text;
  v_s_in uuid;
  v_t_in uuid;
  v_s_out uuid;
  v_t_out uuid;
  v_late uuid;
  v_sent jsonb := '{}'::jsonb;
  v_dry integer;
  v_target text;
  v_res jsonb;
  v_got text[];
  v_want text[];
  v_ids uuid[];
  v_n integer;
  v_text text;
  v_ok boolean;
  acct record;
  h record;
  report text := '';
  n_fail integer;
  n_ok integer;
BEGIN
  -- If a row is busy for more than 5 seconds, stop instead of making the app wait.
  SET LOCAL lock_timeout = '5s';

  -- 0. Accounts.
  SELECT u.id INTO v_admin FROM public.users u WHERE u.role = 'admin' ORDER BY u.created_at NULLS FIRST, u.id LIMIT 1;

  SELECT c.id, c.title INTO v_course, v_course_title
  FROM public.courses c
  WHERE (target_course = '' OR lower(c.title) = lower(target_course))
    AND EXISTS (SELECT 1 FROM public.course_enrollments ce JOIN public.users u ON u.id = ce.student_id
                WHERE ce.course_id = c.id AND ce.is_active = true AND COALESCE(u.role, 'user') = 'user')
  ORDER BY EXISTS (SELECT 1 FROM public.users u
                   WHERE u.role = 'teacher'
                     AND (u.id = c.teacher_id
                          OR u.id IN (SELECT ct.teacher_id FROM public.course_teachers ct WHERE ct.course_id = c.id))) DESC,
           c.is_active DESC NULLS LAST, c.title
  LIMIT 1;

  SELECT u.id INTO v_s_in
  FROM public.course_enrollments ce JOIN public.users u ON u.id = ce.student_id
  WHERE ce.course_id = v_course AND ce.is_active = true AND COALESCE(u.role, 'user') = 'user'
  ORDER BY u.created_at NULLS FIRST, u.id
  LIMIT 1;

  SELECT u.id INTO v_t_in
  FROM public.users u
  WHERE u.role = 'teacher'
    AND (u.id = (SELECT c.teacher_id FROM public.courses c WHERE c.id = v_course)
         OR u.id IN (SELECT ct.teacher_id FROM public.course_teachers ct WHERE ct.course_id = v_course))
  ORDER BY u.id
  LIMIT 1;

  SELECT u.id INTO v_s_out
  FROM public.users u
  WHERE COALESCE(u.role, 'user') = 'user'
    AND NOT EXISTS (SELECT 1 FROM public.course_enrollments ce WHERE ce.course_id = v_course AND ce.student_id = u.id)
  ORDER BY u.created_at NULLS FIRST, u.id
  LIMIT 1;

  SELECT u.id INTO v_t_out
  FROM public.users u
  WHERE u.role = 'teacher'
    AND u.id IS DISTINCT FROM (SELECT c.teacher_id FROM public.courses c WHERE c.id = v_course)
    AND NOT EXISTS (SELECT 1 FROM public.course_teachers ct WHERE ct.course_id = v_course AND ct.teacher_id = u.id)
  ORDER BY u.id
  LIMIT 1;

  SELECT u.id INTO v_late
  FROM public.users u
  WHERE COALESCE(u.role, 'user') = 'user' AND u.id IS DISTINCT FROM v_s_out
    AND NOT EXISTS (SELECT 1 FROM public.course_enrollments ce WHERE ce.course_id = v_course AND ce.student_id = u.id)
  ORDER BY u.created_at DESC NULLS LAST, u.id
  LIMIT 1;

  IF v_admin IS NULL OR v_course IS NULL OR v_s_in IS NULL OR v_s_out IS NULL OR v_late IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION CHECK: could not find the accounts (admin %, class %, student in class %, student outside %, another student %). Check target_course.',
      v_admin IS NOT NULL, v_course IS NOT NULL, v_s_in IS NOT NULL, v_s_out IS NOT NULL, v_late IS NOT NULL;
  END IF;

  SELECT 'class "' || v_course_title || '" | admin=' || COALESCE((SELECT COALESCE(u.full_name, u.username, u.email) FROM public.users u WHERE u.id = v_admin), '?')
         || ', student in class=' || COALESCE((SELECT COALESCE(u.full_name, u.username, u.email) FROM public.users u WHERE u.id = v_s_in), '?')
         || ', teacher of class=' || COALESCE((SELECT COALESCE(u.full_name, u.username, u.email) FROM public.users u WHERE u.id = v_t_in), 'none')
         || ', student outside=' || COALESCE((SELECT COALESCE(u.full_name, u.username, u.email) FROM public.users u WHERE u.id = v_s_out), '?')
         || ', teacher outside=' || COALESCE((SELECT COALESCE(u.full_name, u.username, u.email) FROM public.users u WHERE u.id = v_t_out), 'none')
         || ', new account=' || COALESCE((SELECT COALESCE(u.full_name, u.username, u.email) FROM public.users u WHERE u.id = v_late), '?')
    INTO v_text;
  report := v_text;

  -- The "new account": its account date moves to just after the send (undone at the end like everything else).
  BEGIN
    UPDATE public.users SET created_at = now() + interval '1 minute' WHERE id = v_late;
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || FAIL could not set up the new account: ' || SQLSTATE || ' ' || SQLERRM;
  END;

  -- 1. The admin sends. First the count the admin page shows, then the real send.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  FOREACH v_target IN ARRAY targets LOOP
    BEGIN
      v_res := public.send_announcement(marker || v_target, 'Kiểm tra, không lưu lại', v_target,
                                        CASE WHEN v_target = 'courses' THEN ARRAY[v_course] END,
                                        CASE WHEN v_target = 'users' THEN ARRAY[v_s_out] END, true);
      v_dry := (v_res ->> 'recipients')::integer;
      v_res := public.send_announcement(marker || v_target, 'Kiểm tra, không lưu lại', v_target,
                                        CASE WHEN v_target = 'courses' THEN ARRAY[v_course] END,
                                        CASE WHEN v_target = 'users' THEN ARRAY[v_s_out] END, false);
      v_sent := v_sent || jsonb_build_object(v_target, v_res);
      v_ok := (v_res ->> 'recipients')::integer = v_dry AND v_dry > 0 AND (v_target <> 'users' OR v_dry = 1);
      report := report || ' || ' || CASE WHEN v_ok THEN 'ok' ELSE 'FAIL' END
                || ' 1 send ' || v_target || ': ' || (v_res ->> 'recipients') || ' receivers (count before sending ' || v_dry || ')';
    EXCEPTION WHEN OTHERS THEN
      report := report || ' || FAIL 1 send ' || v_target || ' ERROR ' || SQLSTATE || ': ' || SQLERRM;
    END;
  END LOOP;
  RESET ROLE;

  -- The student outside joins the class after the send.
  BEGIN
    INSERT INTO public.course_enrollments (course_id, student_id, is_active) VALUES (v_course, v_s_out, true);
    report := report || ' || ok student outside joined the class after the send';
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || skip student outside could not join the class (' || SQLERRM || ')';
  END;

  -- 2. Each account reads its list.
  FOR acct IN
    SELECT * FROM (VALUES
      ('student in class', v_s_in, ARRAY['all', 'courses', 'students']),
      ('teacher of class', v_t_in, ARRAY['all', 'courses', 'teachers']),
      ('student outside', v_s_out, ARRAY['all', 'students', 'users']),
      ('teacher outside', v_t_out, ARRAY['all', 'teachers']),
      ('new account', v_late, ARRAY[]::text[]),
      ('admin', v_admin, ARRAY[]::text[])
    ) AS a(label, uid, expected)
  LOOP
    IF acct.uid IS NULL THEN
      report := report || ' || skip 2 ' || acct.label || ': no such account';
      CONTINUE;
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', acct.uid, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', acct.uid::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      SELECT array_agg(s.t ORDER BY s.t) INTO v_got
      FROM (SELECT substr(n.title, length(marker) + 1) AS t
            FROM public.get_my_notifications() n WHERE n.title LIKE marker || '%') s;
      SELECT array_agg(x ORDER BY x) INTO v_want FROM unnest(acct.expected) x;
      v_ok := COALESCE(v_got, '{}') = COALESCE(v_want, '{}');
      report := report || ' || ' || CASE WHEN v_ok THEN 'ok' ELSE 'FAIL' END || ' 2 ' || acct.label
                || ' sees [' || array_to_string(COALESCE(v_got, '{}'), ',') || ']'
                || CASE WHEN v_ok THEN '' ELSE ' should see [' || array_to_string(COALESCE(v_want, '{}'), ',') || ']' END;
    EXCEPTION WHEN OTHERS THEN
      report := report || ' || FAIL 2 ' || acct.label || ' ERROR ' || SQLSTATE || ': ' || SQLERRM;
    END;
    RESET ROLE;
  END LOOP;

  -- 3. The student in class marks them read; the admin history.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_s_in, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_s_in::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT array_agg(n.id) INTO v_ids FROM public.get_my_notifications() n WHERE n.title LIKE marker || '%' AND NOT n.is_read;
    v_n := public.mark_notifications_read(v_ids);
    SELECT count(*) INTO v_dry FROM public.get_my_notifications() n WHERE n.title LIKE marker || '%' AND NOT n.is_read;
    v_ok := v_n = COALESCE(cardinality(v_ids), 0) AND v_n = 3 AND v_dry = 0;
    report := report || ' || ' || CASE WHEN v_ok THEN 'ok' ELSE 'FAIL' END
              || ' 3 student in class marked ' || v_n || ' of ' || COALESCE(cardinality(v_ids), 0) || ' read, unread after: ' || v_dry;
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || FAIL 3 mark read ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    v_n := 0;
    FOR h IN SELECT * FROM public.get_announcement_history(200) x WHERE x.title LIKE marker || '%' LOOP
      v_n := v_n + 1;
      v_target := substr(h.title, length(marker) + 1);
      v_ok := h.recipient_count = (v_sent -> v_target ->> 'recipients')::integer
              AND h.read_count = CASE WHEN v_target IN ('all', 'students', 'courses') THEN 1 ELSE 0 END
              AND h.target_type = v_target
              AND (v_target <> 'courses' OR h.target_names = ARRAY[v_course_title]);
      report := report || ' || ' || CASE WHEN v_ok THEN 'ok' ELSE 'FAIL' END || ' 3 history ' || v_target
                || ': read ' || h.read_count || '/' || h.recipient_count
                || CASE WHEN cardinality(h.target_names) > 0 THEN ' [' || array_to_string(h.target_names, ', ') || ']' ELSE '' END;
    END LOOP;
    report := report || ' || ' || CASE WHEN v_n = 5 THEN 'ok' ELSE 'FAIL' END || ' 3 history has ' || v_n || ' of 5 test sends';
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || FAIL 3 history ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;
  RESET ROLE;

  -- 4. Refused for a student and a teacher.
  FOR acct IN
    SELECT * FROM (VALUES ('student', v_s_in), ('teacher', v_t_in)) AS a(label, uid)
  LOOP
    IF acct.uid IS NULL THEN
      report := report || ' || skip 4 ' || acct.label || ': no such account';
      CONTINUE;
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', acct.uid, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', acct.uid::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.send_announcement('x', 'y', 'all');
      report := report || ' || FAIL 4 ' || acct.label || ' COULD SEND';
    EXCEPTION WHEN insufficient_privilege THEN
      report := report || ' || ok 4 ' || acct.label || ' cannot send';
    WHEN OTHERS THEN
      report := report || ' || FAIL 4 ' || acct.label || ' send ERROR ' || SQLSTATE || ': ' || SQLERRM;
    END;
    BEGIN
      PERFORM * FROM public.get_announcement_history(5);
      report := report || ' || FAIL 4 ' || acct.label || ' COULD READ THE HISTORY';
    EXCEPTION WHEN insufficient_privilege THEN
      report := report || ' || ok 4 ' || acct.label || ' cannot read the history';
    WHEN OTHERS THEN
      report := report || ' || FAIL 4 ' || acct.label || ' history ERROR ' || SQLSTATE || ': ' || SQLERRM;
    END;
    BEGIN
      PERFORM public.delete_announcement((v_sent -> 'all' ->> 'batch_id')::uuid);
      report := report || ' || FAIL 4 ' || acct.label || ' COULD DELETE';
    EXCEPTION WHEN insufficient_privilege THEN
      report := report || ' || ok 4 ' || acct.label || ' cannot delete';
    WHEN OTHERS THEN
      report := report || ' || FAIL 4 ' || acct.label || ' delete ERROR ' || SQLSTATE || ': ' || SQLERRM;
    END;
    RESET ROLE;
  END LOOP;

  -- 5. A fake history row from F12.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_s_in, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_s_in::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    -- admin_announcement: a type the live type check accepts (achievement_earned was refused there on 2026-11-12).
    INSERT INTO public.notifications (user_id, type, title, message, target_type, batch_id)
    VALUES (v_s_in, 'admin_announcement', marker || 'fake', 'x', 'users', (v_sent -> 'courses' ->> 'batch_id')::uuid);
    v_text := 'inserted';
  EXCEPTION WHEN OTHERS THEN
    v_text := 'refused (' || SQLERRM || ')';
  END;
  RESET ROLE;
  SELECT count(*) FILTER (WHERE n.target_type IS NOT NULL OR n.batch_id IS NOT NULL) INTO v_n
  FROM public.notifications n WHERE n.user_id = v_s_in AND n.title = marker || 'fake';
  report := report || ' || ' || CASE WHEN v_n = 0 THEN 'ok' ELSE 'FAIL' END
            || ' 5 fake history row from F12: ' || v_text || ', rows that kept a target or batch: ' || v_n;

  -- 6. The admin deletes the class announcement.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    v_n := public.delete_announcement((v_sent -> 'courses' ->> 'batch_id')::uuid);
    report := report || ' || ' || CASE WHEN v_n = (v_sent -> 'courses' ->> 'recipients')::integer THEN 'ok' ELSE 'FAIL' END
              || ' 6 admin deleted the class send: ' || v_n || ' rows';
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || FAIL 6 delete ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_s_in, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_s_in::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT count(*) INTO v_n FROM public.get_my_notifications() n WHERE n.title = marker || 'courses';
    report := report || ' || ' || CASE WHEN v_n = 0 THEN 'ok' ELSE 'FAIL' END || ' 6 student in class no longer sees it';
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || FAIL 6 ERROR ' || SQLSTATE || ': ' || SQLERRM;
  END;
  RESET ROLE;

  -- 7. F12: the student reads the notifications table directly, not through get_my_notifications. Rows the student
  -- should never see: the teachers-only test announcement, and other people's personal notifications (competition
  -- winners excepted: the dashboard shows those to everyone).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_s_in, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_s_in::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT count(*) FILTER (WHERE n.user_id IS NULL AND n.target_type IN ('teachers')),
           count(*) FILTER (WHERE n.user_id IS NOT NULL AND n.user_id <> v_s_in AND n.type <> 'competition_winner')
      INTO v_n, v_dry
    FROM public.notifications n;
    report := report || ' || ' || CASE WHEN v_n = 0 AND v_dry = 0 THEN 'ok' ELSE 'FAIL' END
              || ' 7 F12 direct read by a student: teachers-only announcements seen ' || v_n
              || ', other people''s personal notifications seen ' || v_dry;
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || ok 7 F12 direct read by a student refused (' || SQLSTATE || ')';
  END;

  -- 8. F12: the student rewrites their own row from item 5 as a competition winner, and marks it read.
  IF EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = v_s_in AND n.title = marker || 'fake') THEN
    BEGIN
      UPDATE public.notifications
      SET type = 'competition_winner', title = marker || 'champion', is_read = true
      WHERE user_id = v_s_in AND title = marker || 'fake';
      v_text := 'update sent';
    EXCEPTION WHEN OTHERS THEN
      v_text := 'update refused (' || SQLERRM || ')';
    END;
    RESET ROLE;
    SELECT count(*) FILTER (WHERE n.type = 'competition_winner' OR n.title <> marker || 'fake'),
           count(*) FILTER (WHERE n.is_read)
      INTO v_n, v_dry
    FROM public.notifications n
    WHERE n.user_id = v_s_in AND n.title IN (marker || 'fake', marker || 'champion');
    report := report || ' || ' || CASE WHEN v_n = 0 THEN 'ok' ELSE 'FAIL' END
              || ' 8 F12 student makes own notification a competition winner: ' || v_text
              || ', rows changed into a winner: ' || v_n || ', marked read: ' || v_dry;
  ELSE
    RESET ROLE;
    report := report || ' || skip 8 no own test row to change (item 5 was refused)';
  END IF;

  -- 9. A guest reads the table.
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO v_n FROM public.notifications n;
    report := report || ' || ' || CASE WHEN v_n = 0 THEN 'ok' ELSE 'FAIL' END || ' 9 guest reads notifications: ' || v_n || ' rows';
  EXCEPTION WHEN OTHERS THEN
    report := report || ' || ok 9 guest read refused (' || SQLSTATE || ')';
  END;
  RESET ROLE;

  -- The real data, read without signing in.
  SELECT count(*) INTO v_n FROM public.notifications n
  WHERE n.user_id IS NULL AND (n.target_type IS NULL OR n.batch_id IS NULL);
  report := report || ' || ' || CASE WHEN v_n = 0 THEN 'ok' ELSE 'FAIL' END || ' every shared announcement has a target and a batch';
  SELECT string_agg(x.target_type || '=' || x.n, ', ' ORDER BY x.target_type) INTO v_text
  FROM (SELECT n.target_type, count(DISTINCT n.batch_id) AS n FROM public.notifications n
        WHERE n.type = 'admin_announcement' AND n.target_type IS NOT NULL AND n.title NOT LIKE marker || '%'
        GROUP BY n.target_type) x;
  report := report || ' || info announcements kept so far: ' || COALESCE(v_text, 'none');

  n_fail := (length(report) - length(replace(report, '|| FAIL', ''))) / length('|| FAIL');
  n_ok := (length(report) - length(replace(report, '|| ok', ''))) / length('|| ok');
  RAISE EXCEPTION 'NOTIFICATION CHECK (nothing was saved): % ok, % FAIL | %', n_ok, n_fail, report;
END;
$$;
