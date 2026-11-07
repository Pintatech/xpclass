-- URGENT. Turn row level security on for public.users.
--
-- Found 2026-11-07 with src/supabase/checks/security_check.sql: RLS is OFF on users, and anon and authenticated
-- hold every table privilege on it (Supabase's default grants). The policies on users exist but do nothing while
-- RLS is off. trg_guard_user_row (add_user_row_guard.sql) covers INSERT and UPDATE only, so anyone holding the
-- public anon key can DELETE any or every row of users, and the delete cascades into the tables that reference it.
--
-- After this file:
--   - RLS is on, so the policies already on users apply: anon may read (needed by the username login until
--     hide_users_from_anon.sql), a signed-in user may read every profile, and may insert and update only their own
--     row;
--   - an admin may update and delete any row (User Management); a teacher may update any row (Class War rewards).
--     trg_guard_user_row still decides which columns a non-admin may change;
--   - anon can no longer insert, update or delete, and nobody can TRUNCATE through the API;
--   - login_email_for_username() is added for the username login, so the users table can later stop being
--     readable without a login (see hide_users_from_anon.sql).
-- Server code is unaffected: SECURITY DEFINER functions, the service role key, Supabase Auth and the SQL editor.
-- Safe to run twice. Undo: unlock_users_table.sql.

BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- is_admin_user() / is_teacher_user() are SECURITY DEFINER (add_exercise_folder_access.sql), so these policies can
-- read users.role without recursing into the policies of users.
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
CREATE POLICY "Admins can update any user" ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Teachers can update users" ON public.users;
CREATE POLICY "Teachers can update users" ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_teacher_user())
  WITH CHECK (public.is_teacher_user());

DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- anon keeps SELECT only (the login lookup). TRUNCATE ignores RLS, so take it away from both browser roles.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.users FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.users FROM authenticated;

-- Username -> email for the login form, one row at a time, instead of reading the users table.
CREATE OR REPLACE FUNCTION public.login_email_for_username(p_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.users
  WHERE lower(username) = lower(btrim(p_username))
  ORDER BY created_at
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.login_email_for_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_email_for_username(text) TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
