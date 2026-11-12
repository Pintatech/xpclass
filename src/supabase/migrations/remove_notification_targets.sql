-- Undo of add_notification_targets.sql: removes the 5 functions, the helper and the trigger.
-- Run it only together with the app code from before step 2 (it calls get_notifications, which stays untouched).
--
-- Kept, so nothing is lost: the columns target_type and batch_id with their values, and every notification row.
-- Watch out: the old get_notifications knows only "everyone" and "cohort". Announcements sent only to teachers or only
-- to students are shared rows too, so it would show them to everyone. The last result counts them; the commented
-- DELETE below removes them if you want that.
-- Safe to run twice. The last result: functions_left = 0, trigger_left = false.

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TRIGGER IF EXISTS trg_normalize_notification_target ON public.notifications;
DROP FUNCTION IF EXISTS public.normalize_notification_target();
DROP FUNCTION IF EXISTS public.send_announcement(text, text, text, uuid[], uuid[], boolean);
DROP FUNCTION IF EXISTS public.get_my_notifications();
DROP FUNCTION IF EXISTS public.mark_notifications_read(uuid[]);
DROP FUNCTION IF EXISTS public.get_announcement_history(integer);
DROP FUNCTION IF EXISTS public.delete_announcement(uuid);
DROP FUNCTION IF EXISTS public.notification_reaches(text, uuid, timestamptz, uuid, text, timestamptz);
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_target_type_check;
DROP INDEX IF EXISTS public.idx_notifications_batch;

-- Optional: remove the announcements that were only for teachers or only for students.
-- DELETE FROM public.notifications WHERE user_id IS NULL AND target_type IN ('teachers', 'students');

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: functions_left = 0, trigger_left = false.
SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
        WHERE ns.nspname = 'public'
          AND p.proname IN ('send_announcement', 'get_my_notifications', 'mark_notifications_read',
                            'get_announcement_history', 'delete_announcement', 'notification_reaches',
                            'normalize_notification_target')) AS functions_left,
       EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname = 'trg_normalize_notification_target'
                 AND tgrelid = 'public.notifications'::regclass) AS trigger_left,
       (SELECT count(*) FROM public.notifications
        WHERE user_id IS NULL AND target_type IN ('teachers', 'students')) AS teacher_or_student_only_announcements;
