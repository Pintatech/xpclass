-- Lock add_xp_batch (from Schema.sql) to teachers and admins.
--
-- The teacher's class report (components/teacher/rollcall/TeacherClassReports.jsx) calls it once a lesson is
-- saved, to give each student their lesson XP. It is SECURITY DEFINER and did not check the caller: anyone with
-- the site's public anon key, signed in or not, could give any amount of XP to anyone.
-- After this file:
--   - only teachers and admins (users.role), the service role and the SQL editor can use it; anon cannot call it;
--   - each item needs a student id and 1 to 500 XP. The class report gives at most 135 (Wow class work 90 + Wow
--     homework 45), never 0 or less, and 500 leaves room for a lesson XP multiplier up to x3;
--   - one bad item rejects the whole batch, so a lesson is never half awarded.
-- Otherwise it works as before: xp is added and level is not recomputed.
-- Safe to run twice. Undo: unlock_add_xp_batch.sql.

CREATE OR REPLACE FUNCTION public.add_xp_batch(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim_role text := COALESCE(auth.jwt() ->> 'role', '');
  item jsonb;
  amount numeric;
BEGIN
  -- Server jobs with the service role key, and the SQL editor (no API request at all), are trusted.
  IF NOT (
    claim_role = 'service_role'
    OR (auth.uid() IS NULL AND claim_role = '')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  ) THEN
    RAISE EXCEPTION 'Only teachers and admins can award lesson XP' USING ERRCODE = '42501';
  END IF;
  IF updates IS NULL OR jsonb_typeof(updates) <> 'array' THEN
    RAISE EXCEPTION 'updates must be a list of {student_id, xp}' USING ERRCODE = '22023';
  END IF;

  -- Check every item before changing anything.
  FOR item IN SELECT * FROM jsonb_array_elements(updates) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
       OR COALESCE(item->>'student_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Each item needs a valid student_id' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(item->'xp') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'XP must be a number' USING ERRCODE = '22023';
    END IF;
    amount := (item->>'xp')::numeric;
    IF amount <> trunc(amount) OR amount < 1 OR amount > 500 THEN
      RAISE EXCEPTION 'XP per student must be a whole number from 1 to 500 (got %)', amount USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(updates) LOOP
    UPDATE users
    SET xp = COALESCE(xp, 0) + ((item->>'xp')::numeric)::integer,
        updated_at = now()
    WHERE id = (item->>'student_id')::uuid;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.add_xp_batch(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_xp_batch(jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
