-- Undo lock_users_table.sql: back to RLS off on users and Supabase's default grants.
-- WARNING: this reopens the hole that file closed (anyone with the anon key can delete users). Use it only to get
-- the app working again while a fix is found, then run lock_users_table.sql again.
-- If hide_users_from_anon.sql was run, run show_users_to_anon.sql first, or the username login breaks.

BEGIN;

DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Teachers can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.users TO anon, authenticated;

-- login_email_for_username() is left in place: the login page falls back to reading users when it is missing,
-- and it does no harm when it is there.

COMMIT;

NOTIFY pgrst, 'reload schema';
