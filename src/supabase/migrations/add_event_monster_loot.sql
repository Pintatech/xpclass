-- Per-monster drop tables, split by first clear vs repeat.
--
-- Until now a monster could only change the ODDS of a drop — its `monsters`
-- entry fed base_chance, while the item pool (`included_items`) was read from
-- the top level alone. So every creature on the ladder paid out of the same box,
-- just at different rates. This makes the pool resolve per monster, and per
-- outcome within a monster, so beating Onikage for the first time can hand over
-- one specific thing while every rematch after that pays out of an ordinary
-- pile.
--
-- Rarity weighting is gone with it. A draw is now even across whatever the pool
-- holds: the pool IS the statement of what a monster can pay, and a weighting
-- over the top of a hand-picked list of three was a second, invisible say over
-- the same decision — one that mostly decided nothing while looking like it did.
-- Rarity still colours the item wherever it is shown; it just no longer votes.
--
-- Shape:
--
--   {
--     "base_chance": 0.5,
--     "included_items": [],
--     "first_clear": {"base_chance": 1.0, "rolls": 2},
--     "repeat":      {"base_chance": 0.2},
--     "monsters": {
--       "ninja": {
--         "base_chance": 1.0,
--         "first_clear": {"guaranteed_items": ["<uuid>"], "rolls": 3,
--                         "chest": {"chance": 1.0, "chest_id": "<uuid>"}},
--         "repeat":      {"base_chance": 0.15, "included_items": ["<uuid>", "<uuid>"]}
--       }
--     }
--   }
--
-- `guaranteed_items` is handed over outright, with no roll involved, and is the
-- plain way to say "beating this stage gives exactly this".
--
-- `rolls` is how many RANDOM draws happen on top of that — each its own
-- independent draw at `base_chance`, so three rolls at 50% average one and a
-- half items rather than promising three. The same item drawn twice stacks as
-- quantity 2 rather than arriving as two drops.
--
-- Rolls default to ZERO, so a win pays only what its config actually names. It
-- used to default to one, and that read far worse than it sounds: an empty pool
-- means "any active item" (the rule exercise drops use), so a stage configured
-- with nothing but a guaranteed item and a chest ALSO handed over a random item
-- out of the whole catalogue, every single time, with nothing in the config to
-- point at. Randomness now has to be asked for.
--
-- A `chest` block may sit at any of those levels beside the item settings, and
-- is handed over separately from the item — see the comment on that step. It
-- names ONE chest by id and how often it is given: {"chest_id": "<uuid>",
-- "chance": 1.0}. Nothing is given without an id, so a config that has never
-- named a chest behaves exactly as it did. The block resolves along the pool's
-- chain, not the odds' — the chest is part of what this monster gives.
--
-- Resolution runs most-specific-first, and the two knobs deliberately fall back
-- along DIFFERENT chains, because they answer different questions:
--
--   pool  — WHAT this creature is carrying: `included_items`, `guaranteed_items`
--           and the `chest`. That is identity, so a monster's own list holds
--           whether the kill is the first or the fiftieth:
--             monsters.<id>.<outcome> -> monsters.<id> -> <outcome> -> root
--
--   odds  — HOW OFTEN and HOW MUCH it pays: `base_chance` and `rolls`. That is a
--           property of the outcome, so a bare
--           monster entry still speaks for first clears only and a repeat stays
--           a repeat whichever monster it was — the rule the ladder shipped
--           with, unchanged:
--             first clear: monsters.<id>.first_clear -> monsters.<id>
--                          -> root.first_clear -> root
--             repeat:      monsters.<id>.repeat -> root.repeat -> root
--
-- An empty array or object anywhere in a chain reads as "not set" and falls
-- through, so clearing a monster's list in the admin panel returns it to the
-- shared pool rather than silently widening it to the whole catalogue.

-- Nothing to seed: the shape is additive and every key is optional. This only
-- guarantees the `monsters` object exists so the admin editor has somewhere to
-- write. An edited config is never overwritten by a migration.
UPDATE public.drop_config
   SET config_value = config_value || jsonb_build_object('monsters', '{}'::jsonb),
       updated_at = now()
 WHERE config_key = 'event_battle_drop_rate'
   AND config_value->'monsters' IS NULL;

