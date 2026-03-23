-- ====================================
-- POKEMON-STYLE BALL CATCH SYSTEM
-- Run these in Supabase SQL Editor
-- ====================================

-- 1. Add 'ball' to collectible_items item_type (if constraint exists)
ALTER TABLE public.collectible_items
  DROP CONSTRAINT IF EXISTS collectible_items_item_type_check;

-- Re-add with 'ball' included
ALTER TABLE public.collectible_items
  ADD CONSTRAINT collectible_items_item_type_check
  CHECK (item_type IN ('fragment', 'card', 'material', 'egg', 'pet_food', 'pet_toy', 'background', 'item', 'ball'));

-- 2. Add wild_area_last_encounter column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS wild_area_last_encounter timestamptz;

-- 3. Seed encounter & catch rate configs
INSERT INTO public.drop_config (config_key, config_value, description) VALUES
(
  'pet_encounter',
  '{
    "base_chance": 0.25,
    "rarity_weights": {"common": 50, "uncommon": 30, "rare": 15, "epic": 4, "legendary": 1},
    "wild_area_cooldown_minutes": 30,
    "wild_area_enabled": true
  }',
  'Pet encounter rates after exercise completion and wild area settings'
),
(
  'catch_rates',
  '{
    "ball_bonus": {"common": 0.10, "uncommon": 0.25, "rare": 0.45, "epic": 0.70, "legendary": 0.95},
    "pet_difficulty": {"common": 0.50, "uncommon": 0.30, "rare": 0.15, "epic": 0.07, "legendary": 0.03}
  }',
  'Catch rate formula: final_rate = min(1.0, ball_bonus + pet_difficulty). Higher ball bonus = easier. Lower pet difficulty = harder.'
)
ON CONFLICT (config_key) DO NOTHING;

