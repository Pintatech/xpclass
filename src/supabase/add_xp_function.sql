-- Create function to safely add XP to users
-- This prevents race conditions when multiple exercises complete simultaneously

CREATE OR REPLACE FUNCTION add_user_xp(user_id uuid, xp_to_add integer)
RETURNS void AS $$
BEGIN
  -- Update user's XP atomically
  UPDATE public.users
  SET
    xp = COALESCE(xp, 0) + xp_to_add,
    updated_at = now()
  WHERE id = user_id;

  -- If no rows were affected, the user doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with ID % not found', user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_user_xp(uuid, integer) TO authenticated;