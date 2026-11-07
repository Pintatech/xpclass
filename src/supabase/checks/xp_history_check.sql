-- XP check, READ-ONLY: it changes nothing.
-- There is no XP log yet (that is step 5b), so this rebuilds where each account's XP came from, out of the tables
-- that record rewards, and compares it with the XP the account has now.
--
-- The file has 4 queries. The SQL editor shows only the last result, so select one query (from its "-- A." line to
-- its semicolon) and press Run, then the next. "Download CSV" works for each.
--
-- How to read query A:
--   xp_now           what the account has now (users.xp)
--   xp_explained     sum of the rewards found in the tables below
--   xp_not_explained xp_now - xp_explained. Large and positive = XP that came from somewhere the tables do not record:
--                    legitimately missions, chest contents, leaderboard and tournament prizes, Class War, a teacher's
--                    class-report bonus, admin gifts; or a student writing their own XP from F12.
--                    Negative = XP spent (tournament fees, eggs and balls bought with XP, a declined PvP challenge).
--   Look at the top rows, compare them with how many exercises they did and how old the account is.
-- Sources counted: exercises (user_progress.xp_earned), lesson chests (session_reward_claims), achievements
-- (user_achievements.xp_claimed), PvP wins (10 each), Live Battle (live_battle_participants.xp_awarded), gift codes
-- (giftcode_redemptions.rewards_granted->'xp'), daily challenges (base_xp_reward when the score is 75 or more).


-- A. Every account: XP now, XP explained by the reward tables, and the difference. Biggest difference first.
WITH ex AS (
  SELECT user_id, sum(COALESCE(xp_earned, 0)) AS xp, count(*) FILTER (WHERE status = 'completed') AS done,
         max(COALESCE(xp_earned, 0)) AS biggest
  FROM public.user_progress GROUP BY user_id
), ch AS (
  SELECT user_id, sum(COALESCE(xp_awarded, 0)) AS xp, sum(COALESCE(gems_awarded, 0)) AS gems, count(*) AS n
  FROM public.session_reward_claims GROUP BY user_id
), ach AS (
  SELECT user_id, sum(COALESCE(xp_claimed, 0)) AS xp FROM public.user_achievements GROUP BY user_id
), pvp AS (
  SELECT winner_id AS user_id, count(*) * 10 AS xp FROM public.pvp_challenges
  WHERE status = 'completed' AND winner_id IS NOT NULL GROUP BY winner_id
), lb AS (
  SELECT user_id, sum(COALESCE(xp_awarded, 0)) AS xp FROM public.live_battle_participants GROUP BY user_id
), gift AS (
  SELECT user_id, sum(CASE WHEN jsonb_typeof(rewards_granted -> 'xp') = 'number' THEN (rewards_granted ->> 'xp')::numeric ELSE 0 END) AS xp
  FROM public.giftcode_redemptions GROUP BY user_id
), dc AS (
  SELECT p.user_id, sum(CASE WHEN p.score >= 75 THEN COALESCE(c.base_xp_reward, 0) ELSE 0 END) AS xp
  FROM public.daily_challenge_participations p JOIN public.daily_challenges c ON c.id = p.challenge_id
  GROUP BY p.user_id
), sums AS (
  SELECT u.id,
         COALESCE(ex.xp, 0) AS xp_exercises, COALESCE(ex.done, 0) AS exercises_done, COALESCE(ex.biggest, 0) AS biggest_exercise_xp,
         COALESCE(ch.xp, 0) AS xp_lesson_chests, COALESCE(ch.gems, 0) AS gems_lesson_chests,
         COALESCE(ach.xp, 0) AS xp_achievements, COALESCE(pvp.xp, 0) AS xp_pvp_wins, COALESCE(lb.xp, 0) AS xp_live_battle,
         COALESCE(gift.xp, 0) AS xp_giftcodes, COALESCE(dc.xp, 0) AS xp_daily_challenge
  FROM public.users u
  LEFT JOIN ex ON ex.user_id = u.id LEFT JOIN ch ON ch.user_id = u.id LEFT JOIN ach ON ach.user_id = u.id
  LEFT JOIN pvp ON pvp.user_id = u.id LEFT JOIN lb ON lb.user_id = u.id LEFT JOIN gift ON gift.user_id = u.id
  LEFT JOIN dc ON dc.user_id = u.id
)
SELECT u.username, u.full_name, u.role,
       u.xp AS xp_now, u.gems AS gems_now, u.level,
       s.xp_exercises + s.xp_lesson_chests + s.xp_achievements + s.xp_pvp_wins + s.xp_live_battle + s.xp_giftcodes + s.xp_daily_challenge AS xp_explained,
       u.xp - (s.xp_exercises + s.xp_lesson_chests + s.xp_achievements + s.xp_pvp_wins + s.xp_live_battle + s.xp_giftcodes + s.xp_daily_challenge) AS xp_not_explained,
       s.exercises_done, (current_date - u.created_at::date) AS account_age_days,
       round(u.xp::numeric / GREATEST(current_date - u.created_at::date, 1)) AS xp_per_day,
       s.xp_exercises, s.biggest_exercise_xp, s.xp_lesson_chests, s.xp_achievements, s.xp_pvp_wins, s.xp_live_battle,
       s.xp_giftcodes, s.xp_daily_challenge, s.gems_lesson_chests,
       u.created_at::date AS signed_up, u.updated_at AS row_last_changed
