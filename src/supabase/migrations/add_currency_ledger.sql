-- Step 5b of the lock: a log of every change to a user's XP and gems.
--
-- Why: rewards are worked out in the browser, so a student can raise their own XP and gems (from F12, or by calling
-- a reward function with made-up input). Nothing records how a balance got to where it is, so cheating cannot be
-- seen afterwards, and there is no data to set daily limits from (step 5d).
--
-- After this file, every UPDATE of users.xp or users.gems adds one row to public.currency_ledger:
--   user_id, xp_change, gems_change, xp_after, gems_after;
--   source  where the change came from. For a request from the app this is the API path PostgREST saw:
--           "/rpc/open_chest", "/rpc/increment_user_currency"... for a reward function, "/users" for a direct write to
--           the users row from the browser, "/user_progress" for a trigger on another table. Empty means the server
--           itself: the SQL editor, pg_cron;
--   actor   auth.uid() of the caller (the student, the teacher who gave the reward, or empty for the server);
--   actor_role  the API role: authenticated, service_role (Vercel cron, Edge Functions) or empty;
--   blocked, attempted_xp, attempted_gems  used from step 5c on, for writes that were refused.
-- Only the SQL editor and the service role can read it (no policy for anyone else). Read it with
-- src/supabase/checks/currency_report.sql.
-- If writing the log row ever fails, the XP change itself still goes through (the trigger only warns), so the log
-- cannot break the app. Changes of other columns (avatar, energy, last_seen_at...) are not logged.
--
-- Safe to run twice. Undo: remove_currency_ledger.sql (it stops the logging and keeps the rows already logged).
-- The last result: one row, ledger_exists = true, trigger_enabled = true, students_can_read = false.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.currency_ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  xp_change integer NOT NULL DEFAULT 0,
  gems_change integer NOT NULL DEFAULT 0,
  xp_after integer,
  gems_after integer,
  source text,
  actor uuid,
  actor_role text,
  blocked boolean NOT NULL DEFAULT false,
  attempted_xp integer,
  attempted_gems integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS currency_ledger_user_time_idx ON public.currency_ledger (user_id, created_at);
CREATE INDEX IF NOT EXISTS currency_ledger_time_idx ON public.currency_ledger (created_at);
ALTER TABLE public.currency_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.currency_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.currency_ledger_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.currency_ledger TO service_role;

-- Where the current request came from: the PostgREST path ("/rpc/<function>", "/<table>"), or NULL for the server.
CREATE OR REPLACE FUNCTION public.currency_ledger_source()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.path', true), '')
$$;

CREATE OR REPLACE FUNCTION public.log_currency_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.currency_ledger (user_id, xp_change, gems_change, xp_after, gems_after, source, actor, actor_role)
    VALUES (NEW.id,
            COALESCE(NEW.xp, 0) - COALESCE(OLD.xp, 0),
            COALESCE(NEW.gems, 0) - COALESCE(OLD.gems, 0),
            NEW.xp, NEW.gems,
            public.currency_ledger_source(),
            auth.uid(),
            NULLIF(auth.jwt() ->> 'role', ''));
  EXCEPTION WHEN OTHERS THEN
    -- Never let the log stop the XP change itself.
    RAISE WARNING 'currency_ledger: could not log the change for %: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_currency_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_currency_change ON public.users;
CREATE TRIGGER trg_log_currency_change
  AFTER UPDATE OF xp, gems ON public.users
  FOR EACH ROW
  WHEN (OLD.xp IS DISTINCT FROM NEW.xp OR OLD.gems IS DISTINCT FROM NEW.gems)
  EXECUTE FUNCTION public.log_currency_change();

COMMIT;

-- Check. Expected: ledger_exists = true, trigger_enabled = true, students_can_read = false, guests_can_read = false.
SELECT to_regclass('public.currency_ledger') IS NOT NULL AS ledger_exists,
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_log_currency_change'
                 AND tgrelid = 'public.users'::regclass AND tgenabled <> 'D') AS trigger_enabled,
       has_table_privilege('authenticated', 'public.currency_ledger', 'SELECT') AS students_can_read,
       has_table_privilege('anon', 'public.currency_ledger', 'SELECT') AS guests_can_read,
       (SELECT count(*) FROM public.currency_ledger) AS rows_so_far;
