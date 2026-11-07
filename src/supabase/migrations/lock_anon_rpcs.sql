-- Stop anon (no login) from calling SECURITY DEFINER functions, and keep the cron-only functions for the server.
--
-- Found 2026-11-07 (security_check.sql section 5): nearly every SECURITY DEFINER function in public could be
-- called with the bare anon key, among them buy_egg(p_user_id, ...), claim_mission_reward(p_user_id, ...),
-- award_competition_items(p_user_id, ...), redeem_giftcode(p_user_id, ...) and the weekly/monthly champion awards.
-- They run as their owner and skip RLS, so anyone on the internet could spend or hand out anyone's gems and items
-- and run the cron awards at will.
-- After this file:
--   - the cron functions (champion awards, old-mission cleanup) can be run only by the service role (Vercel cron)
--     and the SQL editor;
--   - anon loses EXECUTE on every other SECURITY DEFINER function in public, except the ones an RLS policy or a
--     view calls (a guest reading exercises needs those) and login_email_for_username();
--   - signed-in users keep EXECUTE on everything they had. Still open: a student can pass another student's
--     p_user_id. That needs a self-or-staff check per function.
-- Every grant removed here is recorded in public.security_lock_function_grants for the undo.
-- Safe to run twice. Undo: unlock_anon_rpcs.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.security_lock_function_grants (
  fn_oid oid PRIMARY KEY,
  fn_name text NOT NULL,
  kind text NOT NULL,                 -- 'cron' or 'anon'
  had_public boolean NOT NULL,
  had_anon boolean NOT NULL,
  had_authenticated boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_lock_function_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_lock_function_grants FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  cron_names text[] := ARRAY[
    'award_daily_challenge_winners', 'award_monthly_xp_champion', 'award_weekly_scramble_champion',
    'award_weekly_xp_champion', 'award_pvp_weekly_champion', 'cleanup_old_user_missions'
  ];
  keep_names text[] := ARRAY['login_email_for_username'];
  f record;
  acl aclitem[];
  is_cron boolean;
  referenced boolean;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, p.proacl, p.proowner, p.prosecdef
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') -- extension functions
      AND (p.prosecdef OR p.proname = ANY (cron_names))
  LOOP
    is_cron := f.proname = ANY (cron_names);
    CONTINUE WHEN NOT is_cron AND f.proname = ANY (keep_names);

    -- Called from an RLS policy or a view: whoever reads that table needs EXECUTE, guests included.
    referenced := EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE (COALESCE(pol.qual, '') || ' ' || COALESCE(pol.with_check, '')) ~ ('\m' || f.proname || '\s*\(')
      ) OR EXISTS (
        SELECT 1 FROM pg_views v
        WHERE v.schemaname NOT IN ('pg_catalog', 'information_schema')
          AND v.definition ~ ('\m' || f.proname || '\s*\(')
      );
    CONTINUE WHEN NOT is_cron AND referenced;

    CONTINUE WHEN NOT is_cron AND NOT has_function_privilege('anon', f.oid, 'EXECUTE');

    acl := COALESCE(f.proacl, acldefault('f', f.proowner));
    INSERT INTO public.security_lock_function_grants (fn_oid, fn_name, kind, had_public, had_anon, had_authenticated)
    VALUES (
      f.oid,
      f.oid::regprocedure::text,
      CASE WHEN is_cron THEN 'cron' ELSE 'anon' END,
      EXISTS (SELECT 1 FROM aclexplode(acl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
      EXISTS (SELECT 1 FROM aclexplode(acl) a WHERE a.grantee = 'anon'::regrole AND a.privilege_type = 'EXECUTE'),
      EXISTS (SELECT 1 FROM aclexplode(acl) a WHERE a.grantee = 'authenticated'::regrole AND a.privilege_type = 'EXECUTE')
    )
    ON CONFLICT (fn_oid) DO NOTHING; -- keep the state from before the first run

    IF is_cron THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.oid::regprocedure);
    ELSE
      -- Signed-in users may have had EXECUTE only through PUBLIC: give it back to them directly first.
      IF has_function_privilege('authenticated', f.oid, 'EXECUTE') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.oid::regprocedure);
      END IF;
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.oid::regprocedure);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.oid::regprocedure);
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- What changed (run separately to see it):
-- SELECT kind, fn_name, had_public, had_anon, had_authenticated FROM public.security_lock_function_grants ORDER BY kind, fn_name;
