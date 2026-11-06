-- Undo lock_add_xp_batch.sql: back to the Schema.sql body (no caller check, no limits).
-- Anon stays unable to call it; the app only calls it from a signed-in teacher's page.
CREATE OR REPLACE FUNCTION public.add_xp_batch(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE users
    SET xp = COALESCE(xp, 0) + (item->>'xp')::int,
        updated_at = now()
    WHERE id = (item->>'student_id')::uuid;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_xp_batch(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