FROM public.users u
JOIN sums s ON s.id = u.id
ORDER BY xp_not_explained DESC
LIMIT 100;


-- B. The biggest days of exercise XP in the last 60 days (Vietnam time). Many exercises in one day is normal before a
--    test; a huge XP total from few exercises is not.
SELECT u.username, u.full_name, u.role,
       (up.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
       count(*) AS exercises, sum(COALESCE(up.xp_earned, 0)) AS xp_from_exercises,
       max(COALESCE(up.xp_earned, 0)) AS biggest_one,
       round(sum(COALESCE(up.xp_earned, 0))::numeric / count(*), 1) AS xp_per_exercise
FROM public.user_progress up
JOIN public.users u ON u.id = up.user_id
WHERE up.status = 'completed' AND up.completed_at > now() - interval '60 days'
GROUP BY u.username, u.full_name, u.role, (up.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
ORDER BY xp_from_exercises DESC
LIMIT 100;


-- C. The same reward taken more than once: an achievement claimed several times (in the same week, for the weekly
--    ones), or a lesson chest claimed several times for the same lesson. Each should happen once.
SELECT 'achievement claimed more than once' AS what, u.username, u.full_name,
       COALESCE(a.title, ua.achievement_id::text) || COALESCE(' (week of ' || ua.week_start || ')', '') AS reward,
       count(*) AS times, sum(COALESCE(ua.xp_claimed, 0)) AS xp_total,
       min(ua.earned_at) AS first_time, max(ua.earned_at) AS last_time
FROM public.user_achievements ua
JOIN public.users u ON u.id = ua.user_id
LEFT JOIN public.achievements a ON a.id = ua.achievement_id
GROUP BY u.username, u.full_name, a.title, ua.user_id, ua.achievement_id, ua.week_start
HAVING count(*) > 1
UNION ALL
SELECT 'lesson chest claimed more than once', u.username, u.full_name,
       COALESCE(se.title, rc.session_id::text), count(*), sum(COALESCE(rc.xp_awarded, 0)),
       min(rc.claimed_at), max(rc.claimed_at)
FROM public.session_reward_claims rc
JOIN public.users u ON u.id = rc.user_id
LEFT JOIN public.sessions se ON se.id = rc.session_id
GROUP BY u.username, u.full_name, COALESCE(se.title, rc.session_id::text), rc.user_id, rc.session_id
HAVING count(*) > 1
ORDER BY xp_total DESC
LIMIT 100;


-- D. The single biggest XP rows: one exercise, one lesson chest or one achievement worth much more than usual.
SELECT * FROM (
  SELECT 'exercise' AS source, u.username, u.full_name, COALESCE(up.exercise_title, up.exercise_id::text) AS what,
         up.xp_earned AS xp, up.completed_at AS at
  FROM public.user_progress up JOIN public.users u ON u.id = up.user_id
  WHERE COALESCE(up.xp_earned, 0) > 0
  UNION ALL
  SELECT 'lesson chest', u.username, u.full_name, COALESCE(se.title, rc.session_id::text), rc.xp_awarded, rc.claimed_at
  FROM public.session_reward_claims rc JOIN public.users u ON u.id = rc.user_id
  LEFT JOIN public.sessions se ON se.id = rc.session_id
  WHERE COALESCE(rc.xp_awarded, 0) > 0
  UNION ALL
  SELECT 'achievement', u.username, u.full_name, COALESCE(ua.achievement_name, ua.achievement_id::text), ua.xp_claimed, ua.claimed_at
  FROM public.user_achievements ua JOIN public.users u ON u.id = ua.user_id
  WHERE COALESCE(ua.xp_claimed, 0) > 0
) x
ORDER BY xp DESC
LIMIT 100;
