-- Undo hide_users_from_anon.sql: anon may read the users table again (every column of every user).

DROP POLICY IF EXISTS "Allow username lookup for login" ON public.users;
CREATE POLICY "Allow username lookup for login" ON public.users
  FOR SELECT TO anon
  USING (true);

NOTIFY pgrst, 'reload schema';
