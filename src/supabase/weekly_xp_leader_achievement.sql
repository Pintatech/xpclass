-- Create table to track weekly XP totals
CREATE TABLE IF NOT EXISTS weekly_xp_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_xp INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_weekly_xp_tracking_user_id ON weekly_xp_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_xp_tracking_week_start ON weekly_xp_tracking(week_start_date);

-- Enable RLS
ALTER TABLE weekly_xp_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all weekly XP tracking"
  ON weekly_xp_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert weekly XP tracking"
  ON weekly_xp_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update weekly XP tracking"
  ON weekly_xp_tracking FOR UPDATE
  TO authenticated
  USING (true);

-- Insert the Weekly XP Leader achievement
INSERT INTO achievements (
  title,
  description,
  icon,
  criteria,
  criteria_type,
  criteria_value,
  criteria_period,
  xp_reward,
  badge_color,
  badge_image_url,
  badge_image_alt,
  is_active
) VALUES (
  '🏆 Nhà vô địch tuần',
  'Đạt XP cao nhất trong tuần',
  'Crown',
  '{"type": "weekly_xp_leader", "count": 1}',
  'weekly_xp_leader',
  1,
  'weekly',
  500,
  'yellow',
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=200&h=200&fit=crop&crop=center',
  'Weekly XP Leader badge',
  true
)
ON CONFLICT DO NOTHING;

-- Function to track weekly XP for a user
CREATE OR REPLACE FUNCTION track_weekly_xp()
RETURNS TRIGGER AS $$
DECLARE
  week_start DATE;
  week_end DATE;
BEGIN
  -- Calculate the start of the current week (Monday)
  week_start := DATE_TRUNC('week', NEW.completed_at::DATE);
  week_end := week_start + INTERVAL '6 days';

  -- Insert or update weekly XP tracking
  INSERT INTO weekly_xp_tracking (user_id, week_start_date, week_end_date, total_xp)
  VALUES (NEW.user_id, week_start, week_end, NEW.xp_earned)
  ON CONFLICT (user_id, week_start_date)
  DO UPDATE SET
    total_xp = weekly_xp_tracking.total_xp + NEW.xp_earned;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to track weekly XP when user progress is updated
DROP TRIGGER IF EXISTS trigger_track_weekly_xp ON user_progress;
CREATE TRIGGER trigger_track_weekly_xp
  AFTER INSERT OR UPDATE ON user_progress
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.xp_earned > 0)
  EXECUTE FUNCTION track_weekly_xp();

-- Function to award weekly XP leader achievement
CREATE OR REPLACE FUNCTION award_weekly_xp_leader()
RETURNS void AS $$
DECLARE
  last_week_start DATE;
  last_week_end DATE;
  winner_record RECORD;
  achievement_record RECORD;
BEGIN
  -- Calculate last week's dates (Monday to Sunday)
  last_week_start := DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days');
  last_week_end := last_week_start + INTERVAL '6 days';

  -- Get the achievement record
  SELECT * INTO achievement_record
  FROM achievements
  WHERE criteria_type = 'weekly_xp_leader'
  AND is_active = true
  LIMIT 1;

  IF achievement_record IS NULL THEN
    RAISE NOTICE 'Weekly XP Leader achievement not found or not active';
    RETURN;
  END IF;

  -- Find the user with the highest XP for last week
  SELECT
    user_id,
    total_xp,
    week_start_date,
    week_end_date
  INTO winner_record
  FROM weekly_xp_tracking
  WHERE week_start_date = last_week_start
  ORDER BY total_xp DESC, created_at ASC
  LIMIT 1;

  -- If we found a winner
  IF winner_record IS NOT NULL AND winner_record.total_xp > 0 THEN
    -- Check if the user already has this achievement for this week
    IF NOT EXISTS (
      SELECT 1 FROM user_achievements
      WHERE user_id = winner_record.user_id
      AND achievement_id = achievement_record.id
      AND earned_at >= last_week_start
      AND earned_at <= last_week_end + INTERVAL '7 days'
    ) THEN
      -- Award the achievement
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (winner_record.user_id, achievement_record.id);

      -- Award XP reward
      UPDATE users
      SET xp = xp + achievement_record.xp_reward
      WHERE id = winner_record.user_id;

      RAISE NOTICE 'Weekly XP Leader achievement awarded to user % with % XP',
        winner_record.user_id, winner_record.total_xp;
    END IF;
  ELSE
    RAISE NOTICE 'No winner found for week starting %', last_week_start;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION track_weekly_xp() TO authenticated;
GRANT EXECUTE ON FUNCTION award_weekly_xp_leader() TO authenticated;

-- NOTE: To run this weekly automatically, you need to set up a cron job in Supabase:
-- 1. Go to Supabase Dashboard > Database > Extensions
-- 2. Enable pg_cron extension
-- 3. Run the following command:
/*
SELECT cron.schedule(
  'award-weekly-xp-leader',
  '0 0 * * 1',  -- Every Monday at midnight
  $$ SELECT award_weekly_xp_leader(); $$
);
*/

-- Manual execution (for testing):
-- SELECT award_weekly_xp_leader();
