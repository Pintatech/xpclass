-- Reset all achievements to unclaimed status
-- This allows users to manually claim XP from previously earned achievements

UPDATE public.user_achievements
SET claimed_at = NULL
WHERE claimed_at IS NOT NULL;

-- Optional: Also reset XP to remove auto-awarded XP
-- (uncomment if you want to reset user XP and let them reclaim)
-- UPDATE public.users
-- SET xp = 0
-- WHERE xp > 0;

-- Show current achievement status
SELECT
    u.full_name,
    a.title,
    ua.earned_at,
    ua.claimed_at,
    ua.xp_claimed,
    a.xp_reward
FROM public.user_achievements ua
JOIN public.users u ON ua.user_id = u.id
JOIN public.achievements a ON ua.achievement_id = a.id
ORDER BY ua.earned_at DESC;