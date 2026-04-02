-- Add missing goal_type values: win_quickmatch, complete_all_missions
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_goal_type_check;

ALTER TABLE missions ADD CONSTRAINT missions_goal_type_check CHECK (goal_type IN (
  'complete_exercises', 'score_high', 'earn_xp', 'play_games',
  'win_pvp', 'win_quickmatch', 'daily_challenge', 'login_streak', 'complete_session',
  'open_chests', 'collect_items', 'all_green_lesson',
  'blast_words', 'whack_moles', 'scramble_words',
  'type_words', 'match_pairs', 'pronounce_words',
  'earn_3_stars', 'catch_fish', 'complete_all_missions'
));

-- Recreate get_user_missions with dynamic progress for complete_all_missions
CREATE OR REPLACE FUNCTION get_user_missions(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today date;
  week_start date;
  result json;
BEGIN
  today := (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  week_start := today - (EXTRACT(ISODOW FROM today)::int - 1);

  INSERT INTO user_missions (user_id, mission_id, progress, status, period_start)
  SELECT p_user_id, m.id, 0, 'active', today
  FROM missions m WHERE m.is_active = true AND m.mission_type = 'daily'
  ON CONFLICT (user_id, mission_id, period_start) DO NOTHING;

  INSERT INTO user_missions (user_id, mission_id, progress, status, period_start)
  SELECT p_user_id, m.id, 0, 'active', week_start
  FROM missions m WHERE m.is_active = true AND m.mission_type = 'weekly'
  ON CONFLICT (user_id, mission_id, period_start) DO NOTHING;

  INSERT INTO user_missions (user_id, mission_id, progress, status, period_start)
  SELECT p_user_id, m.id, 0, 'active', COALESCE(m.start_date, today)
  FROM missions m
  WHERE m.is_active = true AND m.mission_type = 'special'
    AND (m.start_date IS NULL OR m.start_date <= today)
    AND (m.end_date IS NULL OR m.end_date >= today)
  ON CONFLICT (user_id, mission_id, period_start) DO NOTHING;

  SELECT json_build_object(
    'daily', COALESCE((
      SELECT json_agg(row_to_json(d) ORDER BY d.sort_order) FROM (
        SELECT m.id AS mission_id, m.title, m.description, m.icon,
               m.mission_type, m.goal_type, m.goal_value,
               m.reward_xp, m.reward_gems, m.reward_item_id, m.reward_item_quantity,
               ci.name AS reward_item_name, ci.image_url AS reward_item_image,
               ch.name AS reward_chest_name, ch.image_url AS reward_chest_image,
               m.reward_chest_id,
               m.sort_order,
               um.id AS user_mission_id,
               CASE WHEN m.goal_type = 'complete_all_missions' THEN (
                 SELECT COUNT(*) FROM user_missions um2 JOIN missions m2 ON m2.id = um2.mission_id
                 WHERE um2.user_id = p_user_id AND um2.status = 'claimed'
                   AND m2.mission_type = 'daily' AND m2.goal_type != 'complete_all_missions'
                   AND m2.is_active = true AND um2.period_start = today
               ) ELSE um.progress END AS progress,
               CASE WHEN m.goal_type = 'complete_all_missions' THEN
                 CASE WHEN (
                   SELECT COUNT(*) FROM user_missions um2 JOIN missions m2 ON m2.id = um2.mission_id
                   WHERE um2.user_id = p_user_id AND um2.status = 'claimed'
                     AND m2.mission_type = 'daily' AND m2.goal_type != 'complete_all_missions'
                     AND m2.is_active = true AND um2.period_start = today
                 ) >= m.goal_value AND um.status = 'active' THEN 'completed' ELSE um.status END
               ELSE um.status END AS status
        FROM missions m
        JOIN user_missions um ON um.mission_id = m.id AND um.user_id = p_user_id
        LEFT JOIN collectible_items ci ON ci.id = m.reward_item_id
        LEFT JOIN chests ch ON ch.id = m.reward_chest_id
        WHERE m.is_active = true AND m.mission_type = 'daily' AND um.period_start = today
      ) d
    ), '[]'::json),
    'weekly', COALESCE((
      SELECT json_agg(row_to_json(w) ORDER BY w.sort_order) FROM (
        SELECT m.id AS mission_id, m.title, m.description, m.icon,
               m.mission_type, m.goal_type, m.goal_value,
               m.reward_xp, m.reward_gems, m.reward_item_id, m.reward_item_quantity,
               ci.name AS reward_item_name, ci.image_url AS reward_item_image,
               ch.name AS reward_chest_name, ch.image_url AS reward_chest_image,
               m.reward_chest_id,
               m.sort_order,
               um.id AS user_mission_id,
               CASE WHEN m.goal_type = 'complete_all_missions' THEN (
                 SELECT COUNT(*) FROM user_missions um2 JOIN missions m2 ON m2.id = um2.mission_id
                 WHERE um2.user_id = p_user_id AND um2.status = 'claimed'
                   AND m2.mission_type = 'weekly' AND m2.goal_type != 'complete_all_missions'
                   AND m2.is_active = true AND um2.period_start = week_start
               ) ELSE um.progress END AS progress,
               CASE WHEN m.goal_type = 'complete_all_missions' THEN
                 CASE WHEN (
                   SELECT COUNT(*) FROM user_missions um2 JOIN missions m2 ON m2.id = um2.mission_id
                   WHERE um2.user_id = p_user_id AND um2.status = 'claimed'
                     AND m2.mission_type = 'weekly' AND m2.goal_type != 'complete_all_missions'
                     AND m2.is_active = true AND um2.period_start = week_start
                 ) >= m.goal_value AND um.status = 'active' THEN 'completed' ELSE um.status END
               ELSE um.status END AS status
        FROM missions m
        JOIN user_missions um ON um.mission_id = m.id AND um.user_id = p_user_id
        LEFT JOIN collectible_items ci ON ci.id = m.reward_item_id
        LEFT JOIN chests ch ON ch.id = m.reward_chest_id
        WHERE m.is_active = true AND m.mission_type = 'weekly' AND um.period_start = week_start
      ) w
    ), '[]'::json),
    'special', COALESCE((
      SELECT json_agg(row_to_json(s) ORDER BY s.sort_order) FROM (
        SELECT m.id AS mission_id, m.title, m.description, m.icon,
               m.mission_type, m.goal_type, m.goal_value,
               m.reward_xp, m.reward_gems, m.reward_item_id, m.reward_item_quantity,
               ci.name AS reward_item_name, ci.image_url AS reward_item_image,
               ch.name AS reward_chest_name, ch.image_url AS reward_chest_image,
               m.reward_chest_id,
               m.sort_order,
               m.start_date, m.end_date,
               um.id AS user_mission_id,
               CASE WHEN m.goal_type = 'complete_all_missions' THEN (
                 SELECT COUNT(*) FROM user_missions um2 JOIN missions m2 ON m2.id = um2.mission_id
                 WHERE um2.user_id = p_user_id AND um2.status = 'claimed'
                   AND m2.mission_type = 'special' AND m2.goal_type != 'complete_all_missions'
                   AND m2.is_active = true AND um2.period_start = COALESCE(m2.start_date, today)
               ) ELSE um.progress END AS progress,
               CASE WHEN m.goal_type = 'complete_all_missions' THEN
                 CASE WHEN (
                   SELECT COUNT(*) FROM user_missions um2 JOIN missions m2 ON m2.id = um2.mission_id
                   WHERE um2.user_id = p_user_id AND um2.status = 'claimed'
                     AND m2.mission_type = 'special' AND m2.goal_type != 'complete_all_missions'
                     AND m2.is_active = true AND um2.period_start = COALESCE(m2.start_date, today)
                 ) >= m.goal_value AND um.status = 'active' THEN 'completed' ELSE um.status END
               ELSE um.status END AS status
        FROM missions m
        JOIN user_missions um ON um.mission_id = m.id AND um.user_id = p_user_id
        LEFT JOIN collectible_items ci ON ci.id = m.reward_item_id
        LEFT JOIN chests ch ON ch.id = m.reward_chest_id
        WHERE m.is_active = true AND m.mission_type = 'special'
          AND (m.start_date IS NULL OR m.start_date <= today)
          AND (m.end_date IS NULL OR m.end_date >= today)
          AND um.period_start = COALESCE(m.start_date, today)
      ) s
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Recreate claim_mission_reward without the increment block
CREATE OR REPLACE FUNCTION claim_mission_reward(p_user_id uuid, p_user_mission_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mission_id uuid; v_status text; v_reward_xp integer; v_reward_gems integer;
  v_mission_title text; v_reward_item_id uuid; v_reward_item_qty integer;
  v_reward_chest_id uuid;
  v_item_name text; v_user_name text; v_mission_type text; v_goal_type text;
  today date; week_start date;
BEGIN
  today := (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  week_start := today - (EXTRACT(ISODOW FROM today)::int - 1);

  SELECT um.status, m.id, m.reward_xp, m.reward_gems, m.title,
         m.reward_item_id, m.reward_item_quantity, m.reward_chest_id,
         m.mission_type, m.goal_type
  INTO v_status, v_mission_id, v_reward_xp, v_reward_gems, v_mission_title,
       v_reward_item_id, v_reward_item_qty, v_reward_chest_id,
       v_mission_type, v_goal_type
  FROM user_missions um JOIN missions m ON m.id = um.mission_id
  WHERE um.id = p_user_mission_id AND um.user_id = p_user_id;

  IF v_mission_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Mission not found');
  END IF;
  IF v_status != 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Mission not completed yet');
  END IF;

  UPDATE user_missions SET status = 'claimed', updated_at = NOW() WHERE id = p_user_mission_id;

  IF v_reward_xp > 0 THEN
    UPDATE users SET xp = COALESCE(xp, 0) + v_reward_xp, updated_at = NOW() WHERE id = p_user_id;
  END IF;
  IF v_reward_gems > 0 THEN
    UPDATE users SET gems = COALESCE(gems, 0) + v_reward_gems, updated_at = NOW() WHERE id = p_user_id;
  END IF;

  IF v_reward_item_id IS NOT NULL THEN
    SELECT name INTO v_item_name FROM collectible_items WHERE id = v_reward_item_id;
    SELECT full_name INTO v_user_name FROM users WHERE id = p_user_id;

    INSERT INTO user_inventory (user_id, user_name, item_id, item_name, quantity)
    VALUES (p_user_id, v_user_name, v_reward_item_id, v_item_name, COALESCE(v_reward_item_qty, 1))
    ON CONFLICT (user_id, item_id) DO UPDATE
    SET quantity = user_inventory.quantity + COALESCE(v_reward_item_qty, 1), updated_at = NOW();
  END IF;

  IF v_reward_chest_id IS NOT NULL THEN
    INSERT INTO user_chests (user_id, chest_id, source, source_ref)
    VALUES (p_user_id, v_reward_chest_id, 'mission', v_mission_id::text);
  END IF;

  INSERT INTO notifications (user_id, type, title, message, icon, data)
  VALUES (p_user_id, 'mission_reward', 'Mission Complete!',
    'You completed "' || v_mission_title || '"! ' ||
      CASE WHEN v_reward_xp > 0 THEN '+' || v_reward_xp || ' XP ' ELSE '' END ||
      CASE WHEN v_reward_gems > 0 THEN '+' || v_reward_gems || ' Gems ' ELSE '' END ||
      CASE WHEN v_reward_item_id IS NOT NULL THEN '+' || COALESCE(v_reward_item_qty, 1) || ' ' || COALESCE(v_item_name, 'Item') ELSE '' END,
    'trophy',
    json_build_object('xp', v_reward_xp, 'gems', v_reward_gems, 'mission_title', v_mission_title,
      'item_id', v_reward_item_id, 'item_name', v_item_name, 'item_quantity', v_reward_item_qty));

  RETURN json_build_object('success', true, 'xp_earned', v_reward_xp, 'gems_earned', v_reward_gems,
    'mission_title', v_mission_title, 'item_id', v_reward_item_id, 'item_name', v_item_name, 'item_quantity', v_reward_item_qty);
END;
$$;

-- Recreate claim_all_mission_rewards without the increment block
CREATE OR REPLACE FUNCTION claim_all_mission_rewards(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_xp integer := 0; total_gems integer := 0; claimed_count integer := 0;
  items_granted integer := 0; chests_granted integer := 0;
  rec RECORD; v_user_name text; v_item_name text;
  today date; week_start date;
BEGIN
  today := (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  week_start := today - (EXTRACT(ISODOW FROM today)::int - 1);
  SELECT name INTO v_user_name FROM users WHERE id = p_user_id;

  FOR rec IN
    SELECT um.id AS user_mission_id, m.reward_xp, m.reward_gems, m.title,
           m.reward_item_id, m.reward_item_quantity, m.reward_chest_id,
           m.mission_type, m.goal_type, m.id AS mission_id
    FROM user_missions um JOIN missions m ON m.id = um.mission_id
    WHERE um.user_id = p_user_id AND um.status = 'completed'
  LOOP
    UPDATE user_missions SET status = 'claimed', updated_at = NOW() WHERE id = rec.user_mission_id;
    total_xp := total_xp + COALESCE(rec.reward_xp, 0);
    total_gems := total_gems + COALESCE(rec.reward_gems, 0);
    claimed_count := claimed_count + 1;

    IF rec.reward_item_id IS NOT NULL THEN
      SELECT name INTO v_item_name FROM collectible_items WHERE id = rec.reward_item_id;
      INSERT INTO user_inventory (user_id, user_name, item_id, item_name, quantity)
      VALUES (p_user_id, v_user_name, rec.reward_item_id, v_item_name, COALESCE(rec.reward_item_quantity, 1))
      ON CONFLICT (user_id, item_id) DO UPDATE
      SET quantity = user_inventory.quantity + COALESCE(rec.reward_item_quantity, 1), updated_at = NOW();
      items_granted := items_granted + 1;
    END IF;

    IF rec.reward_chest_id IS NOT NULL THEN
      INSERT INTO user_chests (user_id, chest_id, source, source_ref)
      VALUES (p_user_id, rec.reward_chest_id, 'mission', rec.mission_id::text);
      chests_granted := chests_granted + 1;
    END IF;
  END LOOP;

  IF claimed_count > 0 THEN
    UPDATE users SET xp = COALESCE(xp, 0) + total_xp, gems = COALESCE(gems, 0) + total_gems, updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO notifications (user_id, type, title, message, icon, data)
    VALUES (p_user_id, 'mission_reward', 'Missions Claimed!',
      'You claimed ' || claimed_count || ' missions! +' || total_xp || ' XP, +' || total_gems || ' Gems' ||
        CASE WHEN items_granted > 0 THEN ', +' || items_granted || ' items' ELSE '' END,
      'trophy', json_build_object('xp', total_xp, 'gems', total_gems, 'count', claimed_count, 'items_granted', items_granted));
  END IF;

  RETURN json_build_object('success', true, 'claimed_count', claimed_count, 'total_xp', total_xp, 'total_gems', total_gems, 'items_granted', items_granted);
END;
$$;
