-- ============================================================
-- PvP Ranked Ladder (15-level, async, season-based)
-- ============================================================
-- Depends on: users, student_levels, pvp_challenges
-- Adds: async ranked matchmaking pool, LP progression, seasons,
-- rewards, and anti-boost guards (skill-gated matching,
-- pair cooldown, daily LP cap).
-- ============================================================

-- 1. User columns --------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pvp_rank_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pvp_rank_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pvp_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pvp_losses integer NOT NULL DEFAULT 0;

-- 2. Seasons --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pvp_seasons (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  soft_reset_levels integer NOT NULL DEFAULT 2,
  lp_per_win integer NOT NULL DEFAULT 25,
  lp_per_loss integer NOT NULL DEFAULT 20,
  daily_lp_cap integer NOT NULL DEFAULT 150,
  max_level integer NOT NULL DEFAULT 15,
  created_at timestamptz DEFAULT now()
);

-- Only one active season at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pvp_seasons_single_active
  ON public.pvp_seasons (status)
  WHERE status = 'active';

-- 3. Ranked matches (async pool + completed record) ----------
CREATE TABLE IF NOT EXISTS public.ranked_matches (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  season_id uuid NOT NULL REFERENCES pvp_seasons(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  player1_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player1_score integer NOT NULL,
  player1_level integer NOT NULL,
  player2_id uuid REFERENCES users(id) ON DELETE SET NULL,
  player2_score integer,
  player2_level integer,
  winner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  lp_multiplier numeric NOT NULL DEFAULT 1.0,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','matched','completed','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_ranked_matches_pool
  ON public.ranked_matches (game_type, status, created_at)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_ranked_matches_player1
  ON public.ranked_matches (player1_id, status);

CREATE INDEX IF NOT EXISTS idx_ranked_matches_player2
  ON public.ranked_matches (player2_id, status);

CREATE INDEX IF NOT EXISTS idx_ranked_matches_pair_recent
  ON public.ranked_matches (player1_id, player2_id, completed_at)
  WHERE status = 'completed';

-- 4. Rank history (audit trail + drives daily cap lookups) ---
CREATE TABLE IF NOT EXISTS public.pvp_rank_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES pvp_seasons(id) ON DELETE CASCADE,
  ranked_match_id uuid REFERENCES ranked_matches(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('win','loss','pair_cooldown','daily_cap','window_penalty','season_reset','floor_clamp')),
  old_level integer NOT NULL,
  new_level integer NOT NULL,
  old_points integer NOT NULL,
  new_points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ranked_match_id)
);

CREATE INDEX IF NOT EXISTS idx_pvp_rank_history_user_day
  ON public.pvp_rank_history (user_id, created_at);

-- 5. Season rewards (tier bands) -----------------------------
CREATE TABLE IF NOT EXISTS public.pvp_season_rewards (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  season_id uuid NOT NULL REFERENCES pvp_seasons(id) ON DELETE CASCADE,
  min_level integer NOT NULL,
  max_level integer NOT NULL,
  xp_reward integer NOT NULL DEFAULT 0,
  gem_reward integer NOT NULL DEFAULT 0,
  title_reward text,
  icon_reward text,
  created_at timestamptz DEFAULT now(),
  CHECK (min_level <= max_level)
);

-- 6. Season final ranks (snapshot written on season close) ---
CREATE TABLE IF NOT EXISTS public.pvp_season_final_ranks (
  season_id uuid NOT NULL REFERENCES pvp_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  final_level integer NOT NULL,
  final_points integer NOT NULL,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  rewards_claimed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, user_id)
);

ALTER TABLE public.pvp_season_final_ranks
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 7. RLS ------------------------------------------------------
ALTER TABLE public.pvp_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranked_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_rank_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_season_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_season_final_ranks ENABLE ROW LEVEL SECURITY;

-- Everyone can read
DROP POLICY IF EXISTS "Anyone can read pvp_seasons" ON pvp_seasons;
CREATE POLICY "Anyone can read pvp_seasons" ON pvp_seasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read ranked_matches" ON ranked_matches;
CREATE POLICY "Anyone can read ranked_matches" ON ranked_matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read pvp_rank_history" ON pvp_rank_history;
CREATE POLICY "Anyone can read pvp_rank_history" ON pvp_rank_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read pvp_season_rewards" ON pvp_season_rewards;
CREATE POLICY "Anyone can read pvp_season_rewards" ON pvp_season_rewards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read pvp_season_final_ranks" ON pvp_season_final_ranks;
CREATE POLICY "Anyone can read pvp_season_final_ranks" ON pvp_season_final_ranks FOR SELECT USING (true);

