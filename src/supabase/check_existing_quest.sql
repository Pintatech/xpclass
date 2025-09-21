-- Check your existing daily quest for today

-- Find your existing quest
SELECT
    dq.*,
    e.title as exercise_title,
    e.exercise_type,
    s.title as session_title,
    u.title as unit_title,
    l.title as level_title
FROM public.daily_quests dq
LEFT JOIN public.exercises e ON dq.exercise_id = e.id
LEFT JOIN public.sessions s ON dq.session_id = s.id
LEFT JOIN public.units u ON s.unit_id = u.id
LEFT JOIN public.levels l ON u.level_id = l.id
WHERE dq.quest_date = CURRENT_DATE
ORDER BY dq.created_at DESC;