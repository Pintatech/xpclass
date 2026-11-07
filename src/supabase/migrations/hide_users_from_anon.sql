-- Stop the users table from being readable without a login.
--
-- Until now the policy "Allow username lookup for login" let anyone with the public anon key read every column of
-- every user (email, real name, role, XP...), because the login form looked up the email for a username itself.
-- The login form now calls login_email_for_username() (lock_users_table.sql) and gets one email back.
--
-- RUN ORDER: lock_users_table.sql first, then deploy the LoginPage change, then this file. Run before the deploy,
-- it breaks the username login for the old page.
--
-- Only the policy goes: anon keeps the SELECT grant and simply sees no rows. Revoking the grant would turn every
-- guest query whose RLS policy looks at users into a "permission denied" error.
-- Safe to run twice. Undo: show_users_to_anon.sql.

DROP POLICY IF EXISTS "Allow username lookup for login" ON public.users;

NOTIFY pgrst, 'reload schema';
