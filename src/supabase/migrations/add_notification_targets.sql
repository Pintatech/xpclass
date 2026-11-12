-- Announcements for chosen people (2026-11-12, branch NotificationFix, step 1 of 4).
--
-- Before: an admin announcement went to everyone or to one cohort. Now an admin picks one of:
--   all       the whole site: every student and teacher
--   teachers  every teacher
--   students  every student
--   courses   one or more classes (courses): their active students (course_enrollments) and their teachers
--             (courses.teacher_id and course_teachers)
--   users     one or more people picked by hand
-- Rules agreed with the owner:
--   - only admins send, and admins never receive announcements;
--   - who receives it is fixed when it is sent. Someone who joins a class later, or whose account is made later, does
--     not see it. For all/teachers/students that means: accounts made before the announcement was sent.
--
-- How it is stored:
--   - all/teachers/students: one shared row (user_id NULL), target_type says who. Read marks go to notification_reads
--     as before.
--   - courses/users: one row per receiver (user_id set), all with the same batch_id, so the list is fixed at sending.
--     Read marks use is_read on the row, as for other personal notifications.
--   - Old shared rows become target_type 'all' or 'cohort' (the cohort rule keeps working for them). Every shared row
--     gets batch_id = id, so the admin history can treat every send the same way.
--   - Personal notifications from the app (achievements, gifts, competitions, missions) keep target_type NULL and are
--     not part of the admin history.
--
-- Functions (all check the caller themselves):
--   send_announcement(...)        admin only; p_dry_run => true only counts the receivers
--   get_my_notifications()        the signed-in user's list; replaces get_notifications(p_user_id) in step 2
--   mark_notifications_read(ids)  marks notifications read for the signed-in user
--   get_announcement_history()    admin only; one row per send with receivers and reads
--   delete_announcement(batch)    admin only; removes the whole send
-- get_notifications(p_user_id) is not changed, so the app that is live keeps working until step 2 is deployed.
-- A trigger keeps students from setting target_type or batch_id on their own rows (F12), and fills both for shared
-- rows the old admin page still inserts.
--
-- Safe to run twice. Undo: remove_notification_targets.sql.
-- The last result: every row ok = true.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

