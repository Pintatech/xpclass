-- Fix the CASE statement in check_and_award_achievements function
-- Add missing ELSE clause

DROP FUNCTION IF EXISTS check_and_award_achievements(uuid);

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

    -- If no user found, return empty
    IF user_stats IS NULL THEN
        RETURN;
    END IF;

    -- Check each active achievement
    FOR achievement_record IN
        SELECT * FROM public.achievements WHERE is_active = true
    LOOP
        -- Check if user already has this achievement
        SELECT COUNT(*) INTO earned_count
        FROM public.user_achievements
        WHERE user_id = user_id_param AND user_achievements.achievement_id = achievement_record.id;

        -- If not earned, check criteria
        IF earned_count = 0 THEN
            CASE achievement_record.criteria_type
                WHEN 'exercise_completed' THEN
                    IF user_stats.completed_exercises >= achievement_record.criteria_value THEN
                        INSERT INTO public.user_achievements (user_id, achievement_id, xp_claimed)
                        VALUES (user_id_param, achievement_record.id, achievement_record.xp_reward);

                        RETURN QUERY SELECT
                            achievement_record.id,
                            achievement_record.title,
                            achievement_record.description,
                            achievement_record.xp_reward;
                    END IF;

                WHEN 'total_xp' THEN
                    IF user_stats.total_xp >= achievement_record.criteria_value THEN
                        INSERT INTO public.user_achievements (user_id, achievement_id, xp_claimed)
                        VALUES (user_id_param, achievement_record.id, achievement_record.xp_reward);

                        RETURN QUERY SELECT
                            achievement_record.id,
                            achievement_record.title,
                            achievement_record.description,
                            achievement_record.xp_reward;
                    END IF;

                WHEN 'daily_streak' THEN
                    IF user_stats.current_streak >= achievement_record.criteria_value THEN
                        INSERT INTO public.user_achievements (user_id, achievement_id, xp_claimed)
                        VALUES (user_id_param, achievement_record.id, achievement_record.xp_reward);

                        RETURN QUERY SELECT
                            achievement_record.id,
                            achievement_record.title,
                            achievement_record.description,
                            achievement_record.xp_reward;
                    END IF;

                WHEN 'daily_exercises' THEN
                    IF user_stats.daily_exercises >= achievement_record.criteria_value THEN
                        INSERT INTO public.user_achievements (user_id, achievement_id, xp_claimed)
                        VALUES (user_id_param, achievement_record.id, achievement_record.xp_reward);

                        RETURN QUERY SELECT
                            achievement_record.id,
                            achievement_record.title,
                            achievement_record.description,
                            achievement_record.xp_reward;
                    END IF;
                ELSE
                    -- Handle unknown criteria types - do nothing
                    NULL;
            END CASE;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_and_award_achievements(uuid) TO authenticated;