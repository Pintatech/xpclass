-- The seven-day event ladder.
--
-- Three regular monsters, two days each, and a boss on day seven. Which monster
-- a day holds, when the week starts and what tier 2 multiplies all live in
-- src/config/eventLadder.js — none of that is duplicated here. What the database
-- owns is the part a client must not be able to lie about: which stages a
-- student has actually beaten, and therefore whether the fight they just won was
-- the first clear (full reward) or a repeat (a consolation).
--
-- Self-contained: it can be run before or after add_event_battle_loot.sql.

CREATE TABLE IF NOT EXISTS public.event_stage_clears (
  user_id uuid NOT NULL,
  stage integer NOT NULL,
  clears integer NOT NULL DEFAULT 0,
  first_cleared_at timestamp with time zone DEFAULT now(),
  last_cleared_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_stage_clears_pkey PRIMARY KEY (user_id, stage),
  CONSTRAINT event_stage_clears_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT event_stage_clears_stage_range CHECK (stage BETWEEN 1 AND 30)
);

ALTER TABLE public.event_stage_clears ENABLE ROW LEVEL SECURITY;

-- Readable by anyone signed in, so a class leaderboard can show how far each
-- student has climbed without needing another policy.
DROP POLICY IF EXISTS "event_stage_clears_select" ON public.event_stage_clears;
CREATE POLICY "event_stage_clears_select" ON public.event_stage_clears
  FOR SELECT USING (true);

-- Writes go through the RPC below, which is SECURITY DEFINER and enforces the
-- ladder order. These exist so nothing else has to be granted.
DROP POLICY IF EXISTS "event_stage_clears_insert" ON public.event_stage_clears;
CREATE POLICY "event_stage_clears_insert" ON public.event_stage_clears
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "event_stage_clears_update" ON public.event_stage_clears;
CREATE POLICY "event_stage_clears_update" ON public.event_stage_clears
  FOR UPDATE USING (auth.uid() = user_id);

-- Record a won stage, and report whether that was the first time.
--
-- The ladder order is enforced here rather than trusted from the client: stage N
-- cannot be recorded until stage N-1 has been. Admins are exempt, because they
-- have to be able to open any day of the week to check it — the dashboard lets
-- them click one, and a stage that can be fought but not banked would be worse
-- than one that stays shut.
--
-- The calendar half of the gate — stage N opens on day N — is deliberately NOT
-- duplicated here. It depends on EVENT_START in src/config/eventLadder.js, and a
-- second copy of that date in the database is a thing to forget when the event
-- is rerun; the worst a student can do by bypassing it is fight the week's
-- stages in the right order, early.
--
-- "First clear" is read off the insert itself rather than a prior SELECT, so two
-- tabs finishing the same fight at once cannot both be told they were first.
CREATE OR REPLACE FUNCTION record_event_stage_clear(p_stage integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_clears integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_stage IS NULL OR p_stage < 1 THEN
    RAISE EXCEPTION 'stage must be positive';
  END IF;

  IF p_stage > 1
     AND NOT EXISTS (
       SELECT 1 FROM public.event_stage_clears
        WHERE user_id = v_user AND stage = p_stage - 1 AND clears > 0
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.users WHERE id = v_user AND role = 'admin'
     )
  THEN
    RAISE EXCEPTION 'stage % is still locked', p_stage;
  END IF;

  INSERT INTO public.event_stage_clears (user_id, stage, clears)
  VALUES (v_user, p_stage, 1)
  ON CONFLICT (user_id, stage) DO UPDATE
     SET clears = public.event_stage_clears.clears + 1,
         last_cleared_at = now()
  RETURNING clears INTO v_clears;

  RETURN json_build_object('first_clear', v_clears = 1, 'clears', v_clears, 'stage', p_stage);
END;
$$;

GRANT EXECUTE ON FUNCTION record_event_stage_clear(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Loot, now that a win is either a first clear or a repeat.
--
-- A first clear rolls from the `first_clear` odds, or from a `monsters` entry
-- when that monster has one — those describe what beating THAT monster is worth.
-- A repeat always rolls from `repeat`, which is the whole point of the setting:
-- a student may refight a cleared stage all afternoon, but only for commons.
-- ---------------------------------------------------------------------------

INSERT INTO public.drop_config (config_key, config_value, description) VALUES
('event_battle_drop_rate',
 '{"base_chance": 0.5,
   "rarity_weights": {"common": 55, "uncommon": 27, "rare": 14, "epic": 4},
   "included_items": [],
   "first_clear": {"base_chance": 1.0, "rarity_weights": {"common": 40, "uncommon": 32, "rare": 20, "epic": 8}},
   "repeat": {"base_chance": 0.2, "rarity_weights": {"common": 85, "uncommon": 15, "rare": 0, "epic": 0}},
   "monsters": {
     "golem": {"base_chance": 0.55, "rarity_weights": {"common": 45, "uncommon": 30, "rare": 18, "epic": 7}},
     "ninja": {"base_chance": 1.0, "rarity_weights": {"common": 20, "uncommon": 30, "rare": 32, "epic": 18}}
   }}',
 'Chance of an item drop when an event battle is won. First clears use "first_clear", or a "monsters" entry for that monster; repeats always use "repeat". "included_items" narrows the pool as it does for exercise drops.')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = public.drop_config.config_value
                     || jsonb_build_object(
                          'first_clear', COALESCE(public.drop_config.config_value->'first_clear', EXCLUDED.config_value->'first_clear'),
                          'repeat',      COALESCE(public.drop_config.config_value->'repeat',      EXCLUDED.config_value->'repeat')
                        ),
      updated_at = now();

-- The two-argument version is replaced rather than overloaded, so there is one
-- drop roll and no ambiguity about which one a client reaches.
DROP FUNCTION IF EXISTS roll_event_battle_drop(text, boolean);

CREATE OR REPLACE FUNCTION roll_event_battle_drop(
  p_monster_id text,
  p_won boolean,
  p_first_clear boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       uuid := auth.uid();
  v_config     jsonb;
  v_outcome    jsonb;
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

  -- Where this roll's odds come from. A monster's own entry speaks only for
  -- first clears; a repeat is a repeat whichever monster it was.
  IF COALESCE(p_first_clear, true) THEN
    v_outcome := COALESCE(
      v_config->'monsters'->COALESCE(p_monster_id, ''),
      v_config->'first_clear',
      '{}'::jsonb
    );
  ELSE
    v_outcome := COALESCE(v_config->'repeat', '{}'::jsonb);
  END IF;

  -- Each knob falls back to the top level on its own, so an entry may set the
  -- chance, the weights, or both.
  v_chance   := COALESCE((v_outcome->>'base_chance')::float, (v_config->>'base_chance')::float, 0);
  v_weights  := COALESCE(v_outcome->'rarity_weights', v_config->'rarity_weights', '{}'::jsonb);
  v_included := COALESCE(v_config->'included_items', '[]'::jsonb);
  v_filtered := jsonb_array_length(v_included) > 0;

  IF random() > v_chance THEN
    RETURN json_build_object('dropped', false);
  END IF;

  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(v_weights)
  LOOP
    v_total := v_total + GREATEST(v_value, 0);
  END LOOP;

  IF v_total > 0 THEN
    v_roll := random() * v_total;
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(v_weights)
    LOOP
      -- A rarity weighted at zero must never win, wherever the roll lands.
      CONTINUE WHEN v_value <= 0;
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
    'first_clear', COALESCE(p_first_clear, true),
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

GRANT EXECUTE ON FUNCTION roll_event_battle_drop(text, boolean, boolean) TO authenticated;
