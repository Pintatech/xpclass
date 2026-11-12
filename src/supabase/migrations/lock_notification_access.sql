-- Who may read and change notifications directly (2026-11-12, branch NotificationFix, after step 4).
--
-- Found with checks/notification_try.sql and pg_policies on the live database (2026-11-12):
--   - "Users can read own notifications" (SELECT, to public) is user_id = auth.uid() OR user_id IS NULL. Every
--     shared announcement is readable by anyone, so a student reads teachers-only announcements from F12
--     (supabase.from('notifications').select('*')). The app itself never reads shared rows directly: it uses
--     get_my_notifications, which checks who each announcement is for.
--   - Both read policies are "to public", so guests without an account read the table too: the anon key read 823
--     competition_winner rows. No guest page shows notifications.
--   - "Users can update own notifications" (UPDATE) has no column limit. A student can turn their own notification
--     into type competition_winner with any title, and the dashboard's "recent activities" shows it to everyone as a
--     champion. The app only ever changes is_read.
--
-- After this file:
--   - a signed-in user reads directly: their own notifications, and competition_winner rows (RecentActivities shows
--     those to everyone); admins read everything through "Admins can manage all notifications", which stays;
--   - guests read nothing;
--   - a student's direct update of their own notification changes only is_read; every other column keeps its stored
--     value (no error). Server functions, the SQL editor and admins are not limited.
-- Nothing else changes: inserting own notifications, the admin policy, notification_reads.
--
-- Safe to run twice. Undo: unlock_notification_access.sql (puts the two old read policies back exactly).
-- The last result: every row ok = true. Then run checks/notification_try.sql again: items 7, 8 and 9 should be ok.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

-- 1. Keep a copy of the read policies that go (the same record table the earlier lock files use).
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

INSERT INTO public.security_lock_policies (table_name, policy_name, permissive, roles, cmd, qual, with_check, dropped_by)
SELECT p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check, 'lock_notification_access'
FROM pg_policies p
WHERE p.schemaname = 'public' AND p.tablename = 'notifications'
  AND p.policyname IN ('Users can read own notifications', 'Allow all users to read competition winner notifications')
ON CONFLICT DO NOTHING;

-- 2. Read: own rows and competition winners, signed-in users only.
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow all users to read competition winner notifications" ON public.notifications;
DROP POLICY IF EXISTS "rls notifications: read own" ON public.notifications;
DROP POLICY IF EXISTS "rls notifications: read competition winners" ON public.notifications;

CREATE POLICY "rls notifications: read own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "rls notifications: read competition winners" ON public.notifications
  FOR SELECT TO authenticated
  USING (type = 'competition_winner');

-- 3. Update: a student changes only is_read on their own rows ("Users can update own notifications" still picks the
-- rows; this picks the columns).
CREATE OR REPLACE FUNCTION public.guard_notification_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_read boolean;
BEGIN
  -- SECURITY INVOKER on purpose, as guard_user_row on users: current_user is 'authenticated' or 'anon' for a request
  -- from the app, and the function owner inside a SECURITY DEFINER function such as mark_notifications_read.
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin_user() THEN
    RETURN NEW;
  END IF;
  v_read := NEW.is_read;
  NEW := OLD;
  NEW.is_read := v_read;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_notification_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_notification_row ON public.notifications;
CREATE TRIGGER trg_guard_notification_row
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_notification_row();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: ok = true on every row.
SELECT 'old read policies gone' AS item,
       NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'notifications'
                     AND policyname IN ('Users can read own notifications',
                                        'Allow all users to read competition winner notifications')) AS ok
UNION ALL
SELECT 'old read policies kept in security_lock_policies',
       (SELECT count(*) FROM public.security_lock_policies
        WHERE table_name = 'notifications' AND dropped_by = 'lock_notification_access') = 2
UNION ALL
SELECT 'new read policies: own, competition winners (signed-in only)',
       (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'notifications' AND cmd = 'SELECT'
          AND roles = '{authenticated}'
          AND policyname IN ('rls notifications: read own', 'rls notifications: read competition winners')) = 2
UNION ALL
SELECT 'no read policy left for guests',
       NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'notifications' AND cmd IN ('SELECT', 'ALL')
                     AND ('public' = ANY (roles) OR 'anon' = ANY (roles))
                     AND policyname <> 'Admins can manage all notifications')
UNION ALL
SELECT 'update guard trg_guard_notification_row on',
       EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname = 'trg_guard_notification_row'
                 AND tgrelid = 'public.notifications'::regclass AND tgenabled <> 'D')
UNION ALL
SELECT 'signed-in users still hold SELECT and UPDATE on notifications',
       has_table_privilege('authenticated', 'public.notifications', 'SELECT')
       AND has_table_privilege('authenticated', 'public.notifications', 'UPDATE');