-- Writes go through SECURITY DEFINER RPCs below, but allow authenticated inserts as a safety net
DROP POLICY IF EXISTS "Authenticated can insert ranked_matches" ON ranked_matches;
CREATE POLICY "Authenticated can insert ranked_matches" ON ranked_matches FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated can update ranked_matches" ON ranked_matches;
CREATE POLICY "Authenticated can update ranked_matches" ON ranked_matches FOR UPDATE USING (true);

-- ============================================================
-- 8. RPC: submit_ranked_score
-- ============================================================
-- Dual-purpose:
--   If p_ranked_match_id is NULL → the user is posting a NEW score.
--     1. try claim_ranked_match first (poster becomes claimer if a waiting
--        row is eligible); if none eligible, insert a new waiting row.
--   If p_ranked_match_id is set → the user is the claimer finishing their
--     game → complete the row and apply rank changes to both players.
-- Returns json: { action, ranked_match_id, opponent_id, opponent_score, lp_multiplier, result? }
-- ============================================================

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
  -- Ensure season is active
  SELECT s.id INTO v_season FROM pvp_seasons s WHERE s.status = 'active' LIMIT 1;
  IF v_season IS NULL THEN
    RAISE EXCEPTION 'No active PvP season';
  END IF;

  SELECT pvp_rank_level INTO v_level FROM users WHERE users.id = p_user_id;
  IF v_level IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Pick the oldest waiting row that matches the age-based level window
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

  -- Window-bucket multiplier (6-24h = 0.5x)
  IF v_age_seconds >= 6 * 3600 THEN
    v_mult := 0.5;
    v_window_penalty := true;
  END IF;

  -- Pair cooldown: how many completed ranked matches between these two in last 6h
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

  -- Claim the row
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

-- ============================================================
-- 9. RPC: post_ranked_score — creates a new waiting row
-- ============================================================
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
  SELECT id INTO v_season FROM pvp_seasons WHERE status = 'active' LIMIT 1;
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

