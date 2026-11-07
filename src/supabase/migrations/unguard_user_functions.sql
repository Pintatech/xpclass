-- Undo guard_user_functions.sql: drop the checking functions, move every original back from lock_unguarded to public
-- with its old grants, then drop require_acting_for() and the lock_unguarded schema once it is empty.
-- WARNING: a signed-in student can then again open another student's chests, spend their gems, claim their missions
-- and call award_single_challenge_winners. Safe to run twice.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  w record;
BEGIN
  IF to_regclass('public.security_lock_wrapped_functions') IS NULL OR to_regnamespace('lock_unguarded') IS NULL THEN
    RETURN;
  END IF;

  FOR w IN
    SELECT * FROM public.security_lock_wrapped_functions WHERE wrapped_by = 'guard_user_functions'
  LOOP
    IF EXISTS (SELECT 1 FROM pg_proc q
               WHERE q.pronamespace = to_regnamespace('lock_unguarded') AND q.proname = w.function_name
                 AND pg_get_function_identity_arguments(q.oid) = w.identity_args) THEN
      EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', w.function_name, w.identity_args);
      EXECUTE format('ALTER FUNCTION lock_unguarded.%I(%s) SET SCHEMA public', w.function_name, w.identity_args);
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated, service_role',
                     w.function_name, w.identity_args);
      EXECUTE COALESCE((
        SELECT string_agg(format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO %s', w.function_name, w.identity_args,
                                 CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END), '; ')
        FROM aclexplode(w.acl) a
        LEFT JOIN pg_roles r ON r.oid = a.grantee
        WHERE a.privilege_type = 'EXECUTE' AND a.grantee <> a.grantor
      ), 'SELECT 1');
    END IF;
  END LOOP;

  DELETE FROM public.security_lock_wrapped_functions WHERE wrapped_by = 'guard_user_functions';
END;
$$;

DROP FUNCTION IF EXISTS public.require_acting_for(uuid, text, text, integer);

DO $$
BEGIN
  IF to_regnamespace('lock_unguarded') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = to_regnamespace('lock_unguarded')) THEN
    DROP SCHEMA lock_unguarded;
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
