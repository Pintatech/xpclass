-- Create Student Levels Table for XP Requirements and Badges
-- This replaces the hardcoded 1000 XP per level system

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.student_levels;

-- Create student_levels table
CREATE TABLE public.student_levels (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  level_number integer NOT NULL UNIQUE, -- 1, 2, 3, 4, etc.
  xp_required integer NOT NULL, -- Total XP needed to reach this level
  xp_range_min integer NOT NULL, -- Minimum XP for this level
  xp_range_max integer NOT NULL, -- Maximum XP for this level (before next level)

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

-- Enable RLS
ALTER TABLE public.student_levels ENABLE ROW LEVEL SECURITY;

-- Create policy for reading levels (all authenticated users can read)
CREATE POLICY "Student levels readable by authenticated users"
ON public.student_levels FOR SELECT
USING (auth.role() = 'authenticated');

-- Create policy for managing levels (only admins can modify)
CREATE POLICY "Student levels manageable by admins"
ON public.student_levels FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_student_levels_updated_at
BEFORE UPDATE ON public.student_levels
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Insert initial level data with progressive XP requirements
INSERT INTO public.student_levels (
  level_number,
  xp_required,
  xp_range_min,
  xp_range_max,
  badge_name,
  badge_tier,
  badge_icon,
  badge_color,
  badge_description,
  title_unlocked,
  perks_unlocked
) VALUES
-- Bronze Tier (Beginner)
(1, 0, 0, 499, 'Newcomer', 'bronze', '🌱', '#CD7F32', 'Welcome to your learning journey!', 'Học viên mới', '["basic_exercises"]'),
(2, 500, 500, 999, 'Rookie', 'bronze', '⭐', '#CD7F32', 'You are getting the hang of it!', 'Tân binh', '["basic_exercises", "progress_tracking"]'),
(3, 1000, 1000, 1999, 'Learner', 'bronze', '📚', '#CD7F32', 'Building solid foundations', 'Học sinh', '["basic_exercises", "progress_tracking", "achievements"]'),

-- Silver Tier (Intermediate)
(4, 2000, 2000, 3499, 'Scholar', 'silver', '🎓', '#C0C0C0', 'Demonstrating consistent progress', 'Học giả', '["intermediate_exercises", "custom_study_plans"]'),
(5, 3500, 3500, 5499, 'Achiever', 'silver', '🏆', '#C0C0C0', 'Reaching new heights in learning', 'Người đạt thành tích', '["intermediate_exercises", "custom_study_plans", "bonus_xp"]'),
(6, 5500, 5500, 7999, 'Advanced', 'silver', '💪', '#C0C0C0', 'Advanced learner with dedication', 'Nâng cao', '["advanced_exercises", "mentoring_access"]'),

-- Gold Tier (Expert)
(7, 8000, 8000, 11499, 'Expert', 'gold', '⚡', '#FFD700', 'Expert level knowledge and skills', 'Chuyên gia', '["expert_exercises", "priority_support"]'),
(8, 11500, 11500, 15999, 'Master', 'gold', '👑', '#FFD700', 'Mastery of the subject matter', 'Thạc sĩ', '["master_exercises", "exclusive_content"]'),
(9, 16000, 16000, 21999, 'Legend', 'gold', '🌟', '#FFD700', 'Legendary dedication and skill', 'Huyền thoại', '["legendary_exercises", "teaching_tools"]'),

-- Platinum Tier (Elite)
(10, 22000, 22000, 29999, 'Elite', 'platinum', '💎', '#E5E4E2', 'Among the elite learners', 'Ưu tú', '["elite_exercises", "custom_challenges"]'),
(11, 30000, 30000, 39999, 'Champion', 'platinum', '🏅', '#E5E4E2', 'Champion of learning excellence', 'Nhà vô địch', '["champion_exercises", "leaderboard_privileges"]'),
(12, 40000, 40000, 54999, 'Grandmaster', 'platinum', '⚔️', '#E5E4E2', 'Grandmaster of knowledge', 'Đại sư', '["grandmaster_exercises", "community_leadership"]'),

-- Diamond Tier (Legendary)
(13, 55000, 55000, 74999, 'Sage', 'diamond', '🧙‍♂️', '#B9F2FF', 'Wisdom beyond measure', 'Hiền nhân', '["sage_exercises", "exclusive_events"]'),
(14, 75000, 75000, 99999, 'Immortal', 'diamond', '✨', '#B9F2FF', 'Immortal dedication to learning', 'Bất tử', '["immortal_exercises", "hall_of_fame"]'),
(15, 100000, 100000, 999999, 'Transcendent', 'diamond', '🔮', '#B9F2FF', 'Transcended the boundaries of learning', 'Siêu việt', '["transcendent_exercises", "ultimate_privileges"]');

-- Create function to get user level based on XP
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
  WHERE user_xp >= sl.xp_range_min
    AND user_xp <= sl.xp_range_max
    AND sl.is_active = true
  ORDER BY sl.level_number DESC
  LIMIT 1;
END;
$$;

-- Create function to get next level info
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
  -- Get current level
  SELECT * INTO current_lvl
  FROM public.student_levels
  WHERE user_xp >= xp_range_min
    AND user_xp <= xp_range_max
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
        ROUND((user_xp - current_lvl.xp_range_min)::numeric / (next_lvl.xp_required - current_lvl.xp_range_min)::numeric * 100, 2)
      ELSE 100.0
    END as progress_percentage;
END;
$$;

-- Create index for performance
CREATE INDEX idx_student_levels_xp_range ON public.student_levels(xp_range_min, xp_range_max);
CREATE INDEX idx_student_levels_level_number ON public.student_levels(level_number);

-- Grant permissions
GRANT SELECT ON public.student_levels TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_level(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_level_info(integer) TO authenticated;