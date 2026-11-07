-- Undo lock_direct_currency_writes.sql: put back the users guard exactly as add_user_row_guard.sql made it (roles,
-- bans, other people's rows, sign-up), so a student's browser can write its own XP and gems again, and drop
-- log_blocked_currency_write(). Rows already logged stay in currency_ledger. Safe to run twice.
-- The code that now uses increment_user_currency keeps working after this undo.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

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
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_user_row() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.log_blocked_currency_write(uuid, integer, integer, integer, integer);

COMMIT;
