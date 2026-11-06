-- End & Award (admin → Leaderboard Settings) deletes the finished competition game's scores.
--
-- The app used to delete them straight from the browser, but RLS on training_scores does not let anyone delete
-- other people's rows. Supabase then reports success with 0 rows deleted, so the old scores stayed until someone
-- cleared them in the Supabase dashboard. This function deletes them as the table owner, for admins only, and
-- returns how many rows were deleted. src/utils/competitionScores.js calls it.
--
-- Only training_scores of that one game is touched: training_records (all-time records) and other games stay.
-- Safe to run twice. Undo: remove_clear_competition_scores_rpc.sql.

CREATE OR REPLACE FUNCTION public.clear_competition_scores(p_game_type text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  -- users.role, as the other admin checks in this project. Never auth user_metadata: users can edit it themselves.
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can clear competition scores' USING ERRCODE = '42501';
  END IF;
  IF p_game_type IS NULL OR btrim(p_game_type) = '' THEN
    RAISE EXCEPTION 'No game type given' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.training_scores WHERE game_type = p_game_type;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- Signed-in users only; the admin check above does the rest.
REVOKE ALL ON FUNCTION public.clear_competition_scores(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_competition_scores(text) TO authenticated;

-- Let the API see the new function right away.
NOTIFY pgrst, 'reload schema';
