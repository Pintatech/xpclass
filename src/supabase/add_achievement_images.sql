-- Add image support to achievements table
ALTER TABLE public.achievements 
ADD COLUMN IF NOT EXISTS badge_image_url text,
ADD COLUMN IF NOT EXISTS badge_image_alt text DEFAULT 'Achievement Badge';

-- Add more detailed criteria support
ALTER TABLE public.achievements 
ADD COLUMN IF NOT EXISTS criteria_type text DEFAULT 'exercise_completed',
ADD COLUMN IF NOT EXISTS criteria_value integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS criteria_period text DEFAULT 'all_time'; -- 'daily', 'weekly', 'monthly', 'all_time'

-- Update existing achievements with better criteria structure
UPDATE public.achievements 
SET 
  criteria_type = CASE 
    WHEN title = 'First Steps' THEN 'exercise_completed'
    WHEN title = 'Learning Streak' THEN 'daily_streak'
    WHEN title = 'Pronunciation Master' THEN 'pronunciation_completed'
    WHEN title = 'Vocabulary Builder' THEN 'vocabulary_learned'
    WHEN title = 'Level Complete' THEN 'level_completed'
    ELSE 'exercise_completed'
  END,
  criteria_value = CASE 
    WHEN title = 'First Steps' THEN 1
    WHEN title = 'Learning Streak' THEN 3
    WHEN title = 'Pronunciation Master' THEN 10
    WHEN title = 'Vocabulary Builder' THEN 50
    WHEN title = 'Level Complete' THEN 1
    ELSE 1
  END
WHERE criteria_type = 'exercise_completed';

-- Insert some sample achievements with images
INSERT INTO public.achievements (title, description, icon, criteria, xp_reward, badge_color, badge_image_url, badge_image_alt, criteria_type, criteria_value, criteria_period) VALUES
('Người mới bắt đầu', 'Hoàn thành 5 bài tập đầu tiên', 'Star', '{"type": "exercise_completed", "count": 5}', 50, 'yellow', 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=200&h=200&fit=crop&crop=center', 'Người mới bắt đầu badge', 'exercise_completed', 5, 'all_time'),
('Học viên chăm chỉ', 'Học 7 ngày liên tiếp', 'Flame', '{"type": "daily_streak", "count": 7}', 100, 'red', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=center', 'Học viên chăm chỉ badge', 'daily_streak', 7, 'all_time'),
('Chiến binh XP', 'Đạt 1000 XP', 'Trophy', '{"type": "total_xp", "count": 1000}', 200, 'blue', 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&h=200&fit=crop&crop=center', 'Chiến binh XP badge', 'total_xp', 1000, 'all_time'),
('Kỷ lục gia', 'Hoàn thành 100 bài tập', 'Target', '{"type": "exercise_completed", "count": 100}', 500, 'green', 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=200&h=200&fit=crop&crop=center', 'Kỷ lục gia badge', 'exercise_completed', 100, 'all_time'),
('Thần tốc', 'Hoàn thành 10 bài tập trong 1 ngày', 'Zap', '{"type": "daily_exercises", "count": 10}', 300, 'purple', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop&crop=center', 'Thần tốc badge', 'daily_exercises', 10, 'daily'),
('Học giả', 'Đạt 5000 XP', 'BookOpen', '{"type": "total_xp", "count": 5000}', 1000, 'indigo', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop&crop=center', 'Học giả badge', 'total_xp', 5000, 'all_time');

-- Create function to check and award achievements
CREATE OR REPLACE FUNCTION check_and_award_achievements(user_id_param uuid)
RETURNS TABLE(achievement_id uuid, title text, description text, xp_reward integer) AS $$
DECLARE
    achievement_record RECORD;
    user_stats RECORD;
    earned_count INTEGER;
BEGIN
    -- Get user statistics
    SELECT 
        COALESCE(COUNT(up.id) FILTER (WHERE up.status = 'completed'), 0) as completed_exercises,
        COALESCE(SUM(up.xp_earned), 0) as total_xp,
        COALESCE(u.streak_count, 0) as current_streak,
        COALESCE(COUNT(up.id) FILTER (WHERE up.completed_at::date = CURRENT_DATE), 0) as daily_exercises
    INTO user_stats
    FROM public.users u
    LEFT JOIN public.user_progress up ON u.id = up.user_id
    WHERE u.id = user_id_param
    GROUP BY u.id, u.streak_count;

    -- Check each active achievement
    FOR achievement_record IN 
        SELECT * FROM public.achievements WHERE is_active = true
    LOOP
        -- Check if user already has this achievement
        SELECT COUNT(*) INTO earned_count
        FROM public.user_achievements 
        WHERE user_id = user_id_param AND achievement_id = achievement_record.id;

        -- If not earned, check criteria
        IF earned_count = 0 THEN
            CASE achievement_record.criteria_type
                WHEN 'exercise_completed' THEN
                    IF user_stats.completed_exercises >= achievement_record.criteria_value THEN
                        INSERT INTO public.user_achievements (user_id, achievement_id)
                        VALUES (user_id_param, achievement_record.id);
                        
                        -- Update user XP
                        UPDATE public.users 
                        SET xp = xp + achievement_record.xp_reward
                        WHERE id = user_id_param;
                        
                        RETURN QUERY SELECT 
                            achievement_record.id,
                            achievement_record.title,
                            achievement_record.description,
                            achievement_record.xp_reward;
                    END IF;
                    
                WHEN 'total_xp' THEN
                    IF user_stats.total_xp >= achievement_record.criteria_value THEN
                        INSERT INTO public.user_achievements (user_id, achievement_id)
                        VALUES (user_id_param, achievement_record.id);
                        
                        UPDATE public.users 
                        SET xp = xp + achievement_record.xp_reward
                        WHERE id = user_id_param;
                        
                        RETURN QUERY SELECT 
                            achievement_record.id,
                            achievement_record.title,
                            achievement_record.description,
                            achievement_record.xp_reward;
                    END IF;
                    
                WHEN 'daily_streak' THEN
                    IF user_stats.current_streak >= achievement_record.criteria_value THEN
                        INSERT INTO public.user_achievements (user_id, achievement_id)
                        VALUES (user_id_param, achievement_record.id);
                        
                        UPDATE public.users 
                        SET xp = xp + achievement_record.xp_reward
                        WHERE id = user_id_param;
                        
                        RETURN QUERY SELECT 
                            achievement_record.id,
                            achievement_record.title,
                            achievement_record.description,
                            achievement_record.xp_reward;
                    END IF;
                    
                WHEN 'daily_exercises' THEN
                    IF user_stats.daily_exercises >= achievement_record.criteria_value THEN
                        INSERT INTO public.user_achievements (user_id, achievement_id)
                        VALUES (user_id_param, achievement_record.id);
                        
                        UPDATE public.users 
                        SET xp = xp + achievement_record.xp_reward
                        WHERE id = user_id_param;
                        
                        RETURN QUERY SELECT 
                            achievement_record.id,
                            achievement_record.title,
                            achievement_record.description,
                            achievement_record.xp_reward;
                    END IF;
            END CASE;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_and_award_achievements(uuid) TO authenticated;

