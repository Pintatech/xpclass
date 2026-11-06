-- Undo add_training_records.sql: stops tracking records and deletes them.
-- Pet Dash's ready screen then falls back to this week's numbers again.
DROP TRIGGER IF EXISTS trg_track_training_record ON public.training_scores;
DROP FUNCTION IF EXISTS public.track_training_record();
DROP TABLE IF EXISTS public.training_records;

NOTIFY pgrst, 'reload schema';