-- 1. Columns.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS batch_id uuid;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_target_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_target_type_check CHECK (
  target_type IS NULL
  OR (user_id IS NULL AND target_type IN ('all', 'teachers', 'students', 'cohort'))
  OR (user_id IS NOT NULL AND target_type IN ('courses', 'users'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_batch ON public.notifications(batch_id) WHERE batch_id IS NOT NULL;

-- 2. Old shared rows.
UPDATE public.notifications
SET target_type = COALESCE(target_type, CASE WHEN cohort_id IS NULL THEN 'all' ELSE 'cohort' END),
    batch_id = COALESCE(batch_id, id)
WHERE user_id IS NULL AND (target_type IS NULL OR batch_id IS NULL);

-- 3. Trigger: students cannot set the two new columns; shared rows always get both.
CREATE OR REPLACE FUNCTION public.normalize_notification_target()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- SECURITY INVOKER on purpose: current_user is 'authenticated' or 'anon' for a request from the app, and the function
  -- owner inside a SECURITY DEFINER function such as send_announcement.
  IF current_user IN ('anon', 'authenticated') AND NOT public.is_admin_user() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.target_type := NULL;
      NEW.batch_id := NULL;
    ELSE
      NEW.target_type := OLD.target_type;
      NEW.batch_id := OLD.batch_id;
    END IF;
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.target_type := COALESCE(NEW.target_type, CASE WHEN NEW.cohort_id IS NULL THEN 'all' ELSE 'cohort' END);
    NEW.batch_id := COALESCE(NEW.batch_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_notification_target() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_normalize_notification_target ON public.notifications;
CREATE TRIGGER trg_normalize_notification_target
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_notification_target();

-- 4. Who a shared row reaches. The one place this rule lives: get_my_notifications, send_announcement and the history
-- all use it. A missing role counts as a student; a missing account date counts as an old account.
CREATE OR REPLACE FUNCTION public.notification_reaches(
  p_target_type text,
  p_cohort_id uuid,
  p_sent_at timestamptz,
  p_user_id uuid,
  p_user_role text,
  p_user_created_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_user_role, 'user') <> 'admin'
     AND COALESCE(p_user_created_at, '-infinity'::timestamptz) <= p_sent_at
     AND CASE p_target_type
           WHEN 'all' THEN true
           WHEN 'teachers' THEN COALESCE(p_user_role, 'user') = 'teacher'
           WHEN 'students' THEN COALESCE(p_user_role, 'user') = 'user'
           WHEN 'cohort' THEN EXISTS (SELECT 1 FROM public.cohort_members cm
                                      WHERE cm.cohort_id = p_cohort_id AND cm.student_id = p_user_id
                                        AND cm.is_active = true)
           ELSE false
         END;
$$;

REVOKE ALL ON FUNCTION public.notification_reaches(text, uuid, timestamptz, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;

-- 5. Send (admins only). Returns {"batch_id": ..., "recipients": N}. With p_dry_run => true it only counts.
CREATE OR REPLACE FUNCTION public.send_announcement(
  p_title text,
  p_message text,
  p_target text,
  p_course_ids uuid[] DEFAULT NULL,
  p_user_ids uuid[] DEFAULT NULL,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text := btrim(COALESCE(p_title, ''));
  v_message text := btrim(COALESCE(p_message, ''));
  v_now timestamptz := now();
  v_batch uuid := gen_random_uuid();
  v_ids uuid[];
  v_courses uuid[];
  v_titles text[];
  v_count integer;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Chỉ admin mới gửi được thông báo' USING ERRCODE = '42501';
  END IF;
  IF p_target IS NULL OR p_target NOT IN ('all', 'teachers', 'students', 'courses', 'users') THEN
    RAISE EXCEPTION 'Đối tượng nhận không hợp lệ: %', COALESCE(p_target, 'null') USING ERRCODE = '22023';
  END IF;
  IF NOT p_dry_run THEN
    IF v_title = '' OR v_message = '' THEN
      RAISE EXCEPTION 'Cần nhập tiêu đề và nội dung' USING ERRCODE = '22023';
    END IF;
    IF length(v_title) > 200 OR length(v_message) > 5000 THEN
      RAISE EXCEPTION 'Tiêu đề tối đa 200 ký tự, nội dung tối đa 5000 ký tự' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_target IN ('all', 'teachers', 'students') THEN
    SELECT count(*) INTO v_count
    FROM public.users u
    WHERE public.notification_reaches(p_target, NULL, v_now, u.id, u.role, u.created_at);
  ELSE
    IF p_target = 'courses' THEN
      SELECT array_agg(c.id ORDER BY c.title, c.id), array_agg(c.title ORDER BY c.title, c.id)
        INTO v_courses, v_titles
      FROM public.courses c
      WHERE c.id = ANY (COALESCE(p_course_ids, '{}'));
      IF v_courses IS NULL THEN
        RAISE EXCEPTION 'Hãy chọn ít nhất một lớp' USING ERRCODE = '22023';
      END IF;
      SELECT array_agg(DISTINCT r.uid) INTO v_ids
      FROM (
        SELECT ce.student_id AS uid FROM public.course_enrollments ce
        WHERE ce.course_id = ANY (v_courses) AND ce.is_active = true
        UNION
        SELECT c.teacher_id FROM public.courses c WHERE c.id = ANY (v_courses)
        UNION
        SELECT ct.teacher_id FROM public.course_teachers ct WHERE ct.course_id = ANY (v_courses)
      ) r
      JOIN public.users u ON u.id = r.uid
      WHERE COALESCE(u.role, 'user') <> 'admin';
    ELSE
      SELECT array_agg(DISTINCT u.id) INTO v_ids
      FROM public.users u
      WHERE u.id = ANY (COALESCE(p_user_ids, '{}')) AND COALESCE(u.role, 'user') <> 'admin';
    END IF;
    v_count := COALESCE(cardinality(v_ids), 0);
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object('batch_id', NULL, 'recipients', v_count);
  END IF;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Không có ai để gửi' USING ERRCODE = '22023';
  END IF;

  IF p_target IN ('all', 'teachers', 'students') THEN
    INSERT INTO public.notifications (user_id, type, title, message, icon, data, target_type, batch_id, created_at)
    VALUES (NULL, 'admin_announcement', v_title, v_message, 'Megaphone', '{}'::jsonb, p_target, v_batch, v_now);
  ELSE
    INSERT INTO public.notifications (user_id, type, title, message, icon, data, target_type, batch_id, created_at)
    SELECT r.uid, 'admin_announcement', v_title, v_message, 'Megaphone',
           CASE WHEN p_target = 'courses'
                THEN jsonb_build_object('course_ids', to_jsonb(v_courses), 'course_titles', to_jsonb(v_titles))
                ELSE '{}'::jsonb END,
           p_target, v_batch, v_now
    FROM unnest(v_ids) AS r(uid);
  END IF;

  RETURN jsonb_build_object('batch_id', v_batch, 'recipients', v_count);
END;
$$;

-- 6. The signed-in user's notifications. Same columns as get_notifications, so the app reads it the same way.
CREATE OR REPLACE FUNCTION public.get_my_notifications()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  type text,
  title text,
  message text,
  icon text,
  data jsonb,
  is_read boolean,
  cohort_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT u.id, u.role, u.created_at FROM public.users u WHERE u.id = auth.uid()
  ),
  own AS (
    SELECT n.id, n.user_id, n.type, n.title, n.message, n.icon, n.data, COALESCE(n.is_read, false) AS is_read,
           n.cohort_id, n.created_at
    FROM public.notifications n
    WHERE n.user_id = (SELECT me.id FROM me)
      AND n.type <> 'mission_reward'
    ORDER BY n.created_at DESC
    LIMIT 50
  ),
  shared AS (
    SELECT n.id, n.user_id, n.type, n.title, n.message, n.icon, n.data,
           EXISTS (SELECT 1 FROM public.notification_reads r
                   WHERE r.notification_id = n.id AND r.user_id = me.id) AS is_read,
           n.cohort_id, n.created_at
    FROM public.notifications n
    CROSS JOIN me
    WHERE n.user_id IS NULL
      AND n.type <> 'mission_reward'
      AND public.notification_reaches(n.target_type, n.cohort_id, n.created_at, me.id, me.role, me.created_at)
    ORDER BY n.created_at DESC
    LIMIT 40
  )
  SELECT c.* FROM (SELECT * FROM own UNION ALL SELECT * FROM shared) c
  ORDER BY c.created_at DESC
  LIMIT 50;
$$;

-- 7. Mark as read for the signed-in user: their own rows by is_read, shared rows through notification_reads.
-- Returns how many marks were added.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_own integer;
  v_shared integer;
BEGIN
  IF v_uid IS NULL OR p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN 0;
  END IF;
  IF cardinality(p_ids) > 200 THEN
    RAISE EXCEPTION 'Tối đa 200 thông báo mỗi lần' USING ERRCODE = '22023';
  END IF;

  UPDATE public.notifications n
  SET is_read = true
  WHERE n.id = ANY (p_ids) AND n.user_id = v_uid AND n.is_read IS DISTINCT FROM true;
  GET DIAGNOSTICS v_own = ROW_COUNT;

  INSERT INTO public.notification_reads (notification_id, user_id)
  SELECT n.id, v_uid
  FROM public.notifications n
  JOIN public.users u ON u.id = v_uid
  WHERE n.id = ANY (p_ids)
    AND n.user_id IS NULL
    AND public.notification_reaches(n.target_type, n.cohort_id, n.created_at, u.id, u.role, u.created_at)
    AND NOT EXISTS (SELECT 1 FROM public.notification_reads r WHERE r.notification_id = n.id AND r.user_id = v_uid)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_shared = ROW_COUNT;

  RETURN v_own + v_shared;
END;
$$;

-- 8. Admin history: one row per send, newest first.
CREATE OR REPLACE FUNCTION public.get_announcement_history(p_limit integer DEFAULT 50)
RETURNS TABLE (
  batch_id uuid,
  title text,
  message text,
  target_type text,
  target_names text[],
  recipient_count integer,
  read_count integer,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Chỉ admin mới xem được lịch sử thông báo' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH shared AS (
    SELECT n.batch_id, n.title, n.message, n.target_type,
           CASE WHEN n.target_type = 'cohort' THEN ARRAY[COALESCE(co.name, '?')] ELSE ARRAY[]::text[] END AS target_names,
           (SELECT count(*) FROM public.users u
            WHERE public.notification_reaches(n.target_type, n.cohort_id, n.created_at, u.id, u.role, u.created_at)
           )::integer AS recipient_count,
           (SELECT count(*) FROM public.notification_reads r
            JOIN public.users u ON u.id = r.user_id
            WHERE r.notification_id = n.id
              AND public.notification_reaches(n.target_type, n.cohort_id, n.created_at, u.id, u.role, u.created_at)
           )::integer AS read_count,
           n.created_at
    FROM public.notifications n
    LEFT JOIN public.cohorts co ON co.id = n.cohort_id
    WHERE n.user_id IS NULL AND n.type = 'admin_announcement' AND n.batch_id IS NOT NULL
  ),
  grouped AS (
    -- Every row of one send has the same title, message, target and data; take them from any row.
    SELECT n.batch_id,
           (array_agg(n.title ORDER BY n.id))[1] AS title,
           (array_agg(n.message ORDER BY n.id))[1] AS message,
           (array_agg(n.target_type ORDER BY n.id))[1] AS target_type,
           (array_agg(n.data ORDER BY n.id))[1] AS data,
           array_agg(COALESCE(NULLIF(u.full_name, ''), u.username, u.email, '?')
                     ORDER BY COALESCE(NULLIF(u.full_name, ''), u.username, u.email, '?')) AS people,
           count(*)::integer AS recipient_count,
           (count(*) FILTER (WHERE n.is_read))::integer AS read_count,
           min(n.created_at) AS created_at
    FROM public.notifications n
    LEFT JOIN public.users u ON u.id = n.user_id
    WHERE n.user_id IS NOT NULL AND n.type = 'admin_announcement' AND n.batch_id IS NOT NULL
      AND n.target_type IN ('courses', 'users')
    GROUP BY n.batch_id
  ),
  batches AS (
    SELECT g.batch_id, g.title, g.message, g.target_type,
           CASE WHEN g.target_type = 'courses'
                THEN ARRAY(SELECT jsonb_array_elements_text(g.data -> 'course_titles'))
                ELSE g.people END AS target_names,
           g.recipient_count, g.read_count, g.created_at
    FROM grouped g
  )
  SELECT h.batch_id, h.title, h.message, h.target_type, h.target_names, h.recipient_count, h.read_count, h.created_at
  FROM (SELECT * FROM shared UNION ALL SELECT * FROM batches) h
  ORDER BY h.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
END;
$$;

-- 9. Delete a whole send (admins only). Read marks go with it (ON DELETE CASCADE). Returns the rows removed.
CREATE OR REPLACE FUNCTION public.delete_announcement(p_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Chỉ admin mới xoá được thông báo' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.notifications n
  WHERE n.batch_id = p_batch_id AND n.type = 'admin_announcement' AND n.target_type IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 10. Who may call what. New functions in public get EXECUTE for anon by default in Supabase, so take it away.
REVOKE ALL ON FUNCTION public.send_announcement(text, text, text, uuid[], uuid[], boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_notifications() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_announcement_history(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_announcement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_announcement(text, text, text, uuid[], uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_announcement_history(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_announcement(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: ok = true on every row.
SELECT 'columns target_type and batch_id' AS item,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notifications'
          AND column_name IN ('target_type', 'batch_id')) = 2 AS ok
UNION ALL
SELECT 'every shared row has a target and a batch',
       NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id IS NULL AND (target_type IS NULL OR batch_id IS NULL))
UNION ALL
SELECT 'trigger trg_normalize_notification_target on',
       EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname = 'trg_normalize_notification_target'
                 AND tgrelid = 'public.notifications'::regclass AND tgenabled <> 'D')
UNION ALL
SELECT 'signed-in users can call the 5 functions',
       has_function_privilege('authenticated', 'public.send_announcement(text, text, text, uuid[], uuid[], boolean)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.get_my_notifications()', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.mark_notifications_read(uuid[])', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.get_announcement_history(integer)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.delete_announcement(uuid)', 'EXECUTE')
UNION ALL
SELECT 'guests cannot call them',
       NOT has_function_privilege('anon', 'public.send_announcement(text, text, text, uuid[], uuid[], boolean)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.get_my_notifications()', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.mark_notifications_read(uuid[])', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.get_announcement_history(integer)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.delete_announcement(uuid)', 'EXECUTE')
UNION ALL
SELECT 'nobody calls the helper notification_reaches directly',
       NOT has_function_privilege('authenticated', 'public.notification_reaches(text, uuid, timestamptz, uuid, text, timestamptz)', 'EXECUTE')
UNION ALL
SELECT 'old get_notifications still there (the live app uses it until step 2)',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
               WHERE ns.nspname = 'public' AND p.proname = 'get_notifications');