-- Take the retired weights out of the stored config as well. The roll ignores
-- them either way, and a setting that sits in the JSON doing nothing is a trap
-- for whoever reads it next and tunes it expecting an effect. Only this key is
-- touched — exercise_drop_rate still weights its own drops.
DO $$
DECLARE
  v jsonb;
  k text;
  m jsonb;
BEGIN
  SELECT config_value INTO v FROM public.drop_config
   WHERE config_key = 'event_battle_drop_rate';

  IF v IS NULL THEN
    RETURN;
  END IF;

  v := v - 'rarity_weights';

  FOREACH k IN ARRAY ARRAY['first_clear', 'repeat']
  LOOP
    IF jsonb_typeof(v->k) = 'object' THEN
      v := jsonb_set(v, ARRAY[k], (v->k) - 'rarity_weights');
    END IF;
  END LOOP;

  IF jsonb_typeof(v->'monsters') = 'object' THEN
    SELECT jsonb_object_agg(
             e.key,
             (e.value - 'rarity_weights')
             || CASE WHEN jsonb_typeof(e.value->'first_clear') = 'object'
                     THEN jsonb_build_object('first_clear', (e.value->'first_clear') - 'rarity_weights')
                     ELSE '{}'::jsonb END
             || CASE WHEN jsonb_typeof(e.value->'repeat') = 'object'
                     THEN jsonb_build_object('repeat', (e.value->'repeat') - 'rarity_weights')
                     ELSE '{}'::jsonb END
           )
      INTO m
      FROM jsonb_each(v->'monsters') AS e;

    v := jsonb_set(v, '{monsters}', COALESCE(m, '{}'::jsonb));
  END IF;

  UPDATE public.drop_config
     SET config_value = v, updated_at = now()
   WHERE config_key = 'event_battle_drop_rate';