-- ============================================================
-- 10. RPC: complete_ranked_match — claimer finishes their game
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_ranked_match(
  p_ranked_match_id uuid,
  p_user_id uuid,
  p_score integer
) RETURNS TABLE (
  winner_id uuid,
  player1_score integer,
  player2_score integer,
  lp_multiplier numeric,
  my_delta integer,
  my_new_level integer,
  my_new_points integer
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row ranked_matches;
  v_winner uuid;
  v_loser uuid;
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

  -- Determine winner (ties go to nobody — no rank change)
  IF p_score > v_row.player1_score THEN
    v_winner := p_user_id;
    v_loser := v_row.player1_id;
  ELSIF p_score < v_row.player1_score THEN
    v_winner := v_row.player1_id;
    v_loser := p_user_id;
  ELSE
    v_winner := NULL;
  END IF;

  UPDATE ranked_matches
    SET player2_score = p_score,
        winner_id = v_winner,
        status = 'completed',
        completed_at = now()
    WHERE ranked_matches.id = p_ranked_match_id;

  -- Apply rank changes if there was a winner
  IF v_winner IS NOT NULL THEN
    PERFORM public.apply_pvp_rank_change(p_ranked_match_id, v_winner, v_loser);
  END IF;

  -- Return result view for the caller (claimer)
  winner_id := v_winner;
  player1_score := v_row.player1_score;
  player2_score := p_score;
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

-- ============================================================
-- 10b. RPC: forfeit_ranked_match — claimer bails; opponent wins
-- ============================================================
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

-- ============================================================
-- 11. RPC: apply_pvp_rank_change — the LP / promo / demote core
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_pvp_rank_change(
  p_ranked_match_id uuid,
  p_winner_id uuid,
  p_loser_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_season pvp_seasons;
  v_match ranked_matches;
  v_today_start timestamptz := date_trunc('day', now());
  v_today_gain integer;
  v_win_gain integer;
  v_loss_drop integer;
  v_reason_w text := 'win';
  v_reason_l text := 'loss';
BEGIN
  SELECT * INTO v_match FROM ranked_matches WHERE id = p_ranked_match_id;
  SELECT * INTO v_season FROM pvp_seasons WHERE id = v_match.season_id;

  -- Idempotency: skip if already applied
  IF EXISTS (SELECT 1 FROM pvp_rank_history WHERE ranked_match_id = p_ranked_match_id) THEN
    RETURN;
  END IF;

  -- Base deltas
  v_win_gain := floor(v_season.lp_per_win * v_match.lp_multiplier)::integer;
  v_loss_drop := v_season.lp_per_loss;

  -- Daily LP cap for winner
  SELECT COALESCE(SUM(GREATEST(delta, 0)), 0) INTO v_today_gain
    FROM pvp_rank_history
    WHERE user_id = p_winner_id AND created_at >= v_today_start AND delta > 0;

  IF v_today_gain + v_win_gain > v_season.daily_lp_cap THEN
    v_win_gain := GREATEST(0, v_season.daily_lp_cap - v_today_gain);
    IF v_win_gain < floor(v_season.lp_per_win * v_match.lp_multiplier)::integer THEN
      v_reason_w := 'daily_cap';
    END IF;
  END IF;

  -- Detect multiplier-based reasons (diagnostic tag takes precedence over 'win')
  IF v_match.lp_multiplier = 0 THEN
    v_reason_w := 'pair_cooldown';
  ELSIF v_match.lp_multiplier < 1 AND v_reason_w = 'win' THEN
    IF v_match.lp_multiplier <= 0.25 THEN
      v_reason_w := 'pair_cooldown';
    ELSE
      v_reason_w := 'window_penalty';
    END IF;
  END IF;

  -- Apply winner
  PERFORM public._apply_lp_delta(p_winner_id, v_match.season_id, p_ranked_match_id, v_win_gain, v_reason_w, v_season.max_level);
  UPDATE users SET pvp_wins = pvp_wins + 1 WHERE id = p_winner_id;

  -- Apply loser
  PERFORM public._apply_lp_delta(p_loser_id, v_match.season_id, p_ranked_match_id, -v_loss_drop, v_reason_l, v_season.max_level);
  UPDATE users SET pvp_losses = pvp_losses + 1 WHERE id = p_loser_id;
END;
$$;

-- ============================================================
-- 12. Internal: _apply_lp_delta — handles promo / demote / floor
-- ============================================================
CREATE OR REPLACE FUNCTION public._apply_lp_delta(
  p_user_id uuid,
  p_season_id uuid,
  p_ranked_match_id uuid,
  p_delta integer,
  p_reason text,
  p_max_level integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_level integer;
  v_old_points integer;
  v_new_level integer;
  v_new_points integer;
  v_effective_delta integer := p_delta;
  v_final_reason text := p_reason;
BEGIN
  SELECT pvp_rank_level, pvp_rank_points INTO v_old_level, v_old_points
    FROM users WHERE id = p_user_id FOR UPDATE;

  v_new_level := v_old_level;
  v_new_points := v_old_points + p_delta;

  -- Promote / demote loop (handles big swings in both directions)
  WHILE v_new_points >= 100 AND v_new_level < p_max_level LOOP
    v_new_points := v_new_points - 100;
    v_new_level := v_new_level + 1;
    -- Promo bonus carryover: points = 25 after promotion (like LoL promo)
    IF v_new_points < 25 THEN v_new_points := 25; END IF;
  END LOOP;

  WHILE v_new_points < 0 AND v_new_level > 1 LOOP
    v_new_points := v_new_points + 100;
    v_new_level := v_new_level - 1;
    IF v_new_points > 75 THEN v_new_points := 75; END IF;
  END LOOP;

  -- Clamp at bounds
  IF v_new_level >= p_max_level THEN
    v_new_level := p_max_level;
    IF v_new_points > 100 THEN v_new_points := 100; END IF;
  END IF;
  IF v_new_level <= 1 AND v_new_points < 0 THEN
    v_new_points := 0;
    v_final_reason := 'floor_clamp';
  END IF;

  -- Compute effective delta (in case of floor clamp)
  IF v_old_level = v_new_level THEN
    v_effective_delta := v_new_points - v_old_points;
  END IF;

  UPDATE users
    SET pvp_rank_level = v_new_level,
        pvp_rank_points = v_new_points
    WHERE id = p_user_id;

  INSERT INTO pvp_rank_history (
    user_id, season_id, ranked_match_id, delta, reason,
    old_level, new_level, old_points, new_points
  ) VALUES (
    p_user_id, p_season_id, p_ranked_match_id, v_effective_delta, v_final_reason,
    v_old_level, v_new_level, v_old_points, v_new_points
  )
  ON CONFLICT (user_id, ranked_match_id) DO NOTHING;
END;
$$;

-- ============================================================
-- 13. RPC: expire_stale_ranked_matches
-- ============================================================
-- Two jobs:
--   1. Expire 'waiting' rows past their 24h TTL.
--   2. Auto-forfeit 'matched' rows that have been sitting for
--      >10 minutes (claimer claimed but never completed — e.g.
--      refreshed away, closed tab, crashed). Player 1 wins.
-- Safe to call periodically (e.g. via pg_cron or edge function).
-- ============================================================
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

-- ============================================================
-- 14. RPC: end_pvp_season
-- ============================================================
CREATE OR REPLACE FUNCTION public.end_pvp_season(p_season_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_reset integer;
BEGIN
  SELECT soft_reset_levels INTO v_reset FROM pvp_seasons WHERE id = p_season_id;
  IF v_reset IS NULL THEN
    RAISE EXCEPTION 'Season not found';
  END IF;

  -- Snapshot final ranks for every participant (any wins or losses this season)
  INSERT INTO pvp_season_final_ranks (season_id, user_id, final_level, final_points, wins, losses)
  SELECT p_season_id, u.id, u.pvp_rank_level, u.pvp_rank_points, u.pvp_wins, u.pvp_losses
    FROM users u
    WHERE u.pvp_wins + u.pvp_losses > 0
  ON CONFLICT (season_id, user_id) DO NOTHING;

  -- Expire stale waiting rows for this season
  UPDATE ranked_matches
    SET status = 'expired'
    WHERE season_id = p_season_id AND status IN ('waiting','matched');

  -- Close the season
  UPDATE pvp_seasons
    SET status = 'ended', ended_at = now()
    WHERE id = p_season_id;

  -- Soft reset everyone for the next season
  UPDATE users
    SET pvp_rank_level = GREATEST(1, pvp_rank_level - v_reset),
        pvp_rank_points = 0,
        pvp_wins = 0,
        pvp_losses = 0;
END;
$$;

-- ============================================================
-- 15. RPC: claim_pvp_season_rewards
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_pvp_season_rewards(p_season_id uuid, p_user_id uuid)
RETURNS TABLE (
  xp_reward integer,
  gem_reward integer,
  title_reward text,
  icon_reward text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_final pvp_season_final_ranks;
  v_reward pvp_season_rewards;
BEGIN
  SELECT * INTO v_final
    FROM pvp_season_final_ranks
    WHERE season_id = p_season_id AND user_id = p_user_id
    FOR UPDATE;

  IF v_final.user_id IS NULL THEN
    RAISE EXCEPTION 'No final rank snapshot for this user in this season';
  END IF;

  IF v_final.rewards_claimed THEN
    RAISE EXCEPTION 'Rewards already claimed';
  END IF;

  -- Pick highest reward band the user qualifies for
  SELECT * INTO v_reward
    FROM pvp_season_rewards
    WHERE season_id = p_season_id
      AND v_final.final_level BETWEEN min_level AND max_level
    ORDER BY max_level DESC
    LIMIT 1;

  IF v_reward.id IS NULL THEN
    -- No reward band matches → mark as claimed so we don't re-enter
    UPDATE pvp_season_final_ranks
      SET rewards_claimed = true, claimed_at = now()
      WHERE season_id = p_season_id AND user_id = p_user_id;
    xp_reward := 0; gem_reward := 0; title_reward := NULL; icon_reward := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE users
    SET xp = xp + v_reward.xp_reward,
        gems = gems + v_reward.gem_reward
    WHERE id = p_user_id;

  UPDATE pvp_season_final_ranks
    SET rewards_claimed = true, claimed_at = now()
    WHERE season_id = p_season_id AND user_id = p_user_id;

  xp_reward := v_reward.xp_reward;
  gem_reward := v_reward.gem_reward;
  title_reward := v_reward.title_reward;
  icon_reward := v_reward.icon_reward;
  RETURN NEXT;
END;
$$;

-- ============================================================
-- 16. Seed one active season if none exists
-- ============================================================
INSERT INTO pvp_seasons (name, status, started_at)
SELECT 'Season 1', 'active', now()
WHERE NOT EXISTS (SELECT 1 FROM pvp_seasons WHERE status = 'active');