-- ====================================
-- RPC: Roll for pet encounter
-- ====================================
CREATE OR REPLACE FUNCTION roll_pet_encounter(p_user_id uuid, p_score integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_val jsonb;
  base_chance float;
  rarity_weights jsonb;
  total_weight integer;
  roll float;
  rarity_roll float;
  selected_rarity text;
  cumulative_weight integer;
  rarity_key text;
  rarity_value integer;
  selected_pet record;
BEGIN
  -- No encounter if score below 75%
  IF p_score < 75 THEN
    RETURN json_build_object('encountered', false);
  END IF;

  SELECT config_value INTO config_val
  FROM drop_config WHERE config_key = 'pet_encounter';

  IF config_val IS NULL THEN
    RETURN json_build_object('encountered', false);
  END IF;

  base_chance := (config_val->>'base_chance')::float;
  rarity_weights := config_val->'rarity_weights';

  -- Roll for encounter
  roll := random();
  IF roll > base_chance THEN
    RETURN json_build_object('encountered', false);
  END IF;

  -- Calculate total weight
  total_weight := 0;
  FOR rarity_key, rarity_value IN SELECT * FROM jsonb_each_text(rarity_weights)
  LOOP
    total_weight := total_weight + rarity_value::integer;
  END LOOP;

  -- Roll for rarity
  rarity_roll := random() * total_weight;
  cumulative_weight := 0;
  selected_rarity := 'common';

  FOR rarity_key, rarity_value IN SELECT * FROM jsonb_each_text(rarity_weights)
  LOOP
    cumulative_weight := cumulative_weight + rarity_value::integer;
    IF rarity_roll <= cumulative_weight THEN
      selected_rarity := rarity_key;
      EXIT;
    END IF;
  END LOOP;

  -- Pick random active pet of that rarity (prefer unowned)
  SELECT * INTO selected_pet
  FROM pets
  WHERE is_active = true AND rarity = selected_rarity
    AND id NOT IN (SELECT pet_id FROM user_pets WHERE user_id = p_user_id)
  ORDER BY random() LIMIT 1;

  -- If all of that rarity owned, allow any pet of that rarity
  IF selected_pet IS NULL THEN
    SELECT * INTO selected_pet
    FROM pets
    WHERE is_active = true AND rarity = selected_rarity
    ORDER BY random() LIMIT 1;
  END IF;

  IF selected_pet IS NULL THEN
    RETURN json_build_object('encountered', false);
  END IF;

  RETURN jsonb_build_object(
    'encountered', true,
    'pet', jsonb_build_object(
      'id', selected_pet.id,
      'name', selected_pet.name,
      'image_url', selected_pet.image_url,
      'rarity', selected_pet.rarity,
      'description', selected_pet.description
    )
  );
END;
$$;

-- ====================================
-- RPC: Attempt to catch a pet
-- ====================================
CREATE OR REPLACE FUNCTION attempt_catch_pet(p_user_id uuid, p_pet_id uuid, p_ball_item_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ball_record record;
  pet_record record;
  user_ball_qty integer;
  catch_config jsonb;
  ball_bonus float;
  pet_difficulty float;
  final_rate float;
  roll float;
  caught boolean;
  already_owned boolean;
  new_user_pet_id uuid;
  refund_amount integer;
BEGIN
  -- Validate ball exists and is a ball
  SELECT * INTO ball_record FROM collectible_items
  WHERE id = p_ball_item_id AND item_type = 'ball' AND is_active = true;

  IF ball_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid ball');
  END IF;

  -- Validate user has the ball
  SELECT quantity INTO user_ball_qty FROM user_inventory
  WHERE user_id = p_user_id AND item_id = p_ball_item_id;

  IF user_ball_qty IS NULL OR user_ball_qty < 1 THEN
    RETURN json_build_object('success', false, 'error', 'No balls remaining');
  END IF;

  -- Validate pet exists
  SELECT * INTO pet_record FROM pets
  WHERE id = p_pet_id AND is_active = true;

  IF pet_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pet not found');
  END IF;

  -- Consume ball (regardless of outcome)
  UPDATE user_inventory
  SET quantity = quantity - 1, updated_at = now()
  WHERE user_id = p_user_id AND item_id = p_ball_item_id;

  -- Get catch rate config
  SELECT config_value INTO catch_config
  FROM drop_config WHERE config_key = 'catch_rates';

  IF catch_config IS NULL THEN
    ball_bonus := 0.30;
    pet_difficulty := 0.50;
  ELSE
    ball_bonus := COALESCE((catch_config->'ball_bonus'->>ball_record.rarity)::float, 0.30);
    pet_difficulty := COALESCE((catch_config->'pet_difficulty'->>pet_record.rarity)::float, 0.50);
  END IF;

  final_rate := LEAST(1.0, ball_bonus + pet_difficulty);

  -- Roll for catch
  roll := random();
  caught := roll <= final_rate;

  IF NOT caught THEN
    RETURN json_build_object(
      'success', true,
      'caught', false,
      'catch_rate', round(final_rate * 100),
      'pet', json_build_object('id', pet_record.id, 'name', pet_record.name,
        'image_url', pet_record.image_url, 'rarity', pet_record.rarity)
    );
  END IF;

  -- Check if already owned
  SELECT EXISTS(
    SELECT 1 FROM user_pets WHERE user_id = p_user_id AND pet_id = p_pet_id
  ) INTO already_owned;

  IF already_owned THEN
    refund_amount := CASE pet_record.rarity
      WHEN 'common' THEN 5
      WHEN 'uncommon' THEN 10
      WHEN 'rare' THEN 20
      WHEN 'epic' THEN 50
      WHEN 'legendary' THEN 100
      ELSE 5
    END;
    UPDATE users SET gems = gems + refund_amount WHERE id = p_user_id;
    RETURN json_build_object(
      'success', true,
      'caught', true,
      'duplicate', true,
      'refund_gems', refund_amount,
      'pet', json_build_object('id', pet_record.id, 'name', pet_record.name,
        'image_url', pet_record.image_url, 'rarity', pet_record.rarity),
      'catch_rate', round(final_rate * 100)
    );
  END IF;

  -- Create user_pet
  INSERT INTO user_pets (user_id, pet_id)
  VALUES (p_user_id, p_pet_id)
  RETURNING id INTO new_user_pet_id;

  RETURN json_build_object(
    'success', true,
    'caught', true,
    'duplicate', false,
    'user_pet_id', new_user_pet_id,
    'pet', json_build_object('id', pet_record.id, 'name', pet_record.name,
      'image_url', pet_record.image_url, 'rarity', pet_record.rarity,
      'description', pet_record.description),
    'catch_rate', round(final_rate * 100)
  );
END;
$$;

-- ====================================
-- RPC: Buy ball
-- ====================================
CREATE OR REPLACE FUNCTION buy_ball(p_user_id uuid, p_ball_item_id uuid, p_currency text DEFAULT 'gems')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ball_record record;
  user_record record;
  cost integer;
BEGIN
  -- Get ball or ticket
  SELECT * INTO ball_record FROM collectible_items
  WHERE id = p_ball_item_id AND item_type IN ('ball', 'ticket') AND is_active = true;

  IF ball_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ball not found');
  END IF;

  -- Get user balance
  SELECT gems, xp INTO user_record FROM users WHERE id = p_user_id;

  -- Determine cost and deduct
  IF p_currency = 'xp' THEN
    cost := COALESCE(ball_record.price_xp, 0);
    IF cost <= 0 THEN RETURN json_build_object('success', false, 'error', 'Not available for XP'); END IF;
    IF user_record.xp < cost THEN RETURN json_build_object('success', false, 'error', 'Not enough XP'); END IF;
    UPDATE users SET xp = xp - cost WHERE id = p_user_id;
  ELSE
    cost := COALESCE(ball_record.price_gems, 0);
    IF cost <= 0 THEN RETURN json_build_object('success', false, 'error', 'Not available for gems'); END IF;
    IF user_record.gems < cost THEN RETURN json_build_object('success', false, 'error', 'Not enough gems'); END IF;
    UPDATE users SET gems = gems - cost WHERE id = p_user_id;
  END IF;

  -- Add to inventory
  INSERT INTO user_inventory (user_id, user_name, item_id, item_name, quantity)
  VALUES (p_user_id, (SELECT full_name FROM users WHERE id = p_user_id), p_ball_item_id, ball_record.name, 1)
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET quantity = user_inventory.quantity + 1, updated_at = now();

  RETURN json_build_object(
    'success', true,
    'ball_name', ball_record.name,
    'gems_spent', CASE WHEN p_currency = 'gems' THEN cost ELSE 0 END,
    'xp_spent', CASE WHEN p_currency = 'xp' THEN cost ELSE 0 END
  );
END;
$$;

-- ====================================
-- RPC: Wild area encounter (with cooldown)
-- ====================================
CREATE OR REPLACE FUNCTION roll_wild_area_encounter(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_val jsonb;
  cooldown_minutes integer;
  last_encounter timestamptz;
  user_role text;
  ticket_item_id uuid;
  ticket_qty integer;
  rarity_weights jsonb;
  total_weight integer;
  rarity_roll float;
  selected_rarity text;
  cumulative_weight integer;
  rarity_key text;
  rarity_value integer;
  selected_pet record;
BEGIN
  SELECT config_value INTO config_val
  FROM drop_config WHERE config_key = 'pet_encounter';

  IF config_val IS NULL OR NOT COALESCE((config_val->>'wild_area_enabled')::boolean, false) THEN
    RETURN json_build_object('encountered', false, 'error', 'Wild area disabled');
  END IF;

  -- Check user role for admin bypass
  SELECT role INTO user_role FROM users WHERE id = p_user_id;

  cooldown_minutes := COALESCE((config_val->>'wild_area_cooldown_minutes')::integer, 30);

  -- Check cooldown (skip for admins)
  IF user_role IS DISTINCT FROM 'admin' THEN
    SELECT wild_area_last_encounter INTO last_encounter FROM users WHERE id = p_user_id;

    IF last_encounter IS NOT NULL AND
       last_encounter > now() - (cooldown_minutes * interval '1 minute') THEN
      RETURN json_build_object(
        'encountered', false,
        'cooldown_remaining', EXTRACT(EPOCH FROM (last_encounter + (cooldown_minutes * interval '1 minute') - now()))::integer
      );
    END IF;

    -- Consume adventure ticket (non-admins only)
    SELECT ci.id INTO ticket_item_id
    FROM collectible_items ci
    WHERE ci.item_type = 'ticket' AND ci.name = 'Adventure Ticket' AND ci.is_active = true
    LIMIT 1;

    IF ticket_item_id IS NOT NULL THEN
      SELECT ui.quantity INTO ticket_qty
      FROM user_inventory ui
      WHERE ui.user_id = p_user_id AND ui.item_id = ticket_item_id;

      IF ticket_qty IS NULL OR ticket_qty < 1 THEN
        RETURN json_build_object('encountered', false, 'error', 'no_ticket');
      END IF;

      UPDATE user_inventory
      SET quantity = quantity - 1, updated_at = now()
      WHERE user_id = p_user_id AND item_id = ticket_item_id;

      DELETE FROM user_inventory
      WHERE user_id = p_user_id AND item_id = ticket_item_id AND quantity <= 0;
    END IF;
  END IF;

  -- Update last encounter time
  UPDATE users SET wild_area_last_encounter = now() WHERE id = p_user_id;

  -- Roll rarity (always encounter in wild area, just roll which rarity)
  rarity_weights := config_val->'rarity_weights';

  total_weight := 0;
  FOR rarity_key, rarity_value IN SELECT * FROM jsonb_each_text(rarity_weights)
  LOOP
    total_weight := total_weight + rarity_value::integer;
  END LOOP;

  rarity_roll := random() * total_weight;
  cumulative_weight := 0;
  selected_rarity := 'common';

  FOR rarity_key, rarity_value IN SELECT * FROM jsonb_each_text(rarity_weights)
  LOOP
    cumulative_weight := cumulative_weight + rarity_value::integer;
    IF rarity_roll <= cumulative_weight THEN
      selected_rarity := rarity_key;
      EXIT;
    END IF;
  END LOOP;

  -- Pick random active pet (prefer unowned)
  SELECT * INTO selected_pet
  FROM pets
  WHERE is_active = true AND rarity = selected_rarity
    AND id NOT IN (SELECT pet_id FROM user_pets WHERE user_id = p_user_id)
  ORDER BY random() LIMIT 1;

  IF selected_pet IS NULL THEN
    SELECT * INTO selected_pet
    FROM pets
    WHERE is_active = true AND rarity = selected_rarity
    ORDER BY random() LIMIT 1;
  END IF;

  IF selected_pet IS NULL THEN
    RETURN json_build_object('encountered', false);
  END IF;

  RETURN jsonb_build_object(
    'encountered', true,
    'pet', jsonb_build_object(
      'id', selected_pet.id,
      'name', selected_pet.name,
      'image_url', selected_pet.image_url,
      'rarity', selected_pet.rarity,
      'description', selected_pet.description
    )
  );
END;
$$;
