-- ============================================================
-- MISSIONS SYSTEM - Gunny-style Daily/Weekly/Special Missions
-- ============================================================

-- Mission definitions (admin creates these)
CREATE TABLE IF NOT EXISTS public.missions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  icon text DEFAULT 'target',
  mission_type text NOT NULL CHECK (mission_type IN ('daily', 'weekly', 'special')),
  goal_type text NOT NULL CHECK (goal_type IN (
    'complete_exercises',   -- Complete X exercises
    'score_high',           -- Score 90%+ on X exercises
    'earn_xp',              -- Earn X total XP in period
    'play_games',           -- Play X pet mini-games
    'win_pvp',              -- Win X PvP battles
    'daily_challenge',      -- Participate in X daily challenges
    'login_streak',         -- Maintain X day streak
    'complete_session',     -- Complete X sessions
    'open_chests',          -- Open X chests
    'collect_items',        -- Collect X items
    'all_green_lesson',     -- Get all-green (present + wow + wow) in X lessons
    'blast_words',          -- Blast X words in Astro Blast
    'whack_moles',          -- Whack X moles in Whack-a-Mole
    'scramble_words',       -- Unscramble X words in Word Scramble
    'type_words',           -- Type X words in Word Type
    'match_pairs',          -- Match X pairs in Match Game
    'pronounce_words',      -- Pronounce X words in Say It Right
    'earn_3_stars'          -- Earn 3 stars in X pet games
  )),
  goal_value integer NOT NULL DEFAULT 1,
  reward_xp integer DEFAULT 0,
  reward_gems integer DEFAULT 0,
  reward_item_id uuid REFERENCES public.collectible_items(id),
  reward_item_quantity integer DEFAULT 1,
  is_active boolean DEFAULT true,
  start_date date,          -- for special missions (NULL = always)
  end_date date,            -- for special missions (NULL = always)
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- User mission progress (per user, per mission, per period)
CREATE TABLE IF NOT EXISTS public.user_missions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  progress integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'claimed')),
  period_start date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, mission_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_user_missions_user ON user_missions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_missions_period ON user_missions(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_missions_type ON missions(mission_type, is_active);

-- ============================================================
-- RPC: Get missions for a user (creates entries if needed)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_missions(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date;
  week_start date;
  result json;
BEGIN
  -- Vietnam timezone
  today := (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  -- Monday of current week
  week_start := today - (EXTRACT(ISODOW FROM today)::int - 1);

  -- Ensure user_missions entries exist for active daily missions
  INSERT INTO user_missions (user_id, mission_id, progress, status, period_start)
  SELECT p_user_id, m.id, 0, 'active', today
  FROM missions m
  WHERE m.is_active = true
    AND m.mission_type = 'daily'
  ON CONFLICT (user_id, mission_id, period_start) DO NOTHING;

  -- Ensure user_missions entries exist for active weekly missions
  INSERT INTO user_missions (user_id, mission_id, progress, status, period_start)
  SELECT p_user_id, m.id, 0, 'active', week_start
  FROM missions m
  WHERE m.is_active = true
    AND m.mission_type = 'weekly'
  ON CONFLICT (user_id, mission_id, period_start) DO NOTHING;

  -- Ensure user_missions entries exist for active special missions
  INSERT INTO user_missions (user_id, mission_id, progress, status, period_start)
  SELECT p_user_id, m.id, 0, 'active', COALESCE(m.start_date, today)
  FROM missions m
  WHERE m.is_active = true
    AND m.mission_type = 'special'
    AND (m.start_date IS NULL OR m.start_date <= today)
    AND (m.end_date IS NULL OR m.end_date >= today)
  ON CONFLICT (user_id, mission_id, period_start) DO NOTHING;

  -- Return all current missions with progress
  SELECT json_build_object(
    'daily', COALESCE((
      SELECT json_agg(row_to_json(d) ORDER BY d.sort_order)
      FROM (
        SELECT m.id AS mission_id, m.title, m.description, m.icon,
               m.mission_type, m.goal_type, m.goal_value,
               m.reward_xp, m.reward_gems, m.sort_order,
               um.id AS user_mission_id, um.progress, um.status
        FROM missions m
        JOIN user_missions um ON um.mission_id = m.id AND um.user_id = p_user_id
        WHERE m.is_active = true
          AND m.mission_type = 'daily'
          AND um.period_start = today
      ) d
    ), '[]'::json),
    'weekly', COALESCE((
      SELECT json_agg(row_to_json(w) ORDER BY w.sort_order)
      FROM (
        SELECT m.id AS mission_id, m.title, m.description, m.icon,
               m.mission_type, m.goal_type, m.goal_value,
               m.reward_xp, m.reward_gems, m.sort_order,
               um.id AS user_mission_id, um.progress, um.status
        FROM missions m
        JOIN user_missions um ON um.mission_id = m.id AND um.user_id = p_user_id
        WHERE m.is_active = true
          AND m.mission_type = 'weekly'
          AND um.period_start = week_start
      ) w
    ), '[]'::json),
    'special', COALESCE((
      SELECT json_agg(row_to_json(s) ORDER BY s.sort_order)
      FROM (
        SELECT m.id AS mission_id, m.title, m.description, m.icon,
               m.mission_type, m.goal_type, m.goal_value,
               m.reward_xp, m.reward_gems, m.sort_order,
               m.start_date, m.end_date,
               um.id AS user_mission_id, um.progress, um.status
        FROM missions m
        JOIN user_missions um ON um.mission_id = m.id AND um.user_id = p_user_id
        WHERE m.is_active = true
          AND m.mission_type = 'special'
          AND (m.start_date IS NULL OR m.start_date <= today)
          AND (m.end_date IS NULL OR m.end_date >= today)
          AND um.period_start = COALESCE(m.start_date, today)
      ) s
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- RPC: Update mission progress for a user
-- ============================================================
CREATE OR REPLACE FUNCTION update_mission_progress(
  p_user_id uuid,
  p_goal_type text,
  p_increment integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date;
  week_start date;
  updated_count integer := 0;
BEGIN
  today := (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  week_start := today - (EXTRACT(ISODOW FROM today)::int - 1);

  -- Update daily missions matching this goal type
  UPDATE user_missions um
  SET progress = LEAST(um.progress + p_increment, m.goal_value),
      status = CASE
        WHEN LEAST(um.progress + p_increment, m.goal_value) >= m.goal_value AND um.status = 'active'
        THEN 'completed'
        ELSE um.status
      END,
      updated_at = NOW()
  FROM missions m
  WHERE um.mission_id = m.id
    AND um.user_id = p_user_id
    AND um.status = 'active'
    AND m.goal_type = p_goal_type
    AND m.is_active = true
    AND (
      (m.mission_type = 'daily' AND um.period_start = today)
      OR (m.mission_type = 'weekly' AND um.period_start = week_start)
      OR (m.mission_type = 'special' AND um.period_start = COALESCE(m.start_date, today)
          AND (m.end_date IS NULL OR m.end_date >= today))
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'updated_count', updated_count
  );
END;
$$;

-- ============================================================
-- RPC: Claim mission reward
-- ============================================================
CREATE OR REPLACE FUNCTION claim_mission_reward(
  p_user_id uuid,
  p_user_mission_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_id uuid;
  v_status text;
  v_reward_xp integer;
  v_reward_gems integer;
  v_mission_title text;
BEGIN
  -- Get mission details
  SELECT um.status, m.id, m.reward_xp, m.reward_gems, m.title
  INTO v_status, v_mission_id, v_reward_xp, v_reward_gems, v_mission_title
  FROM user_missions um
  JOIN missions m ON m.id = um.mission_id
  WHERE um.id = p_user_mission_id
    AND um.user_id = p_user_id;

  IF v_mission_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Mission not found');
  END IF;

  IF v_status != 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Mission not completed yet');
  END IF;

  -- Mark as claimed
  UPDATE user_missions
  SET status = 'claimed', updated_at = NOW()
  WHERE id = p_user_mission_id;

  -- Award XP
  IF v_reward_xp > 0 THEN
    UPDATE users
    SET xp = COALESCE(xp, 0) + v_reward_xp,
        updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  -- Award Gems
  IF v_reward_gems > 0 THEN
    UPDATE users
    SET gems = COALESCE(gems, 0) + v_reward_gems,
        updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  -- Create notification
  INSERT INTO notifications (user_id, type, title, message, icon, data)
  VALUES (
    p_user_id,
    'mission_reward',
    'Mission Complete!',
    'You completed "' || v_mission_title || '"! +' ||
      CASE WHEN v_reward_xp > 0 THEN v_reward_xp || ' XP' ELSE '' END ||
      CASE WHEN v_reward_xp > 0 AND v_reward_gems > 0 THEN ' + ' ELSE '' END ||
      CASE WHEN v_reward_gems > 0 THEN v_reward_gems || ' Gems' ELSE '' END,
    'trophy',
    json_build_object('xp', v_reward_xp, 'gems', v_reward_gems, 'mission_title', v_mission_title)
  );

  RETURN json_build_object(
    'success', true,
    'xp_earned', v_reward_xp,
    'gems_earned', v_reward_gems,
    'mission_title', v_mission_title
  );
END;
$$;

-- ============================================================
-- RPC: Claim all completed missions at once
-- ============================================================
CREATE OR REPLACE FUNCTION claim_all_mission_rewards(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_xp integer := 0;
  total_gems integer := 0;
  claimed_count integer := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT um.id AS user_mission_id, m.reward_xp, m.reward_gems, m.title
    FROM user_missions um
    JOIN missions m ON m.id = um.mission_id
    WHERE um.user_id = p_user_id
      AND um.status = 'completed'
  LOOP
    UPDATE user_missions SET status = 'claimed', updated_at = NOW() WHERE id = rec.user_mission_id;
    total_xp := total_xp + COALESCE(rec.reward_xp, 0);
    total_gems := total_gems + COALESCE(rec.reward_gems, 0);
    claimed_count := claimed_count + 1;
  END LOOP;

  IF claimed_count > 0 THEN
    UPDATE users
    SET xp = COALESCE(xp, 0) + total_xp,
        gems = COALESCE(gems, 0) + total_gems,
        updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO notifications (user_id, type, title, message, icon, data)
    VALUES (
      p_user_id, 'mission_reward', 'Missions Claimed!',
      'You claimed ' || claimed_count || ' missions! +' || total_xp || ' XP, +' || total_gems || ' Gems',
      'trophy',
      json_build_object('xp', total_xp, 'gems', total_gems, 'count', claimed_count)
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'claimed_count', claimed_count,
    'total_xp', total_xp,
    'total_gems', total_gems
  );
END;
$$;

-- ============================================================
-- Sample missions data (customize as needed)
-- ============================================================
INSERT INTO missions (title, description, icon, mission_type, goal_type, goal_value, reward_xp, reward_gems, sort_order) VALUES
-- Daily Missions
('Chiến binh chăm chỉ', 'Hoàn thành 3 bài tập', 'book-open', 'daily', 'complete_exercises', 3, 30, 0, 1),
('Ngôi sao sáng', 'Đạt 90%+ trong 2 bài tập', 'star', 'daily', 'score_high', 2, 40, 1, 2),
('Huấn luyện viên', 'Chơi 2 trò chơi pet', 'gamepad-2', 'daily', 'play_games', 2, 20, 0, 3),
('Thử thách hàng ngày', 'Tham gia Daily Challenge', 'trophy', 'daily', 'daily_challenge', 1, 25, 1, 4),

-- Weekly Missions
('Học giả tuần này', 'Hoàn thành 15 bài tập trong tuần', 'graduation-cap', 'weekly', 'complete_exercises', 15, 150, 5, 1),
('Đấu sĩ PvP', 'Thắng 3 trận PvP trong tuần', 'swords', 'weekly', 'win_pvp', 3, 100, 5, 2),
('Streak Master', 'Duy trì streak 5 ngày', 'flame', 'weekly', 'login_streak', 5, 120, 3, 3),
('Game thủ', 'Chơi 10 trò chơi pet trong tuần', 'joystick', 'weekly', 'play_games', 10, 80, 3, 4),
('Siêu điểm', 'Đạt 90%+ trong 8 bài tập', 'medal', 'weekly', 'score_high', 8, 100, 5, 5),
('Thợ săn kho báu', 'Mở 3 rương trong tuần', 'package-open', 'weekly', 'open_chests', 3, 60, 2, 6),

-- Special Missions (example - set start_date/end_date for time-limited)
('Huyền thoại XP', 'Kiếm 500 XP', 'zap', 'special', 'earn_xp', 500, 200, 10, 1),
('Nhà sưu tập', 'Thu thập 5 vật phẩm', 'gem', 'special', 'collect_items', 5, 100, 8, 2);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;

-- Missions: everyone can read
CREATE POLICY "Missions are viewable by all authenticated users"
ON missions FOR SELECT
TO authenticated
USING (true);

-- User missions: users can only see their own
CREATE POLICY "Users can view own missions"
ON user_missions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions"
ON user_missions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions"
ON user_missions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
