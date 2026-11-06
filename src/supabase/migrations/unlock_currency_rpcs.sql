-- Undo lock_currency_rpcs.sql: the XP / gem functions take any p_user_id again (the atomic_currency_rpc.sql
-- bodies), and the PvP award table and function are dropped. The app's PvP code falls back to paying the
-- winner directly when award_pvp_win is missing. Anon stays unable to call the functions; the app never needs it.

DROP FUNCTION IF EXISTS public.award_pvp_win(uuid);
DROP TABLE IF EXISTS public.pvp_win_awards;

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

DROP FUNCTION IF EXISTS public.can_change_currency(uuid);

NOTIFY pgrst, 'reload schema';
