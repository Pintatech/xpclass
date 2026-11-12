-- Undo of lock_notification_access.sql: the two old read policies come back exactly as they were on 2026-11-12, and
-- the update guard goes. Then again: anyone (guests too) reads every shared announcement and every competition winner
-- row, and a student can change any column of their own notifications from F12.
-- Safe to run twice. The last result: one row, the three columns true, true, false.

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TRIGGER IF EXISTS trg_guard_notification_row ON public.notifications;
DROP FUNCTION IF EXISTS public.guard_notification_row();

DROP POLICY IF EXISTS "rls notifications: read own" ON public.notifications;
DROP POLICY IF EXISTS "rls notifications: read competition winners" ON public.notifications;

-- As listed by pg_policies on the live database before the lock (2026-11-12).
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT TO public
  USING ((user_id = auth.uid()) OR (user_id IS NULL));

DROP POLICY IF EXISTS "Allow all users to read competition winner notifications" ON public.notifications;
CREATE POLICY "Allow all users to read competition winner notifications" ON public.notifications
  FOR SELECT TO public
  USING (type = 'competition_winner'::text);

DELETE FROM public.security_lock_policies WHERE table_name = 'notifications' AND dropped_by = 'lock_notification_access';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: old_read_policies_back = true, new_policies_gone = true, guard_left = false.
SELECT (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'notifications'
          AND policyname IN ('Users can read own notifications',
                             'Allow all users to read competition winner notifications')) = 2 AS old_read_policies_back,
       NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'notifications'
                     AND policyname LIKE 'rls notifications: %') AS new_policies_gone,
       EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname = 'trg_guard_notification_row'
                 AND tgrelid = 'public.notifications'::regclass) AS guard_left;
