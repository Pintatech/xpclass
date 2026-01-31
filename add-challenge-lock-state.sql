-- Add locked state to daily challenges
-- When a challenge is locked, users can view but not participate
-- Run this in your Supabase SQL Editor

-- Add is_locked column to daily_challenges table
ALTER TABLE public.daily_challenges
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_challenges_locked
ON public.daily_challenges(is_locked, challenge_date);

-- Update get_user_daily_challenge to include locked state
CREATE OR REPLACE FUNCTION get_user_daily_challenge(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  vietnam_today date;
  user_difficulty text;
  user_level_num integer;
  challenge_record record;
  user_participation record;
  result json;
BEGIN
  -- Get today's date in Vietnam timezone
  vietnam_today := (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

  -- Get user's current level number
  SELECT sl.level_number INTO user_level_num
  FROM users u
  JOIN student_levels sl ON u.xp >= sl.xp_required
  WHERE u.id = p_user_id
  ORDER BY sl.level_number DESC
  LIMIT 1;

  -- Determine difficulty based on level number
  IF user_level_num IS NULL OR user_level_num <= 10 THEN
    user_difficulty := 'beginner'; -- Levels 1-10
  ELSIF user_level_num <= 20 THEN
    user_difficulty := 'intermediate'; -- Levels 11-20
  ELSE
    user_difficulty := 'advanced'; -- Levels 21-30
  END IF;

  -- Get today's challenge for user's difficulty
  SELECT * INTO challenge_record
  FROM daily_challenges
  WHERE challenge_date = vietnam_today
    AND difficulty_level = user_difficulty
    AND is_active = true
  LIMIT 1;

  IF challenge_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No challenge available');
  END IF;

  -- Check user participation
  SELECT * INTO user_participation
  FROM daily_challenge_participations
  WHERE challenge_id = challenge_record.id AND user_id = p_user_id;

  -- Build result with exercise details
  SELECT json_build_object(
    'success', true,
    'challenge_id', challenge_record.id,
    'difficulty_level', challenge_record.difficulty_level,
    'exercise_id', challenge_record.exercise_id,
    'exercise_title', e.title,
    'exercise_type', e.exercise_type,
    'base_xp_reward', challenge_record.base_xp_reward,
    'base_gem_reward', challenge_record.base_gem_reward,
    'is_locked', challenge_record.is_locked,
    'winners_awarded', challenge_record.winners_awarded,
    'participated', (user_participation IS NOT NULL),
    'user_score', user_participation.score,
    'user_rank', (
      -- Calculate rank dynamically instead of using cached rank_calculated
      CASE
        WHEN user_participation.score >= 75 THEN
          (SELECT COUNT(*) + 1
           FROM daily_challenge_participations dcp
           WHERE dcp.challenge_id = challenge_record.id
             AND dcp.score >= 75
             AND (dcp.score > user_participation.score
               OR (dcp.score = user_participation.score
                 AND dcp.time_spent < user_participation.time_spent)))
        ELSE NULL
      END
    ),
    'user_time', user_participation.time_spent,
    'attempts_used', COALESCE(user_participation.attempts, 0),
    'max_attempts', 3,
    'session_id', e.session_id
  ) INTO result
  FROM exercises e
  WHERE e.id = challenge_record.exercise_id;

  RETURN result;
END;
$$;

-- Update record_challenge_participation to check locked state
CREATE OR REPLACE FUNCTION record_challenge_participation(
  p_challenge_id uuid,
  p_user_id uuid,
  p_score integer,
  p_time_spent integer,
  p_started_at timestamp with time zone DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_record record;
  existing_participation record;
  participation_id uuid;
  user_rank integer;
  base_xp integer;
  base_gems integer;
  attempts_used integer;
  new_attempt_id uuid;
  is_passing boolean;
BEGIN
  -- Check if score passes minimum threshold
  is_passing := p_score >= 75;

  -- Get challenge details
  SELECT * INTO challenge_record
  FROM daily_challenges
  WHERE id = p_challenge_id AND is_active = true;

  IF challenge_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Challenge not found');
  END IF;

  -- Check if challenge is locked
  IF challenge_record.is_locked = true THEN
    RETURN json_build_object('success', false, 'error', 'Challenge is locked. Winners have been awarded.');
  END IF;

  -- Check user role
  IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND role IN ('teacher', 'admin')) THEN
    RETURN json_build_object('success', false, 'error', 'Only students can participate');
  END IF;

  -- Check existing participation
  SELECT * INTO existing_participation
  FROM daily_challenge_participations
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

  -- Enforce 3 attempt limit
  IF existing_participation IS NOT NULL AND existing_participation.attempts >= 3 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Maximum 3 attempts reached',
      'attempts_used', existing_participation.attempts
    );
  END IF;

  attempts_used := COALESCE(existing_participation.attempts, 0) + 1;

  -- Insert or update participation (track all attempts, but only update score if passing)
  INSERT INTO daily_challenge_participations (
    challenge_id, user_id, score, time_spent, attempts, completed_at
  ) VALUES (
    p_challenge_id, p_user_id, p_score, p_time_spent, attempts_used, NOW()
  )
  ON CONFLICT (challenge_id, user_id)
  DO UPDATE SET
    score = CASE
      WHEN EXCLUDED.score >= 75 THEN GREATEST(daily_challenge_participations.score, EXCLUDED.score)
      ELSE daily_challenge_participations.score
    END,
    time_spent = CASE
      WHEN EXCLUDED.score >= 75 AND EXCLUDED.score > daily_challenge_participations.score THEN EXCLUDED.time_spent
      WHEN EXCLUDED.score >= 75 AND EXCLUDED.score = daily_challenge_participations.score THEN
        LEAST(daily_challenge_participations.time_spent, EXCLUDED.time_spent)
      ELSE daily_challenge_participations.time_spent
    END,
    attempts = attempts_used,
    completed_at = NOW()
  RETURNING id INTO participation_id;

  -- Calculate rank (only for passing scores >= 75%)
  IF is_passing THEN
    SELECT COUNT(*) + 1 INTO user_rank
    FROM daily_challenge_participations
    WHERE challenge_id = p_challenge_id
      AND score >= 75
      AND (score > p_score OR (score = p_score AND time_spent < p_time_spent));

    -- Update cached rank
    UPDATE daily_challenge_participations
    SET rank_calculated = user_rank
    WHERE id = participation_id;
  ELSE
    user_rank := NULL;
  END IF;

  -- Insert individual attempt record (all attempts tracked)
  INSERT INTO daily_challenge_attempts (
    participation_id, challenge_id, user_id, attempt_number,
    score, started_at, completed_at, time_spent
  ) VALUES (
    participation_id,
    p_challenge_id,
    p_user_id,
    attempts_used,
    p_score,
    COALESCE(p_started_at, NOW() - (p_time_spent || ' seconds')::interval),
    NOW(),
    p_time_spent
  ) RETURNING id INTO new_attempt_id;

  -- Determine if this is the new best attempt (only for passing scores)
  IF is_passing AND (
     existing_participation IS NULL OR
     p_score > existing_participation.score OR
     (p_score = existing_participation.score AND p_time_spent < existing_participation.time_spent)
  ) THEN
    -- Update participation to point to this attempt as best
    UPDATE daily_challenge_participations
    SET best_attempt_id = new_attempt_id
    WHERE id = participation_id;
  END IF;

  -- Set first_attempt_at if this is the first attempt
  IF attempts_used = 1 THEN
    UPDATE daily_challenge_participations
    SET first_attempt_at = COALESCE(p_started_at, NOW() - (p_time_spent || ' seconds')::interval)
    WHERE id = participation_id;
  END IF;

  -- Award base rewards (only on first PASSING attempt with score >= 75%)
  IF is_passing AND attempts_used = 1 THEN
    UPDATE users
    SET xp = xp + challenge_record.base_xp_reward,
        gems = gems + challenge_record.base_gem_reward
    WHERE id = p_user_id;

    UPDATE daily_challenge_participations
    SET base_reward_claimed = true
    WHERE id = participation_id;

    base_xp := challenge_record.base_xp_reward;
    base_gems := challenge_record.base_gem_reward;
  ELSIF is_passing AND existing_participation IS NOT NULL AND existing_participation.score < 75 THEN
    -- First time passing (after previous failed attempts)
    UPDATE users
    SET xp = xp + challenge_record.base_xp_reward,
        gems = gems + challenge_record.base_gem_reward
    WHERE id = p_user_id;

    UPDATE daily_challenge_participations
    SET base_reward_claimed = true
    WHERE id = participation_id;

    base_xp := challenge_record.base_xp_reward;
    base_gems := challenge_record.base_gem_reward;
  ELSE
    base_xp := 0;
    base_gems := 0;
  END IF;

  RETURN json_build_object(
    'success', true,
    'is_passing', is_passing,
    'rank', user_rank,
    'score', p_score,
    'xp_awarded', base_xp,
    'gems_awarded', base_gems,
    'attempts_used', attempts_used,
    'attempts_remaining', 3 - attempts_used,
    'attempt_id', new_attempt_id
  );
END;
$$;

-- Update award_single_challenge_winners to lock the challenge
CREATE OR REPLACE FUNCTION award_single_challenge_winners(p_challenge_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_rec record;
  top1_user_id uuid;
  top2_user_id uuid;
  top3_user_id uuid;
  top1_xp integer;
  top1_gems integer;
  top2_xp integer;
  top2_gems integer;
  top3_xp integer;
  top3_gems integer;
  results json[];
BEGIN
  -- Get the challenge
  SELECT id, difficulty_level, top1_achievement_id, top2_achievement_id, top3_achievement_id, winners_awarded, is_locked
  INTO challenge_rec
  FROM daily_challenges
  WHERE id = p_challenge_id AND is_active = true;

  IF challenge_rec IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Challenge not found or inactive');
  END IF;

  IF challenge_rec.winners_awarded = true THEN
    RETURN json_build_object('success', false, 'error', 'Winners already awarded for this challenge');
  END IF;

  -- Get top 1 user
  SELECT user_id INTO top1_user_id
  FROM daily_challenge_participations
  WHERE challenge_id = challenge_rec.id AND score >= 75
  ORDER BY score DESC, time_spent ASC
  LIMIT 1;

  -- Get top 2 user (excluding top 1)
  SELECT user_id INTO top2_user_id
  FROM daily_challenge_participations
  WHERE challenge_id = challenge_rec.id
    AND score >= 75
    AND user_id != COALESCE(top1_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY score DESC, time_spent ASC
  LIMIT 1;

  -- Get top 3 user (excluding top 1 and top 2)
  SELECT user_id INTO top3_user_id
  FROM daily_challenge_participations
  WHERE challenge_id = challenge_rec.id
    AND score >= 75
    AND user_id != COALESCE(top1_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND user_id != COALESCE(top2_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY score DESC, time_spent ASC
  LIMIT 1;

  -- Award top 1
  IF top1_user_id IS NOT NULL AND challenge_rec.top1_achievement_id IS NOT NULL THEN
    -- Get achievement rewards
    SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
    INTO top1_xp, top1_gems
    FROM achievements
    WHERE id = challenge_rec.top1_achievement_id;

    -- Insert achievement record
    INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
    VALUES (top1_user_id, challenge_rec.top1_achievement_id, NOW(), NOW(), top1_xp);

    -- Award XP and gems
    UPDATE users
    SET xp = xp + top1_xp,
        gems = gems + top1_gems
    WHERE id = top1_user_id;

    results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 1, 'user_id', top1_user_id, 'xp', top1_xp, 'gems', top1_gems));
  END IF;

  -- Award top 2
  IF top2_user_id IS NOT NULL AND challenge_rec.top2_achievement_id IS NOT NULL THEN
    -- Get achievement rewards
    SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
    INTO top2_xp, top2_gems
    FROM achievements
    WHERE id = challenge_rec.top2_achievement_id;

    -- Insert achievement record
    INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
    VALUES (top2_user_id, challenge_rec.top2_achievement_id, NOW(), NOW(), top2_xp);

    -- Award XP and gems
    UPDATE users
    SET xp = xp + top2_xp,
        gems = gems + top2_gems
    WHERE id = top2_user_id;

    results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 2, 'user_id', top2_user_id, 'xp', top2_xp, 'gems', top2_gems));
  END IF;

  -- Award top 3
  IF top3_user_id IS NOT NULL AND challenge_rec.top3_achievement_id IS NOT NULL THEN
    -- Get achievement rewards
    SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
    INTO top3_xp, top3_gems
    FROM achievements
    WHERE id = challenge_rec.top3_achievement_id;

    -- Insert achievement record
    INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
    VALUES (top3_user_id, challenge_rec.top3_achievement_id, NOW(), NOW(), top3_xp);

    -- Award XP and gems
    UPDATE users
    SET xp = xp + top3_xp,
        gems = gems + top3_gems
    WHERE id = top3_user_id;

    results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 3, 'user_id', top3_user_id, 'xp', top3_xp, 'gems', top3_gems));
  END IF;

  -- Mark challenge as awarded AND locked
  UPDATE daily_challenges
  SET winners_awarded = true,
      is_locked = true
  WHERE id = p_challenge_id;

  RETURN json_build_object('success', true, 'awarded', results);
