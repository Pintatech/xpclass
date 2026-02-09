-- ============================================
-- Migration: Score-Based Chest Rarity System
-- ============================================

-- 1. Drop old constraint first (must happen before updating data)
ALTER TABLE public.chests DROP CONSTRAINT IF EXISTS chests_chest_type_check;

-- 2. Update existing chest records from old types to new rarity types
UPDATE public.chests SET chest_type = 'common' WHERE chest_type = 'standard';
UPDATE public.chests SET chest_type = 'rare' WHERE chest_type = 'premium';
UPDATE public.chests SET chest_type = 'common' WHERE chest_type = 'event';

-- 3. Add new constraint with 5 rarity types
ALTER TABLE public.chests ADD CONSTRAINT chests_chest_type_check
  CHECK (chest_type IN ('common', 'uncommon', 'rare', 'epic', 'legendary'));

-- 4. Update default value
ALTER TABLE public.chests ALTER COLUMN chest_type SET DEFAULT 'common';

-- 4. Update milestone_chests config
UPDATE public.drop_config
SET config_value = '{"session_complete": "common", "streak_7": "uncommon", "streak_30": "rare", "challenge_win_top3": "uncommon"}'::jsonb,
    updated_at = now()
WHERE config_key = 'milestone_chests';

-- 5. Replace award_exercise_chest function with score-based rarity
CREATE OR REPLACE FUNCTION award_exercise_chest(p_user_id uuid, p_exercise_id uuid, p_score integer DEFAULT 75)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course record;
  v_chest record;
  v_existing_chest uuid;
  v_chest_type text;
BEGIN
  -- Find the course for this exercise via exercise_assignments -> session -> unit -> course
  SELECT c.id AS course_id, c.chest_enabled
  INTO v_course
  FROM exercise_assignments ea
  JOIN sessions s ON s.id = ea.session_id
  JOIN units u ON u.id = s.unit_id
  JOIN courses c ON c.id = u.course_id
  WHERE ea.exercise_id = p_exercise_id
  LIMIT 1;

  IF v_course IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'exercise_not_found');
  END IF;

  -- Check if course has chest drops enabled
  IF NOT v_course.chest_enabled THEN
    RETURN json_build_object('success', false, 'reason', 'chest_not_enabled');
  END IF;

  -- Check if user already received a chest for this exercise
  SELECT id INTO v_existing_chest
  FROM user_chests
  WHERE user_id = p_user_id
    AND source = 'exercise_complete'
    AND source_ref = p_exercise_id::text;

  IF v_existing_chest IS NOT NULL THEN
    RETURN json_build_object('success', false, 'reason', 'already_awarded');
  END IF;

  -- Determine chest rarity based on score
  IF p_score >= 90 THEN
    v_chest_type := 'rare';
  ELSIF p_score >= 80 THEN
    v_chest_type := 'uncommon';
  ELSE
    v_chest_type := 'common';
  END IF;

  -- Find an active chest of the determined rarity
  SELECT * INTO v_chest
  FROM chests
  WHERE chest_type = v_chest_type AND is_active = true
  ORDER BY random()
  LIMIT 1;

  IF v_chest IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'no_active_chest');
  END IF;

  -- Award the chest
  INSERT INTO user_chests (user_id, chest_id, source, source_ref)
  VALUES (p_user_id, v_chest.id, 'exercise_complete', p_exercise_id::text);

  RETURN json_build_object(
    'success', true,
    'chest_id', v_chest.id,
    'chest_name', v_chest.name,
    'chest_image_url', v_chest.image_url,
    'chest_type', v_chest_type
  );
END;
$$;
