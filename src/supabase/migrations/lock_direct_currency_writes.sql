-- Step 5c of the lock: a student's browser can no longer write XP or gems straight into the users row.
--
-- Until now the guard on users (add_user_row_guard.sql) stopped role and ban changes only, so anyone could run
-- supabase.from('users').update({ xp: 999999 }) on their own row from F12. The app itself did that in two places,
-- which now call increment_user_currency instead (deploy that code BEFORE running this file):
--   - the lesson chest reward (src/components/study/ExerciseList.jsx),
--   - an achievement claim when no row existed yet (src/hooks/useAchievements.jsx);
--   (and the unused addXP of src/hooks/useProgressWithLevels.jsx).
--
-- After this file, for a write from the app (PostgREST roles anon and authenticated) to a users row:
--   - by a student: XP and gems keep their old value and the attempt is logged in currency_ledger with blocked = true
--     (attempted_xp / attempted_gems = what was asked for). The other columns of the same write (avatar, energy,
--     streak, level...) are saved as usual, so nothing in the app shows an error;
--   - by a teacher or an admin: saved as before (Class War rewards, admin gifts), and logged by the ledger as usual.
-- Unchanged: XP and gems still change through the SECURITY DEFINER functions (increment_user_currency, rewards,
-- chests...), the service role and the SQL editor; the rest of the guard (roles, bans, other people's rows, sign-up)
-- works as before.
-- Not fixed here: a student can still call increment_user_currency for themselves with any amount. That is step 5d,
-- once currency_ledger shows what normal days look like.
--
-- Run add_currency_ledger.sql first, so refused writes are logged (without it they are refused but not logged).
-- Safe to run twice. Undo: unlock_direct_currency_writes.sql (puts back the guard of add_user_row_guard.sql).
-- The last result: one row, guard_blocks_currency = true, guard_enabled = true, ledger_exists = true.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

-- Logs one refused write. The guard runs with the caller's rights, so students need EXECUTE on this; it only logs
-- while the guard has set xpclass.in_user_guard, which a request over the API cannot set, so calling it directly
-- does nothing.
CREATE OR REPLACE FUNCTION public.log_blocked_currency_write(
  p_user_id uuid, p_old_xp integer, p_old_gems integer, p_new_xp integer, p_new_gems integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('xpclass.in_user_guard', true) IS DISTINCT FROM 'on' OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN;
  END IF;
  BEGIN
    INSERT INTO public.currency_ledger (user_id, xp_change, gems_change, xp_after, gems_after, source, actor, actor_role,
                                        blocked, attempted_xp, attempted_gems)
    VALUES (p_user_id, 0, 0, p_old_xp, p_old_gems, NULLIF(current_setting('request.path', true), ''), auth.uid(),
            NULLIF(auth.jwt() ->> 'role', ''), true, p_new_xp, p_new_gems);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'currency_ledger: could not log a refused write for %: %', p_user_id, SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.log_blocked_currency_write(uuid, integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_blocked_currency_write(uuid, integer, integer, integer, integer) TO authenticated;

-- The guard of add_user_row_guard.sql, plus the XP/gems rule at the end.
CREATE OR REPLACE FUNCTION public.guard_user_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  -- SECURITY INVOKER on purpose: current_user is then the role running the statement, which is 'authenticated'
  -- or 'anon' for a request from the app, and the function owner inside a SECURITY DEFINER function.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    IF caller_role IS DISTINCT FROM 'admin' THEN
      NEW.role := 'user';
      NEW.is_banned := false;
      NEW.xp := 0;
      NEW.gems := 0;
    END IF;
    RETURN NEW;
  END IF;
  IF caller_role = 'admin' THEN
    RETURN NEW;
  END IF;
  IF OLD.id IS DISTINCT FROM auth.uid() AND caller_role IS DISTINCT FROM 'teacher' THEN
    RETURN NULL; -- leave someone else's row as it is
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_banned IS DISTINCT FROM OLD.is_banned OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only an admin can change roles or bans' USING ERRCODE = '42501';
  END IF;
  -- Students: XP and gems change only through the server functions. Keep the old values, log the attempt.
  IF caller_role IS DISTINCT FROM 'teacher'
     AND (NEW.xp IS DISTINCT FROM OLD.xp OR NEW.gems IS DISTINCT FROM OLD.gems) THEN
    PERFORM set_config('xpclass.in_user_guard', 'on', true);
    PERFORM public.log_blocked_currency_write(OLD.id, OLD.xp, OLD.gems, NEW.xp, NEW.gems);
    PERFORM set_config('xpclass.in_user_guard', '', true);
    NEW.xp := OLD.xp;
    NEW.gems := OLD.gems;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_user_row() FROM PUBLIC, anon, authenticated;

-- The trigger itself is the one add_user_row_guard.sql made; make sure it is there.
DROP TRIGGER IF EXISTS trg_guard_user_row ON public.users;
CREATE TRIGGER trg_guard_user_row
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_row();

DO $$
BEGIN
  IF to_regclass('public.currency_ledger') IS NULL THEN
    RAISE NOTICE 'currency_ledger does not exist yet: refused writes are not logged until add_currency_ledger.sql is run.';
  END IF;
END;
$$;

COMMIT;

-- Check. Expected: guard_blocks_currency = true, guard_enabled = true, ledger_exists = true.
SELECT position('xpclass.in_user_guard' IN pg_get_functiondef('public.guard_user_row()'::regprocedure)) > 0 AS guard_blocks_currency,
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guard_user_row' AND tgrelid = 'public.users'::regclass
                 AND tgenabled <> 'D') AS guard_enabled,
       to_regclass('public.currency_ledger') IS NOT NULL AS ledger_exists;
