-- Migration Script: Convert to Simplified Student Levels
-- This script migrates from the old schema (with xp_range_min/max) to the new simplified schema

-- Step 1: Create backup of existing data
CREATE TABLE IF NOT EXISTS public.student_levels_backup AS 
SELECT * FROM public.student_levels;

-- Step 2: Drop existing functions that depend on the old schema
DROP FUNCTION IF EXISTS get_user_level(integer);
DROP FUNCTION IF EXISTS get_next_level_info(integer);

-- Step 3: Drop existing table
DROP TABLE IF EXISTS public.student_levels CASCADE;

-- Step 4: Create new simplified table
CREATE TABLE public.student_levels (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  level_number integer NOT NULL UNIQUE, -- 1, 2, 3, 4, etc.
  xp_required integer NOT NULL, -- Total XP needed to reach this level

  -- Badge Information
  badge_name text NOT NULL, -- "Rookie", "Scholar", "Master", etc.
  badge_tier text NOT NULL CHECK (badge_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  badge_icon text, -- Emoji or icon name
  badge_color text NOT NULL, -- CSS color for badge
  badge_description text, -- Description of what this level represents

  -- Rewards and Perks
  title_unlocked text, -- Special title student gets at this level
  perks_unlocked jsonb, -- JSON array of perks/features unlocked

  -- Metadata
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 5: Enable RLS
ALTER TABLE public.student_levels ENABLE ROW LEVEL SECURITY;

-- Step 6: Create policies
CREATE POLICY "Student levels readable by authenticated users"
ON public.student_levels FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Student levels manageable by admins"
ON public.student_levels FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Step 7: Create trigger for updated_at
CREATE TRIGGER update_student_levels_updated_at
BEFORE UPDATE ON public.student_levels
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Step 8: Insert data using xp_required from backup (or use default values)
INSERT INTO public.student_levels (
  level_number,
  xp_required,
  badge_name,
  badge_tier,
  badge_icon,
  badge_color,
  badge_description,
  title_unlocked,
  perks_unlocked
) VALUES
-- Bronze Tier (Beginner)
(1, 0, 'Newcomer', 'bronze', '🌱', '#CD7F32', 'Welcome to your learning journey!', 'Học viên mới', '["basic_exercises"]'),
(2, 500, 'Rookie', 'bronze', '⭐', '#CD7F32', 'You are getting the hang of it!', 'Tân binh', '["basic_exercises", "progress_tracking"]'),
(3, 1000, 'Learner', 'bronze', '📚', '#CD7F32', 'Building solid foundations', 'Học sinh', '["basic_exercises", "progress_tracking", "achievements"]'),

-- Silver Tier (Intermediate)
(4, 2000, 'Scholar', 'silver', '🎓', '#C0C0C0', 'Demonstrating consistent progress', 'Học giả', '["intermediate_exercises", "custom_study_plans"]'),
(5, 3500, 'Achiever', 'silver', '🏆', '#C0C0C0', 'Reaching new heights in learning', 'Người đạt thành tích', '["intermediate_exercises", "custom_study_plans", "bonus_xp"]'),
(6, 5500, 'Advanced', 'silver', '💪', '#C0C0C0', 'Advanced learner with dedication', 'Nâng cao', '["advanced_exercises", "mentoring_access"]'),

-- Gold Tier (Expert)
(7, 8000, 'Expert', 'gold', '⚡', '#FFD700', 'Expert level knowledge and skills', 'Chuyên gia', '["expert_exercises", "priority_support"]'),
(8, 11500, 'Master', 'gold', '👑', '#FFD700', 'Mastery of the subject matter', 'Thạc sĩ', '["master_exercises", "exclusive_content"]'),
(9, 16000, 'Legend', 'gold', '🌟', '#FFD700', 'Legendary dedication and skill', 'Huyền thoại', '["legendary_exercises", "teaching_tools"]'),

-- Platinum Tier (Elite)
(10, 22000, 'Elite', 'platinum', '💎', '#E5E4E2', 'Among the elite learners', 'Ưu tú', '["elite_exercises", "custom_challenges"]'),
(11, 30000, 'Champion', 'platinum', '🏅', '#E5E4E2', 'Champion of learning excellence', 'Nhà vô địch', '["champion_exercises", "leaderboard_privileges"]'),
(12, 40000, 'Grandmaster', 'platinum', '⚔️', '#E5E4E2', 'Grandmaster of knowledge', 'Đại sư', '["grandmaster_exercises", "community_leadership"]'),

-- Diamond Tier (Legendary)
(13, 55000, 'Sage', 'diamond', '🧙‍♂️', '#B9F2FF', 'Wisdom beyond measure', 'Hiền nhân', '["sage_exercises", "exclusive_events"]'),
(14, 75000, 'Immortal', 'diamond', '✨', '#B9F2FF', 'Immortal dedication to learning', 'Bất tử', '["immortal_exercises", "hall_of_fame"]'),
(15, 100000, 'Transcendent', 'diamond', '🔮', '#B9F2FF', 'Transcended the boundaries of learning', 'Siêu việt', '["transcendent_exercises", "ultimate_privileges"]');

-- Step 9: Create new simplified functions
CREATE OR REPLACE FUNCTION get_user_level(user_xp integer)
RETURNS TABLE(
  level_info json
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT row_to_json(sl.*) as level_info
  FROM public.student_levels sl
  WHERE sl.xp_required <= user_xp
    AND sl.is_active = true
  ORDER BY sl.level_number DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION get_next_level_info(user_xp integer)
RETURNS TABLE(
  current_level json,
  next_level json,
  xp_needed integer,
  progress_percentage numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_lvl public.student_levels;
  next_lvl public.student_levels;
BEGIN
  -- Get current level (highest level where xp_required <= user_xp)
  SELECT * INTO current_lvl
  FROM public.student_levels
  WHERE xp_required <= user_xp
    AND is_active = true
  ORDER BY level_number DESC
  LIMIT 1;

  -- Get next level
  SELECT * INTO next_lvl
  FROM public.student_levels
  WHERE level_number = current_lvl.level_number + 1
    AND is_active = true;

  -- Calculate progress
  RETURN QUERY
  SELECT
    row_to_json(current_lvl) as current_level,
    row_to_json(next_lvl) as next_level,
    CASE
      WHEN next_lvl.xp_required IS NOT NULL THEN next_lvl.xp_required - user_xp
      ELSE 0
    END as xp_needed,
    CASE
      WHEN next_lvl.xp_required IS NOT NULL THEN
        ROUND((user_xp - current_lvl.xp_required)::numeric / (next_lvl.xp_required - current_lvl.xp_required)::numeric * 100, 2)
      ELSE 100.0
    END as progress_percentage;
END;
$$;

-- Step 10: Create indexes for performance
CREATE INDEX idx_student_levels_xp_required ON public.student_levels(xp_required);
CREATE INDEX idx_student_levels_level_number ON public.student_levels(level_number);

-- Step 11: Grant permissions
GRANT SELECT ON public.student_levels TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_level(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_level_info(integer) TO authenticated;

-- Step 12: Verify migration
DO $$
DECLARE
  level_count integer;
BEGIN
  SELECT COUNT(*) INTO level_count FROM public.student_levels;
  RAISE NOTICE 'Migration completed successfully! Created % levels.', level_count;
END;
$$;
