-- All-time records for the pet training games: each player's best saved score per game.
--
-- training_scores cannot hold records: api/cron/cleanup-training-scores.js deletes rows older than 10 days
-- every day, and "End competition" in Leaderboard Settings deletes all rows of the competition's game.
-- This table keeps the best score per (player, game). A trigger on training_scores maintains it, so no app
-- code writes here, and every game gets records, not only Pet Dash. The cleanup cron and competition resets
-- do not touch it.
--
-- Read by src/hooks/useTrainingRecords.js (Pet Dash's ready screen). Until this runs, that screen falls back
-- to this week's numbers.
-- Safe to run twice. Undo: remove_training_records.sql.

CREATE TABLE IF NOT EXISTS public.training_records (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  best_score integer NOT NULL DEFAULT 0,
  best_at timestamptz,
  -- Scored runs counted since this table exists (the backfill counts what training_scores still had).
  runs integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_type)
);

CREATE INDEX IF NOT EXISTS idx_training_records_board
  ON public.training_records (game_type, best_score DESC, best_at);

-- Everyone signed in can read the boards. There are no write policies: only the trigger writes, as the owner.
ALTER TABLE public.training_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS training_records_read ON public.training_records;
CREATE POLICY training_records_read ON public.training_records
  FOR SELECT TO authenticated USING (true);

-- A game inserts its row with score 0 when it opens and sets the score when the run is saved (PetDisplay).
-- A run is counted once, when its row first gets a score.
CREATE OR REPLACE FUNCTION public.track_training_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_run integer := 1;
BEGIN
  IF NEW.user_id IS NULL OR NEW.game_type IS NULL OR COALESCE(NEW.score, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.score, 0) > 0 THEN
      new_run := 0;
    END IF;
  END IF;

  INSERT INTO public.training_records AS r (user_id, game_type, best_score, best_at, runs)
  VALUES (NEW.user_id, NEW.game_type, NEW.score, COALESCE(NEW.played_at, now()), new_run)
  ON CONFLICT (user_id, game_type) DO UPDATE SET
    best_score = GREATEST(r.best_score, EXCLUDED.best_score),
    best_at = CASE WHEN EXCLUDED.best_score > r.best_score THEN EXCLUDED.best_at ELSE r.best_at END,
    runs = r.runs + new_run,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_training_record ON public.training_scores;
CREATE TRIGGER trg_track_training_record
  AFTER INSERT OR UPDATE OF score ON public.training_scores
  FOR EACH ROW
  WHEN (NEW.score > 0)
  EXECUTE FUNCTION public.track_training_record();

-- Backfill from what training_scores still holds (the last 10 days). A second run keeps the higher numbers.
INSERT INTO public.training_records AS r (user_id, game_type, best_score, best_at, runs)
SELECT DISTINCT ON (s.user_id, s.game_type)
       s.user_id, s.game_type, s.score, s.played_at,
       count(*) OVER (PARTITION BY s.user_id, s.game_type)
FROM public.training_scores s
WHERE s.score > 0 AND s.user_id IS NOT NULL AND s.game_type IS NOT NULL
ORDER BY s.user_id, s.game_type, s.score DESC, s.played_at ASC
ON CONFLICT (user_id, game_type) DO UPDATE SET
  best_score = GREATEST(r.best_score, EXCLUDED.best_score),
  best_at = CASE WHEN EXCLUDED.best_score > r.best_score THEN EXCLUDED.best_at ELSE r.best_at END,
  runs = GREATEST(r.runs, EXCLUDED.runs),
  updated_at = now();

-- Let the API see the new table right away.
NOTIFY pgrst, 'reload schema';
