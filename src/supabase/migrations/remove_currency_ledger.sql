-- Undo add_currency_ledger.sql: stop logging XP and gems changes. The rows already logged stay in
-- public.currency_ledger; to delete them too, run DROP TABLE public.currency_ledger; afterwards.
-- Run unlock_direct_currency_writes.sql first if step 5c is in place (it writes to this log). Safe to run twice.

BEGIN;

DROP TRIGGER IF EXISTS trg_log_currency_change ON public.users;
DROP FUNCTION IF EXISTS public.log_currency_change();

COMMIT;
