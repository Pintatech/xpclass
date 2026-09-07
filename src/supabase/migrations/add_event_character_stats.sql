-- Event fighter stats: one row per (student, character).
--
-- The event hero levels by fighting, not by studying, so this ladder is kept
-- apart from users.xp / users.current_level. Each character is levelled
-- separately — a student who switches from the knight to the brawler starts
-- that build at level 1 and keeps the knight's untouched.
--
-- Only the three spend counters are stored. Base stats, growth per point, the
-- XP curve and the damage formula all live in src/config/eventStats.js, so the
-- balance can be retuned without a migration or a data backfill.

CREATE TABLE IF NOT EXISTS public.event_character_stats (
  user_id uuid NOT NULL,
  character_id text NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  spent_hp integer NOT NULL DEFAULT 0,
  spent_atk integer NOT NULL DEFAULT 0,
  spent_def integer NOT NULL DEFAULT 0,
  battles integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_character_stats_pkey PRIMARY KEY (user_id, character_id),
  CONSTRAINT event_character_stats_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT event_character_stats_nonneg
    CHECK (xp >= 0 AND spent_hp >= 0 AND spent_atk >= 0 AND spent_def >= 0)
);

ALTER TABLE public.event_character_stats ENABLE ROW LEVEL SECURITY;

-- Readable by anyone signed in, so a profile page or leaderboard can show a
-- student's fighter later without another policy.
CREATE POLICY "event_character_stats_select" ON public.event_character_stats
  FOR SELECT USING (true);

-- Writes are the owner's only. The RPCs below are SECURITY DEFINER and do the
-- arithmetic themselves, so these exist for the initial row and nothing else.
CREATE POLICY "event_character_stats_insert" ON public.event_character_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_character_stats_update" ON public.event_character_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- Award battle XP.
--
-- The amount is added in the database rather than written as an absolute, for
-- the same reason increment_user_currency exists: two tabs, or a battle
-- finishing while a stale row is in hand, must not be able to roll XP back.
--
-- The battle is resolved on the client, so the amount is the client's word; the
-- cap keeps a tampered call to roughly one honest battle's worth. Moving the
-- whole exchange server-side is the only real fix and is not worth it here —
-- there is nothing to win but a bigger number on your own fighter.
CREATE OR REPLACE FUNCTION award_event_character_xp(
  p_character_id text,
  p_xp integer,
  p_won boolean DEFAULT false
)
RETURNS public.event_character_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.event_character_stats;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.event_character_stats (user_id, character_id, xp, battles, wins)
  VALUES (auth.uid(), p_character_id, LEAST(GREATEST(p_xp, 0), 300), 1, CASE WHEN p_won THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, character_id) DO UPDATE
     SET xp         = public.event_character_stats.xp + LEAST(GREATEST(p_xp, 0), 300),
         battles    = public.event_character_stats.battles + 1,
         wins       = public.event_character_stats.wins + CASE WHEN p_won THEN 1 ELSE 0 END,
         updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Level from total XP, and the point budget that level has earned.
--
-- This mirrors levelFromXp / pointsForLevel in src/config/eventStats.js. It is
-- duplicated rather than passed in from the client because it is the budget
-- check: a client that could name its own allowance could buy every stat at
-- level 1. Retuning the curve means editing both — the constants are here.
CREATE OR REPLACE FUNCTION event_character_point_budget(p_xp integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c_max_level        constant integer := 30;
  c_points_per_level constant integer := 3;
  v_level integer := 1;
  v_rem   integer := GREATEST(COALESCE(p_xp, 0), 0);
  v_need  integer;
BEGIN
  LOOP
    EXIT WHEN v_level >= c_max_level;
    v_need := 100 + (v_level - 1) * 50;
    EXIT WHEN v_rem < v_need;
    v_rem := v_rem - v_need;
    v_level := v_level + 1;
  END LOOP;

  RETURN v_level * c_points_per_level;
END;
$$;

-- Spend one or more points on a stat.
--
-- The budget check happens here, under the row lock, so the client can neither
-- overspend by racing two clicks nor claim points it has not earned.
CREATE OR REPLACE FUNCTION spend_event_character_point(
  p_character_id text,
  p_stat text,
  p_amount integer
)
RETURNS public.event_character_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.event_character_stats;
  v_spent integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_stat NOT IN ('hp', 'atk', 'def') THEN
    RAISE EXCEPTION 'unknown stat %', p_stat;
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  INSERT INTO public.event_character_stats (user_id, character_id)
  VALUES (auth.uid(), p_character_id)
  ON CONFLICT (user_id, character_id) DO NOTHING;

  SELECT * INTO v_row
    FROM public.event_character_stats
   WHERE user_id = auth.uid() AND character_id = p_character_id
     FOR UPDATE;

  v_spent := v_row.spent_hp + v_row.spent_atk + v_row.spent_def;
  IF v_spent + p_amount > public.event_character_point_budget(v_row.xp) THEN
    RAISE EXCEPTION 'not enough points';
  END IF;

  UPDATE public.event_character_stats
     SET spent_hp   = spent_hp  + CASE WHEN p_stat = 'hp'  THEN p_amount ELSE 0 END,
         spent_atk  = spent_atk + CASE WHEN p_stat = 'atk' THEN p_amount ELSE 0 END,
         spent_def  = spent_def + CASE WHEN p_stat = 'def' THEN p_amount ELSE 0 END,
         updated_at = now()
   WHERE user_id = auth.uid() AND character_id = p_character_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Refund every point so a build can be tried again. Free for now; gate it on a
-- gem cost here if respeccing should ever have a price.
CREATE OR REPLACE FUNCTION reset_event_character_points(p_character_id text)
RETURNS public.event_character_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.event_character_stats;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.event_character_stats
     SET spent_hp = 0, spent_atk = 0, spent_def = 0, updated_at = now()
   WHERE user_id = auth.uid() AND character_id = p_character_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION award_event_character_xp(text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION spend_event_character_point(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_event_character_points(text) TO authenticated;