END $$;

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
  v_first      boolean := COALESCE(p_first_clear, true);
  v_config     jsonb;
  v_monster    jsonb;   -- monsters.<id>
  v_mon_out    jsonb;   -- monsters.<id>.first_clear | monsters.<id>.repeat
  v_outcome    jsonb;   -- root first_clear | root repeat
  v_slot       text;
  v_chance     float;
  v_included   jsonb;
  v_filtered   boolean;
  v_item       record;
  v_rolls      integer;
  v_i          integer;
  v_guaranteed jsonb;
  v_picks      uuid[];
  v_items      jsonb;
  v_chest_cfg  jsonb;
  v_chest_id   text;
  v_chest      record;
  v_user_chest uuid;
  v_chest_json json;
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

  v_slot    := CASE WHEN v_first THEN 'first_clear' ELSE 'repeat' END;
  v_monster := COALESCE(v_config->'monsters'->COALESCE(p_monster_id, ''), '{}'::jsonb);
  v_outcome := COALESCE(v_config->v_slot, '{}'::jsonb);
  v_mon_out := COALESCE(v_monster->v_slot, '{}'::jsonb);

  -- Odds. The bare monster entry counts for first clears only (see header).
  IF v_first THEN
    v_chance := COALESCE(
      (v_mon_out->>'base_chance')::float,
      (v_monster->>'base_chance')::float,
      (v_outcome->>'base_chance')::float,
      (v_config ->>'base_chance')::float,
      0
    );
    v_rolls := COALESCE(
      (v_mon_out->>'rolls')::integer,
      (v_monster->>'rolls')::integer,
      (v_outcome->>'rolls')::integer,
      (v_config ->>'rolls')::integer,
      0
    );
  ELSE
    v_chance := COALESCE(
      (v_mon_out->>'base_chance')::float,
      (v_outcome->>'base_chance')::float,
      (v_config ->>'base_chance')::float,
      0
    );
    v_rolls := COALESCE(
      (v_mon_out->>'rolls')::integer,
      (v_outcome->>'rolls')::integer,
      (v_config ->>'rolls')::integer,
      0
    );
  END IF;

  -- A typo in a config should not mint a hundred items.
  v_rolls := LEAST(GREATEST(COALESCE(v_rolls, 0), 0), 10);

  -- Pool. The monster's own list holds for either outcome.
  v_included := COALESCE(
    NULLIF(v_mon_out->'included_items', '[]'::jsonb),
    NULLIF(v_monster->'included_items', '[]'::jsonb),
    NULLIF(v_outcome->'included_items', '[]'::jsonb),
    NULLIF(v_config ->'included_items', '[]'::jsonb),
    '[]'::jsonb
  );

  -- Given outright, so it follows the pool's chain: these are things this
  -- monster hands over, not a measure of how generous a win is.
  v_guaranteed := COALESCE(
    NULLIF(v_mon_out->'guaranteed_items', '[]'::jsonb),
    NULLIF(v_monster->'guaranteed_items', '[]'::jsonb),
    NULLIF(v_outcome->'guaranteed_items', '[]'::jsonb),
    NULLIF(v_config ->'guaranteed_items', '[]'::jsonb),
    '[]'::jsonb
  );
  -- A hand-edited config can hold a jsonb `null` or the wrong type where a list
  -- belongs, and neither NULLIF nor COALESCE catches that — a jsonb null is a
  -- value, not a missing key. Normalising here is what keeps jsonb_array_length
  -- and jsonb_array_elements_text off a scalar.
  IF jsonb_typeof(v_included) <> 'array' THEN
    v_included := '[]'::jsonb;
  END IF;

  v_filtered := jsonb_array_length(v_included) > 0;

  -- What is owed before any dice are thrown. A guaranteed list is how "beating
  -- this stage for the first time gives exactly these two things" is said — the
  -- alternative was a one-item pool at chance 1, which reads as a coincidence of
  -- three settings rather than as a stated reward.
  IF jsonb_typeof(v_guaranteed) = 'array' THEN
    SELECT array_agg(ci.id)
      INTO v_picks
      FROM jsonb_array_elements_text(v_guaranteed) AS g(id)
      JOIN collectible_items ci ON ci.id::text = g.id
     WHERE ci.is_active = true;
  END IF;

  v_picks := COALESCE(v_picks, '{}'::uuid[]);

  -- Each roll is its own draw, chance and all, so `rolls` is how many chances at
  -- an item a win is worth rather than a promise of that many: three rolls at
  -- 50% average one and a half items. Two rolls landing on the same item stack
  -- as quantity 2 rather than appearing twice.
  --
  -- Every item in the pool is equally likely. Rarity is a label on the item, not
  -- a weight in this draw: what a monster can pay is said by its pool, and the
  -- pool is a list an admin picked by hand. A weighting on top of that was a
  -- second, invisible say over the same decision — and on the short lists these
  -- pools actually hold, it mostly decided nothing while looking like it did.
  FOR v_i IN 1..v_rolls
  LOOP
    CONTINUE WHEN random() > v_chance;

    SELECT * INTO v_item
      FROM collectible_items
     WHERE is_active = true
       AND (NOT v_filtered OR (v_included ? id::text))
     ORDER BY random()
     LIMIT 1;

    IF v_item.id IS NOT NULL THEN
      v_picks := v_picks || v_item.id;
    END IF;
  END LOOP;

  -- Banked in one statement rather than one per pick, so the same item drawn
  -- twice arrives as a single row with quantity 2 and cannot conflict with
  -- itself mid-payout.
  IF array_length(v_picks, 1) > 0 THEN
    INSERT INTO user_inventory (user_id, user_name, item_id, item_name, quantity)
    SELECT v_user, (SELECT full_name FROM users WHERE id = v_user), ci.id, ci.name, p.qty
      FROM (SELECT id, count(*) AS qty FROM unnest(v_picks) AS id GROUP BY id) p
      JOIN collectible_items ci ON ci.id = p.id
    ON CONFLICT (user_id, item_id)
    DO UPDATE SET quantity = user_inventory.quantity + EXCLUDED.quantity, updated_at = now();

    SELECT jsonb_agg(jsonb_build_object(
             'id', ci.id,
             'name', ci.name,
             'image_url', ci.image_url,
             'rarity', ci.rarity,
             'item_type', ci.item_type,
             'set_name', ci.set_name,
             'quantity', p.qty
           ) ORDER BY ci.rarity, ci.name)
      INTO v_items
      FROM (SELECT id, count(*) AS qty FROM unnest(v_picks) AS id GROUP BY id) p
      JOIN collectible_items ci ON ci.id = p.id;
  END IF;

  v_items := COALESCE(v_items, '[]'::jsonb);

  -- ---------------------------------------------------------------------------
  -- The chest, rolled independently of the item.
  --
  -- Independent because the two rewards answer different questions: the item is
  -- what the monster was carrying, the chest is what beating it was worth. A
  -- boss's first clear can hand over both, and a stage that pays only a chest
  -- just sets the item chance to 0 — which is why a missed item roll no longer
  -- returns early. No chest is named unless one was configured, so a config that
  -- has never heard of chests behaves exactly as it did.
  --
  -- The block resolves along the pool's chain rather than the odds' — a chest is
  -- part of what this monster gives, so a repeat can be worth one too.
  -- ---------------------------------------------------------------------------
  v_chest_cfg := COALESCE(
    NULLIF(v_mon_out->'chest', '{}'::jsonb),
    NULLIF(v_monster->'chest', '{}'::jsonb),
    NULLIF(v_outcome->'chest', '{}'::jsonb),
    NULLIF(v_config ->'chest', '{}'::jsonb),
    '{}'::jsonb
  );

  IF jsonb_typeof(v_chest_cfg) <> 'object' THEN
    v_chest_cfg := '{}'::jsonb;
  END IF;

  v_chest_id := NULLIF(v_chest_cfg->>'chest_id', '');

  IF v_chest_id IS NOT NULL AND random() <= COALESCE((v_chest_cfg->>'chance')::float, 0) THEN
    -- THE chest that was named, not one of its rarity. A chest is already a
    -- loot table of its own — its contents, its guaranteed items and how many it
    -- pays are all set on the row — so picking one at random from a rarity would
    -- be rolling on a roll, and an admin who set a stage's reward would have no
    -- idea which box the student actually got.
    --
    -- Compared as text so a config holding something that is not a uuid reads as
    -- "no such chest" instead of raising out of the whole payout.
    SELECT * INTO v_chest
      FROM chests
     WHERE is_active = true
       AND id::text = v_chest_id
     LIMIT 1;

    -- A chest that has been deleted or deactivated since it was configured pays
    -- nothing rather than a substitute: an admin who asked for one box and got
    -- another would have no way of noticing.
    IF v_chest.id IS NOT NULL THEN
      INSERT INTO user_chests (user_id, chest_id, source, source_ref)
      VALUES (v_user, v_chest.id, 'event_battle', COALESCE(p_monster_id, ''))
      RETURNING id INTO v_user_chest;

      v_chest_json := json_build_object(
        'user_chest_id', v_user_chest,
        'chest_id', v_chest.id,
        'name', v_chest.name,
        'image_url', v_chest.image_url,
        'chest_type', v_chest.chest_type
      );
    END IF;
  END IF;

  -- `dropped` still means at least one ITEM dropped, and `item` is the first of
  -- them, so a client written against the single-drop version keeps reading this
  -- correctly rather than silently showing nothing.
  RETURN json_build_object(
    'dropped', jsonb_array_length(v_items) > 0,
    'first_clear', v_first,
    'items', v_items,
    'item', v_items->0,
    'chest', v_chest_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION roll_event_battle_drop(text, boolean, boolean) TO authenticated;

COMMENT ON FUNCTION roll_event_battle_drop(text, boolean, boolean) IS
  'Rolls event battle loot. Pool and odds resolve per monster and per outcome from drop_config.event_battle_drop_rate; add_event_monster_loot.sql documents the two fallback chains.';

UPDATE public.drop_config
   SET description = 'Chance and contents of a drop when an event battle is won. Odds: a first clear uses the monster entry then "first_clear"; a repeat always uses "repeat"; "rolls" is how many draws a win gets. Pool: "included_items" resolves per monster and per outcome, falling back to the shared list, and a draw is even across it — rarity does not weight it. "guaranteed_items" are given outright, and a "chest" block hands over one named chest.',
       updated_at = now()
 WHERE config_key = 'event_battle_drop_rate';
