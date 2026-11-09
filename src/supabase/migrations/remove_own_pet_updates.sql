-- Undo of add_own_pet_updates.sql: browser writes to user_pets change 0 rows again, as before 2026-11-07
-- (renaming a pet and Place Pets > Save stop being saved).
-- The extra active pets that file turned off stay off: two active pets for one student was a fault, not a setting.
-- Safe to run twice. The last result: one row, both columns false.

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TRIGGER IF EXISTS trg_guard_user_pet_row ON public.user_pets;
DROP FUNCTION IF EXISTS public.guard_user_pet_row();
DROP POLICY IF EXISTS "rls pets: own pets" ON public.user_pets;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: policy_left = false, guard_left = false.
SELECT EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'user_pets' AND policyname = 'rls pets: own pets') AS policy_left,
       EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname = 'trg_guard_user_pet_row' AND tgrelid = 'public.user_pets'::regclass) AS guard_left;
