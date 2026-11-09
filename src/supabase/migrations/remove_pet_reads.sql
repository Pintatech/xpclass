-- Undo of add_pet_reads.sql: each user reads only their own pets again (other students' profiles show "This user has
-- no pets yet.", and PvP, Live Battle and the admin pages show no pets of other people).
-- Safe to run twice. The last result: policy_left = false.

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP POLICY IF EXISTS "rls pets: signed-in users read" ON public.user_pets;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: policy_left = false.
SELECT EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'user_pets'
                 AND policyname = 'rls pets: signed-in users read') AS policy_left;
