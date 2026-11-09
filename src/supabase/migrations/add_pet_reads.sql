-- Signed-in users can see other people's pets again (2026-11-07).
--
-- Found 2026-11-07: a student who opens another student's profile sees "This user has no pets yet." user_pets has
-- row level security on, and its only read policy is "Users can view own pets" (auth.uid() = user_id), so every read
-- of someone else's pets returns nothing, without an error:
--   - another student's profile: the pet list, and the pet counts its achievements use (Profile);
--   - the opponent's pet in PvP (PvPRealtimeMatchGame, PvPRealtimeWordScramble, PvPRealtimeWordType), and
--     get_active_pet for the opponent (it runs with the caller's rights);
--   - the students' pets in Live Battle, for the teacher (useLiveBattle);
--   - a user's pets on the admin pages (UserManagement, PetManagement).
-- Same gap as the one add_own_pet_updates.sql fixes for writes: the policies on user_pets only cover "own pets", and
-- they apply since row level security is on for that table. No lock file touched user_pets.
--
-- After this file: any signed-in user can read every user's pets, as those pages expect (the same rule as
-- user_progress, user_achievements and user_purchases). Guests (no login) still read none. Changing pets is not
-- affected; add_own_pet_updates.sql decides that (own pets, name and pet home only).
--
-- Safe to run twice, before or after add_own_pet_updates.sql. Undo: remove_pet_reads.sql.
-- The last result: every row ok = true.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DROP POLICY IF EXISTS "rls pets: signed-in users read" ON public.user_pets;
CREATE POLICY "rls pets: signed-in users read" ON public.user_pets
  FOR SELECT TO authenticated
  USING (true);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: ok = true on every row.
SELECT 'signed-in users read every pet (policy "rls pets: signed-in users read")' AS item,
       EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'user_pets'
                 AND policyname = 'rls pets: signed-in users read' AND cmd = 'SELECT') AS ok
UNION ALL
SELECT 'guests read no pets (no read policy for anon)',
       NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'user_pets' AND cmd IN ('SELECT', 'ALL')
                     AND ('anon' = ANY (roles) OR 'public' = ANY (roles)))
UNION ALL
SELECT 'row level security still on for user_pets',
       (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.user_pets'::regclass);
