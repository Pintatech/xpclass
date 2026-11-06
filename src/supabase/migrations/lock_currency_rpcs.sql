-- Lock the XP / gem functions (atomic_currency_rpc.sql) to the caller's own balance.
--
-- increment_user_currency, spend_user_gems and spend_user_xp are SECURITY DEFINER and took any p_user_id, so any
-- signed-in student could, from the browser console, give anyone XP or gems, or drain a classmate's XP and gems.
-- After this file:
--   - a student can only change their own balance, as every student-side call in the app does;
--   - teachers and admins can change anyone's (Live Battle, Class War, tournaments, End & Award);
--   - server code (service role key, the SQL editor) is unchanged;
--   - anon cannot call them at all.
-- The two places where a student's browser paid another player (the +10 XP for winning an async PvP challenge)
-- now call award_pvp_win, which pays only the winner of a finished challenge the caller played, once.
--
-- Not covered here: a student can still raise their OWN balance, through these functions or by writing their
-- users row directly, because the app hands out rewards from the browser. See add_user_row_guard.sql for roles.
-- Safe to run twice. Undo: unlock_currency_rpcs.sql.

-- Who may change p_user_id's balance.
CREATE OR REPLACE FUNCTION public.can_change_currency(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim_role text := COALESCE(auth.jwt() ->> 'role', '');
BEGIN
  -- Server jobs with the service role key, and the SQL editor (no API request at all).
  IF claim_role = 'service_role' OR (auth.uid() IS NULL AND claim_role = '') THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN false; -- anon
  END IF;
  IF p_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'));
END;
$$;

REVOKE ALL ON FUNCTION public.can_change_currency(uuid) FROM PUBLIC, anon, authenticated;

-- Same bodies as atomic_currency_rpc.sql, with the check first.
CREATE OR REPLACE FUNCTION public.increment_user_currency(
  p_user_id uuid,
  p_xp integer DEFAULT 0,
  p_gems integer DEFAULT 0
)
RETURNS TABLE (xp integer, gems integer, level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_change_currency(p_user_id) THEN
    RAISE EXCEPTION 'You can only change your own XP and gems' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE users u
     SET xp    = GREATEST(COALESCE(u.xp, 0) + p_xp, 0),
         gems  = GREATEST(COALESCE(u.gems, 0) + p_gems, 0),
         level = FLOOR(GREATEST(COALESCE(u.xp, 0) + p_xp, 0) / 1000) + 1,
         updated_at = now()
   WHERE u.id = p_user_id
  RETURNING u.xp, u.gems, u.level;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_user_gems(
  p_user_id uuid,
  p_amount integer
)
RETURNS TABLE (success boolean, gems integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_gems integer;
BEGIN
  IF NOT public.can_change_currency(p_user_id) THEN
    RAISE EXCEPTION 'You can only change your own XP and gems' USING ERRCODE = '42501';
  END IF;

  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, COALESCE(u.gems, 0) FROM users u WHERE u.id = p_user_id;
    RETURN;
  END IF;

  UPDATE users u
     SET gems = u.gems - p_amount,
         updated_at = now()
   WHERE u.id = p_user_id
     AND COALESCE(u.gems, 0) >= p_amount
  RETURNING u.gems INTO v_new_gems;

  IF FOUND THEN
    RETURN QUERY SELECT true, v_new_gems;
  ELSE
    RETURN QUERY SELECT false, COALESCE(u.gems, 0) FROM users u WHERE u.id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_user_xp(
  p_user_id uuid,
  p_amount integer
)
RETURNS TABLE (success boolean, xp integer, level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_xp integer;
  v_new_level integer;
BEGIN
  IF NOT public.can_change_currency(p_user_id) THEN
    RAISE EXCEPTION 'You can only change your own XP and gems' USING ERRCODE = '42501';
  END IF;

  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, COALESCE(u.xp, 0), COALESCE(u.level, 1) FROM users u WHERE u.id = p_user_id;
    RETURN;
  END IF;

  UPDATE users u
     SET xp = u.xp - p_amount,
         level = FLOOR((u.xp - p_amount) / 1000) + 1,
         updated_at = now()
   WHERE u.id = p_user_id
     AND COALESCE(u.xp, 0) >= p_amount
  RETURNING u.xp, u.level INTO v_new_xp, v_new_level;

  IF FOUND THEN
    RETURN QUERY SELECT true, v_new_xp, v_new_level;
  ELSE
    RETURN QUERY SELECT false, COALESCE(u.xp, 0), COALESCE(u.level, 1) FROM users u WHERE u.id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_user_currency(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spend_user_gems(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spend_user_xp(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_user_currency(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spend_user_gems(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spend_user_xp(uuid, integer) TO authenticated, service_role;

-- ------------------------------------------------------------ PvP win award
-- One row per challenge whose winner has been paid. Clients cannot write it (RLS on, no policies), so a winner
-- cannot be paid twice, not even by resetting the challenge row.
CREATE TABLE IF NOT EXISTS public.pvp_win_awards (
  challenge_id uuid PRIMARY KEY REFERENCES public.pvp_challenges(id) ON DELETE CASCADE,
  winner_id uuid NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pvp_win_awards ENABLE ROW LEVEL SECURITY;

-- Challenges finished before this file were paid by the old code.
INSERT INTO public.pvp_win_awards (challenge_id, winner_id, awarded_at)
SELECT id, winner_id, COALESCE(created_at, now())
FROM public.pvp_challenges
WHERE status = 'completed' AND winner_id IS NOT NULL
ON CONFLICT (challenge_id) DO NOTHING;

-- +10 XP to the winner of a finished challenge, called by either player. Returns false when there is nothing to
-- pay: a draw, a challenge not finished yet, or a winner already paid.
CREATE OR REPLACE FUNCTION public.award_pvp_win(p_challenge_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
BEGIN
  SELECT id, challenger_id, opponent_id, winner_id, status INTO c
  FROM public.pvp_challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found' USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() NOT IN (c.challenger_id, c.opponent_id) THEN
    RAISE EXCEPTION 'Only a player of this challenge can settle it' USING ERRCODE = '42501';
  END IF;
  IF c.status IS DISTINCT FROM 'completed' OR c.winner_id IS NULL OR c.winner_id NOT IN (c.challenger_id, c.opponent_id) THEN
    RETURN false;
  END IF;

  INSERT INTO public.pvp_win_awards (challenge_id, winner_id) VALUES (c.id, c.winner_id)
  ON CONFLICT (challenge_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.users u
     SET xp = GREATEST(COALESCE(u.xp, 0) + 10, 0),
         level = FLOOR(GREATEST(COALESCE(u.xp, 0) + 10, 0) / 1000) + 1,
         updated_at = now()
   WHERE u.id = c.winner_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.award_pvp_win(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_pvp_win(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
