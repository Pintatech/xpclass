-- Undo add_clear_competition_scores_rpc.sql. End & Award then falls back to deleting from the browser, which RLS
-- blocks, and it says so instead of claiming the scores were cleared.
DROP FUNCTION IF EXISTS public.clear_competition_scores(text);

NOTIFY pgrst, 'reload schema';
