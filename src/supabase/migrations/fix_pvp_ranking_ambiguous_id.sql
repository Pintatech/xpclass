-- ============================================================
-- Hotfix for add_pvp_ranking.sql
-- ============================================================
-- 1. claim_ranked_match: "column reference 'id' is ambiguous"
--    RETURNS TABLE (id uuid, ...) made `id` an OUT variable, so
--    `SELECT id INTO v_season FROM pvp_seasons` was ambiguous.
-- 2. pvp_season_final_ranks: missing created_at column referenced
--    by the client-side "unclaimed rewards" query.
-- 3. post_ranked_score: allow a player to have multiple waiting
--    scores stacked (previous rows are no longer auto-expired).
-- 4. forfeit_ranked_match: new RPC — claimer who bails forfeits
--    the match, opponent wins, full LP loss applied.
-- 5. expire_stale_ranked_matches: auto-forfeit 'matched' rows
--    after 10 minutes of inactivity (covers refresh / crash).
-- ============================================================

ALTER TABLE public.pvp_season_final_ranks
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.claim_ranked_match(
  p_user_id uuid,
  p_game_type text
) RETURNS TABLE (
  id uuid,
  player1_id uuid,
  player1_score integer,
  player1_level integer,
  lp_multiplier numeric,
  window_penalty boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_level integer;
  v_season uuid;
  v_row record;
  v_age_seconds numeric;
  v_mult numeric := 1.0;
  v_window_penalty boolean := false;
  v_pair_count integer;
BEGIN
  SELECT s.id INTO v_season FROM pvp_seasons s WHERE s.status = 'active' LIMIT 1;
  IF v_season IS NULL THEN
    RAISE EXCEPTION 'No active PvP season';
  END IF;

  SELECT pvp_rank_level INTO v_level FROM users WHERE users.id = p_user_id;
  IF v_level IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT rm.*
    INTO v_row
  FROM ranked_matches rm
  WHERE rm.status = 'waiting'
    AND rm.game_type = p_game_type
    AND rm.player1_id <> p_user_id
    AND rm.expires_at > now()
    AND rm.season_id = v_season
    AND (
      (now() - rm.created_at < interval '15 minutes' AND abs(rm.player1_level - v_level) <= 1)
      OR (now() - rm.created_at < interval '1 hour' AND abs(rm.player1_level - v_level) <= 2)
      OR (now() - rm.created_at < interval '6 hours' AND abs(rm.player1_level - v_level) <= 3)
      OR (now() - rm.created_at < interval '24 hours')
    )
  ORDER BY rm.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  v_age_seconds := extract(epoch FROM (now() - v_row.created_at));

  IF v_age_seconds >= 6 * 3600 THEN
    v_mult := 0.5;
    v_window_penalty := true;
  END IF;

  SELECT count(*)
    INTO v_pair_count
  FROM ranked_matches rm
  WHERE rm.status = 'completed'
    AND rm.completed_at > now() - interval '6 hours'
    AND (
      (rm.player1_id = p_user_id AND rm.player2_id = v_row.player1_id)
      OR (rm.player1_id = v_row.player1_id AND rm.player2_id = p_user_id)
    );

  IF v_pair_count >= 2 THEN
    v_mult := 0;
  ELSIF v_pair_count = 1 THEN
    v_mult := v_mult * 0.5;
  END IF;

  UPDATE ranked_matches
    SET player2_id = p_user_id,
        player2_level = v_level,
        status = 'matched',
        matched_at = now(),
        lp_multiplier = v_mult
    WHERE ranked_matches.id = v_row.id;

  id := v_row.id;
  player1_id := v_row.player1_id;
  player1_score := v_row.player1_score;
  player1_level := v_row.player1_level;
  lp_multiplier := v_mult;
  window_penalty := v_window_penalty;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_ranked_score(
  p_user_id uuid,
  p_game_type text,
  p_score integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_season uuid;
  v_level integer;
  v_id uuid;
BEGIN
  SELECT s.id INTO v_season FROM pvp_seasons s WHERE s.status = 'active' LIMIT 1;
  IF v_season IS NULL THEN
    RAISE EXCEPTION 'No active PvP season';
  END IF;

  SELECT pvp_rank_level INTO v_level FROM users WHERE users.id = p_user_id;
  IF v_level IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO ranked_matches (
    season_id, game_type, player1_id, player1_score, player1_level,
    status, created_at, expires_at
  ) VALUES (
    v_season, p_game_type, p_user_id, p_score, v_level,
    'waiting', now(), now() + interval '24 hours'
  ) RETURNING ranked_matches.id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.forfeit_ranked_match(
  p_ranked_match_id uuid,
  p_user_id uuid
) RETURNS TABLE (
  winner_id uuid,
  lp_multiplier numeric,
  my_delta integer,
  my_new_level integer,
  my_new_points integer
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row ranked_matches;
  v_result record;
BEGIN
  SELECT * INTO v_row FROM ranked_matches WHERE ranked_matches.id = p_ranked_match_id FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_row.status <> 'matched' THEN
    RAISE EXCEPTION 'Match is not in matched state (status=%)', v_row.status;
  END IF;

  IF v_row.player2_id <> p_user_id THEN
    RAISE EXCEPTION 'You are not the claimer of this match';
  END IF;

  UPDATE ranked_matches
    SET player2_score = 0,
        winner_id = v_row.player1_id,
        status = 'completed',
        completed_at = now()
    WHERE ranked_matches.id = p_ranked_match_id;

  PERFORM public.apply_pvp_rank_change(p_ranked_match_id, v_row.player1_id, p_user_id);

  winner_id := v_row.player1_id;
  lp_multiplier := v_row.lp_multiplier;

  SELECT COALESCE(h.delta, 0) AS delta,
         COALESCE(h.new_level, u.pvp_rank_level) AS new_level,
         COALESCE(h.new_points, u.pvp_rank_points) AS new_points
    INTO v_result
  FROM users u
  LEFT JOIN pvp_rank_history h
    ON h.user_id = u.id AND h.ranked_match_id = p_ranked_match_id
  WHERE u.id = p_user_id;

  my_delta := v_result.delta;
  my_new_level := v_result.new_level;
  my_new_points := v_result.new_points;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_ranked_matches()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer := 0;
  v_expired integer;
  v_stale ranked_matches;
BEGIN
  UPDATE ranked_matches
    SET status = 'expired'
    WHERE status = 'waiting' AND expires_at < now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;
  v_count := v_count + v_expired;

  FOR v_stale IN
    SELECT * FROM ranked_matches
    WHERE status = 'matched'
      AND matched_at < now() - interval '10 minutes'
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE ranked_matches
      SET player2_score = 0,
          winner_id = v_stale.player1_id,
          status = 'completed',
          completed_at = now()
      WHERE ranked_matches.id = v_stale.id;

    PERFORM public.apply_pvp_rank_change(
      v_stale.id,
      v_stale.player1_id,
      v_stale.player2_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
