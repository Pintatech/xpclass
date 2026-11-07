-- XP and gems report from public.currency_ledger (migrations/add_currency_ledger.sql). READ-ONLY.
-- Select one query (from its "-- A." line to its semicolon) and press Run; the SQL editor shows only the last result.
-- Days are Vietnam days. Change '7 days' / '30 days' to look further back.
-- "source": /rpc/<function> = a reward function; /users = a direct write to the users row from the browser (until
-- step 5c the app itself does this for lesson chests, achievement claims and XP from exercises); empty = the server
-- (SQL editor, pg_cron). "actor" is who made the call: the student, a teacher or admin, or nobody (the server).


-- A. Who gained the most XP in the last 7 days, and from where.
WITH per_source AS (
  SELECT l.user_id, COALESCE(l.source, '(server)') AS source,
         sum(l.xp_change) FILTER (WHERE l.xp_change > 0) AS xp_in,
         sum(l.gems_change) FILTER (WHERE l.gems_change > 0) AS gems_in,
         count(*) AS changes
  FROM public.currency_ledger l
  WHERE l.created_at > now() - interval '7 days' AND NOT l.blocked
  GROUP BY 1, 2
)
SELECT u.username, u.full_name, u.role,
       sum(p.xp_in) AS xp_gained, sum(p.gems_in) AS gems_gained, sum(p.changes) AS changes,
       string_agg(p.source || ': ' || COALESCE(p.xp_in, 0) || ' xp / ' || COALESCE(p.gems_in, 0) || ' gems',
                  ' | ' ORDER BY p.xp_in DESC NULLS LAST) AS by_source,
       u.xp AS xp_now, u.gems AS gems_now
FROM per_source p
JOIN public.users u ON u.id = p.user_id
GROUP BY u.id, u.username, u.full_name, u.role, u.xp, u.gems
ORDER BY xp_gained DESC NULLS LAST
LIMIT 100;


-- B. Every source in the last 7 days: how often it paid, to how many people, how much in total and at most at once.
SELECT COALESCE(l.source, '(server)') AS source,
       count(*) AS changes, count(DISTINCT l.user_id) AS users,
       sum(l.xp_change) FILTER (WHERE l.xp_change > 0) AS xp_given, sum(l.xp_change) FILTER (WHERE l.xp_change < 0) AS xp_taken,
       max(l.xp_change) AS biggest_xp_at_once,
       sum(l.gems_change) FILTER (WHERE l.gems_change > 0) AS gems_given, sum(l.gems_change) FILTER (WHERE l.gems_change < 0) AS gems_taken,
       max(l.gems_change) AS biggest_gems_at_once
FROM public.currency_ledger l
WHERE l.created_at > now() - interval '7 days' AND NOT l.blocked
GROUP BY 1
ORDER BY xp_given DESC NULLS LAST;


-- C. The biggest single changes in the last 30 days.
SELECT l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS at_vietnam_time, u.username, u.full_name,
       l.xp_change, l.gems_change, l.xp_after, l.gems_after, COALESCE(l.source, '(server)') AS source,
       a.username AS actor, l.actor_role
FROM public.currency_ledger l
JOIN public.users u ON u.id = l.user_id
LEFT JOIN public.users a ON a.id = l.actor
WHERE l.created_at > now() - interval '30 days' AND NOT l.blocked
ORDER BY GREATEST(abs(l.xp_change), abs(l.gems_change) * 10) DESC
LIMIT 100;


-- D. XP and gems a student gains per day, across students (the numbers step 5d's daily limits will come from).
--    Only students (role 'user') and only what they got by themselves (actor = the student), not teacher or admin gifts.
WITH daily AS (
  SELECT l.user_id, (l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
         sum(GREATEST(l.xp_change, 0)) AS xp, sum(GREATEST(l.gems_change, 0)) AS gems
  FROM public.currency_ledger l
  JOIN public.users u ON u.id = l.user_id AND u.role = 'user'
  WHERE l.created_at > now() - interval '30 days' AND NOT l.blocked AND l.actor = l.user_id
  GROUP BY 1, 2
)
SELECT count(*) AS student_days,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY xp) AS xp_median, percentile_disc(0.9) WITHIN GROUP (ORDER BY xp) AS xp_p90,
       percentile_disc(0.99) WITHIN GROUP (ORDER BY xp) AS xp_p99, max(xp) AS xp_max,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY gems) AS gems_median, percentile_disc(0.9) WITHIN GROUP (ORDER BY gems) AS gems_p90,
       percentile_disc(0.99) WITHIN GROUP (ORDER BY gems) AS gems_p99, max(gems) AS gems_max
FROM daily;


-- E. The biggest student days (who sits above the p99 of query D).
SELECT u.username, u.full_name, (l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
       sum(GREATEST(l.xp_change, 0)) AS xp, sum(GREATEST(l.gems_change, 0)) AS gems, count(*) AS changes,
       string_agg(DISTINCT COALESCE(l.source, '(server)'), ', ') AS sources
FROM public.currency_ledger l
JOIN public.users u ON u.id = l.user_id AND u.role = 'user'
WHERE l.created_at > now() - interval '30 days' AND NOT l.blocked AND l.actor = l.user_id
GROUP BY u.username, u.full_name, (l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
ORDER BY xp DESC
LIMIT 100;


-- F. Writes that were refused (from step 5c on): someone tried to set their XP or gems straight from the browser.
SELECT l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS at_vietnam_time, u.username, u.full_name,
       l.xp_after AS xp_kept, l.attempted_xp, l.gems_after AS gems_kept, l.attempted_gems, l.source
FROM public.currency_ledger l
JOIN public.users u ON u.id = l.user_id
WHERE l.blocked
ORDER BY l.created_at DESC
LIMIT 200;
