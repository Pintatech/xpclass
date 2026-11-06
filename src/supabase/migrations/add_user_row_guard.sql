-- Guard the users table against writes from the browser that only an admin should make.
--
-- The app updates a student's own users row from the browser (profile, avatar, energy, streak, rewards), so RLS
-- has to allow that. Without a guard on single columns the same request can also set role = 'admin' or clear
-- is_banned, and every admin check in the database trusts users.role. This trigger stops that for requests from
-- the app (PostgREST's anon and authenticated roles):
--   - only an admin can change role, is_banned or id (an error);
--   - a student can only update their own row (teachers may update students, as Class War rewards do). A
--     student's update of someone else's row is skipped without an error, as RLS would: get_active_pet runs with
--     the caller's rights and resets the energy of the pet it reads, which in PvP is the opponent's;
--   - a row created from the browser (sign-up) is always a plain student: role 'user', not banned, 0 XP and gems.
-- Server code is not checked: SECURITY DEFINER functions such as increment_user_currency, the service role key,
-- Supabase Auth, the SQL editor and the dashboard's table editor.
-- What the app does today keeps working; XP and gems on the student's own row are still writable (see
-- lock_currency_rpcs.sql). Safe to run twice. Undo: remove_user_row_guard.sql.

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

DROP TRIGGER IF EXISTS trg_guard_user_row ON public.users;
CREATE TRIGGER trg_guard_user_row
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_row();
