-- Undo lock_anon_rpcs.sql: give back the EXECUTE grants it recorded, then drop the record.
-- WARNING: this lets anyone with the public anon key call those functions again.

BEGIN;

DO $$
DECLARE
  g record;
BEGIN
  IF to_regclass('public.security_lock_function_grants') IS NULL THEN
    RETURN;
  END IF;
  FOR g IN
    SELECT s.* FROM public.security_lock_function_grants s
    WHERE EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = s.fn_oid)
  LOOP
    IF g.had_public THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', g.fn_oid::regprocedure);
    END IF;
    IF g.had_anon THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', g.fn_oid::regprocedure);
    END IF;
    IF g.had_authenticated THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', g.fn_oid::regprocedure);
    END IF;
  END LOOP;
END;
$$;

DROP TABLE IF EXISTS public.security_lock_function_grants;

COMMIT;

NOTIFY pgrst, 'reload schema';