END;
$$;

-- Update award_daily_challenge_winners to lock challenges
CREATE OR REPLACE FUNCTION award_daily_challenge_winners()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yesterday_date date;
  challenge_rec record;
  top1_user_id uuid;
  top2_user_id uuid;
  top3_user_id uuid;
  top1_xp integer;
  top1_gems integer;
  top2_xp integer;
  top2_gems integer;
  top3_xp integer;
  top3_gems integer;
  results json[];
BEGIN
  yesterday_date := ((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 day')::date;

  -- Process each difficulty level's challenge
  FOR challenge_rec IN
    SELECT id, difficulty_level, top1_achievement_id, top2_achievement_id, top3_achievement_id
    FROM daily_challenges
    WHERE challenge_date = yesterday_date AND is_active = true AND winners_awarded = false
  LOOP
    -- Get top 1 user
    SELECT user_id INTO top1_user_id
    FROM daily_challenge_participations
    WHERE challenge_id = challenge_rec.id AND score >= 75
    ORDER BY score DESC, time_spent ASC
    LIMIT 1;

    -- Get top 2 user (excluding top 1)
    SELECT user_id INTO top2_user_id
    FROM daily_challenge_participations
    WHERE challenge_id = challenge_rec.id
      AND score >= 75
      AND user_id != COALESCE(top1_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY score DESC, time_spent ASC
    LIMIT 1;

    -- Get top 3 user (excluding top 1 and top 2)
    SELECT user_id INTO top3_user_id
    FROM daily_challenge_participations
    WHERE challenge_id = challenge_rec.id
      AND score >= 75
      AND user_id != COALESCE(top1_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND user_id != COALESCE(top2_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY score DESC, time_spent ASC
    LIMIT 1;

    -- Award top 1
    IF top1_user_id IS NOT NULL AND challenge_rec.top1_achievement_id IS NOT NULL THEN
      -- Get achievement rewards
      SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
      INTO top1_xp, top1_gems
      FROM achievements
      WHERE id = challenge_rec.top1_achievement_id;

      -- Insert achievement record
      INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
      VALUES (top1_user_id, challenge_rec.top1_achievement_id, NOW(), NOW(), top1_xp);

      -- Award XP and gems
      UPDATE users
      SET xp = xp + top1_xp,
          gems = gems + top1_gems
      WHERE id = top1_user_id;

      results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 1, 'user_id', top1_user_id, 'xp', top1_xp, 'gems', top1_gems));
    END IF;

    -- Award top 2
    IF top2_user_id IS NOT NULL AND challenge_rec.top2_achievement_id IS NOT NULL THEN
      -- Get achievement rewards
      SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
      INTO top2_xp, top2_gems
      FROM achievements
      WHERE id = challenge_rec.top2_achievement_id;

      -- Insert achievement record
      INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
      VALUES (top2_user_id, challenge_rec.top2_achievement_id, NOW(), NOW(), top2_xp);

      -- Award XP and gems
      UPDATE users
      SET xp = xp + top2_xp,
          gems = gems + top2_gems
      WHERE id = top2_user_id;

      results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 2, 'user_id', top2_user_id, 'xp', top2_xp, 'gems', top2_gems));
    END IF;

    -- Award top 3
    IF top3_user_id IS NOT NULL AND challenge_rec.top3_achievement_id IS NOT NULL THEN
      -- Get achievement rewards
      SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
      INTO top3_xp, top3_gems
      FROM achievements
      WHERE id = challenge_rec.top3_achievement_id;

      -- Insert achievement record
      INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
      VALUES (top3_user_id, challenge_rec.top3_achievement_id, NOW(), NOW(), top3_xp);

      -- Award XP and gems
      UPDATE users
      SET xp = xp + top3_xp,
          gems = gems + top3_gems
      WHERE id = top3_user_id;

      results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 3, 'user_id', top3_user_id, 'xp', top3_xp, 'gems', top3_gems));
    END IF;

    -- Mark challenge as awarded AND locked
    UPDATE daily_challenges
    SET winners_awarded = true,
        is_locked = true
    WHERE id = challenge_rec.id;
  END LOOP;

  RETURN json_build_object('success', true, 'awarded', results);
END;
$$;
