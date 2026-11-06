-- Undo add_user_row_guard.sql.
DROP TRIGGER IF EXISTS trg_guard_user_row ON public.users;
DROP FUNCTION IF EXISTS public.guard_user_row();
