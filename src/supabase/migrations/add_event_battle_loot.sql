-- Loot from the event battle.
--
-- The fight already pays XP into event_character_stats; this is the other half
-- of the reward. It draws from the same collectible_items pool the exercise
-- drops use, so a kill feeds the inventory and the crafting recipes rather than
-- minting a currency of its own.
--
-- Shaped after roll_exercise_drop (Schema.sql): the odds live in a drop_config
-- row so they can be retuned from the admin panel without a deploy. What
-- differs is the gate — a win rather than a score — and the per-monster
-- override, so a tougher monster can pay better than the one before it.

INSERT INTO public.drop_config (config_key, config_value, description) VALUES
('event_battle_drop_rate',
 '{"base_chance": 0.5,
   "rarity_weights": {"common": 55, "uncommon": 27, "rare": 14, "epic": 4},
   "included_items": [],
   "monsters": {
     "golem": {"base_chance": 0.55, "rarity_weights": {"common": 45, "uncommon": 30, "rare": 18, "epic": 7}},
     "zombie": {"base_chance": 0.45}
   }}',
 'Chance of an item drop when an event battle is won. "monsters" overrides base_chance and/or rarity_weights per monster id; "included_items" narrows the pool as it does for exercise drops.')
ON CONFLICT (config_key) DO NOTHING;

-- Roll for a drop at the end of a won event battle.
--
-- The battle is resolved on the client, so p_won is the client's word — the
-- same trust model award_event_character_xp runs under, and with the same
-- reasoning: moving the exchange server-side is the only real fix and there is
-- nothing to win here but items a student could also earn by doing exercises.
-- The odds and the pool are settled here regardless, so a caller can claim a
-- roll but never choose what it lands on.
CREATE OR REPLACE FUNCTION roll_event_battle_drop(p_monster_id text, p_won boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       uuid := auth.uid();
  v_config     jsonb;
  v_override   jsonb;
  v_chance     float;
  v_weights    jsonb;
  v_included   jsonb;
  v_filtered   boolean;
  v_total      integer := 0;
  v_cumulative integer := 0;
  v_roll       float;
  v_rarity     text := 'common';
  v_key        text;
  v_value      integer;
  v_item       record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- A loss already pays reduced XP; that is the whole consolation.
  IF NOT COALESCE(p_won, false) THEN
    RETURN json_build_object('dropped', false);
  END IF;

  SELECT config_value INTO v_config
    FROM drop_config
   WHERE config_key = 'event_battle_drop_rate';

  IF v_config IS NULL THEN
    RETURN json_build_object('dropped', false);
  END IF;

  -- A monster entry may override either knob or both, so each falls back to the
  -- top-level value on its own.
  v_override := COALESCE(v_config->'monsters'->COALESCE(p_monster_id, ''), '{}'::jsonb);
  v_chance   := COALESCE((v_override->>'base_chance')::float, (v_config->>'base_chance')::float, 0);
  v_weights  := COALESCE(v_override->'rarity_weights', v_config->'rarity_weights', '{}'::jsonb);
  v_included := COALESCE(v_config->'included_items', '[]'::jsonb);
  v_filtered := jsonb_array_length(v_included) > 0;

  IF random() > v_chance THEN
    RETURN json_build_object('dropped', false);
  END IF;

  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(v_weights)
  LOOP
    v_total := v_total + v_value;
  END LOOP;

  IF v_total > 0 THEN
    v_roll := random() * v_total;
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(v_weights)
    LOOP
      v_cumulative := v_cumulative + v_value;
      IF v_roll <= v_cumulative THEN
        v_rarity := v_key;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  SELECT * INTO v_item
    FROM collectible_items
   WHERE is_active = true AND rarity = v_rarity
     AND (NOT v_filtered OR (v_included ? id::text))
   ORDER BY random()
   LIMIT 1;

  -- Nothing of that rarity exists yet: pay out something rather than swallowing
  -- the win, the way the exercise roll does.
  IF v_item IS NULL THEN
    SELECT * INTO v_item
      FROM collectible_items
     WHERE is_active = true
       AND (NOT v_filtered OR (v_included ? id::text))
     ORDER BY random()
     LIMIT 1;
  END IF;

  IF v_item IS NULL THEN
    RETURN json_build_object('dropped', false);
  END IF;

  INSERT INTO user_inventory (user_id, user_name, item_id, item_name, quantity)
  VALUES (v_user, (SELECT full_name FROM users WHERE id = v_user), v_item.id, v_item.name, 1)
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET quantity = user_inventory.quantity + 1, updated_at = now();

  RETURN json_build_object(
    'dropped', true,
    'item', json_build_object(
      'id', v_item.id,
      'name', v_item.name,
      'image_url', v_item.image_url,
      'rarity', v_item.rarity,
      'item_type', v_item.item_type,
      'set_name', v_item.set_name
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION roll_event_battle_drop(text, boolean) TO authenticated;
