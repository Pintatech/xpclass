-- Students can rename their pets and save the pet home again (2026-11-07).
--
-- Found with checks/pet_check.sql and checks/pet_try_as_student.sql on the live database (2026-11-07):
--   - user_pets has row level security on, and its only policies are "Users can view own pets" (SELECT) and
--     "Admins can insert user_pets" (INSERT). With no UPDATE policy, every change the browser sends to a pet row
--     changes 0 rows and returns no error:
--       - renaming a pet (pet page and Inventory),
--       - Place Pets > Save (habitat_x, habitat_y, habitat_flip).
--     The app shows the new name and "Layout saved!", and both are gone after a reload. No lock file touched
--     user_pets: RLS on it was already on in the security check of 11:39.
--   - Set Active works: set_active_pet runs as its owner, so RLS does not apply to it.
--   - One student has two pets marked active. get_active_pet takes whichever it finds first, so the dashboard can show
--     either one, and the pet page shows both as ACTIVE, with no Set Active button on them.
--
-- After this file:
--   - a signed-in user may change their own pets (policy "rls pets: own pets"), but only the nickname and the pet
--     home position (habitat_x, habitat_y, habitat_flip). For a write from the app, a guard trigger keeps every other
--     column as it was, so level, XP, evolution, species, energy, happiness and the active flag cannot be changed
--     from F12. Nothing errors: a write that also tries those columns saves only the allowed ones;
--   - those columns still change through the server functions (set_active_pet, feed_pet, play_with_pet, evolve_pet...),
--     which run as their owner, and through the SQL editor and the service role;
--   - at most one active pet per student: where two or more are active, the one set_active_pet saved last
--     (users.active_pet_id) stays active, else the newest one.
-- Admins: their own pets as above; other people's pets as before (no admin page changes them).
--
-- Safe to run twice. Undo: remove_own_pet_updates.sql (the extra active pets stay off).
-- The last result: every row ok = true. Then run checks/pet_try_as_student.sql again: rename and pet home should say
-- rows changed=1, and the level try should say level kept=true.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

-- 1. Which rows: your own pets.
DROP POLICY IF EXISTS "rls pets: own pets" ON public.user_pets;
CREATE POLICY "rls pets: own pets" ON public.user_pets
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 2. Which columns: the name and the pet home position. Everything else keeps its stored value.
CREATE OR REPLACE FUNCTION public.guard_user_pet_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  kept public.user_pets;
BEGIN
  -- SECURITY INVOKER on purpose, as guard_user_row on users: current_user is 'authenticated' or 'anon' for a request
  -- from the app, and the function owner inside a SECURITY DEFINER function such as set_active_pet or feed_pet.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  kept := OLD;
  kept.nickname := NEW.nickname;
  kept.habitat_x := NEW.habitat_x;
  kept.habitat_y := NEW.habitat_y;
  kept.habitat_flip := NEW.habitat_flip;
  RETURN kept;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_user_pet_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_user_pet_row ON public.user_pets;
CREATE TRIGGER trg_guard_user_pet_row
  BEFORE UPDATE ON public.user_pets
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_pet_row();

-- 3. One active pet per student.
UPDATE public.user_pets up
SET is_active = false, updated_at = now()
FROM (
  SELECT p.id,
         row_number() OVER (PARTITION BY p.user_id
                            ORDER BY (p.id = u.active_pet_id) DESC NULLS LAST, p.obtained_at DESC, p.id) AS rn
  FROM public.user_pets p
  JOIN public.users u ON u.id = p.user_id
  WHERE p.is_active
) r
WHERE up.id = r.id AND r.rn > 1;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: ok = true on every row.
SELECT 'students can change their own pets (policy "rls pets: own pets")' AS item,
       EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'user_pets'
                 AND policyname = 'rls pets: own pets' AND cmd = 'UPDATE') AS ok
UNION ALL
SELECT 'only the name and the pet home position (guard trigger on)',
       EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname = 'trg_guard_user_pet_row' AND tgrelid = 'public.user_pets'::regclass AND tgenabled <> 'D')
UNION ALL
SELECT 'signed-in users still hold UPDATE on user_pets',
       has_table_privilege('authenticated', 'public.user_pets', 'UPDATE')
UNION ALL
SELECT 'guests cannot change pets',
       NOT has_table_privilege('anon', 'public.user_pets', 'UPDATE')
UNION ALL
SELECT 'no student has two active pets',
       NOT EXISTS (SELECT 1 FROM public.user_pets WHERE is_active GROUP BY user_id HAVING count(*) > 1);
