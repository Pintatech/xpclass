-- Undo lock_anon_writes.sql: give anon back the write grants it recorded, put back the giftcodes read policy, and
-- restore Supabase's default grants for new tables.
-- WARNING: this lets anyone holding the public anon key change or delete rows again, and every student list the
-- giftcodes. Safe to run twice.

BEGIN;

DO $$
DECLARE
  g record;
  p record;
  role_list text;
BEGIN
  IF to_regclass('public.security_lock_table_grants') IS NOT NULL THEN
    FOR g IN
      SELECT s.* FROM public.security_lock_table_grants s
      WHERE s.recorded_by = 'lock_anon_writes'
        AND to_regclass(format('public.%I', s.table_name)) IS NOT NULL
    LOOP
      BEGIN
        EXECUTE format('GRANT %s ON public.%I TO %I', g.privilege_type, g.table_name, g.grantee);
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'Could not give back % on % to %: %', g.privilege_type, g.table_name, g.grantee, SQLERRM;
      END;
    END LOOP;
    DELETE FROM public.security_lock_table_grants WHERE recorded_by = 'lock_anon_writes';
  END IF;

  IF to_regclass('public.security_lock_policies') IS NOT NULL THEN
    FOR p IN
      SELECT s.* FROM public.security_lock_policies s
      WHERE s.dropped_by = 'lock_anon_writes'
        AND to_regclass(format('public.%I', s.table_name)) IS NOT NULL
    LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = p.table_name AND policyname = p.policy_name) THEN
        SELECT string_agg(CASE WHEN r::text = 'public' THEN 'PUBLIC' ELSE quote_ident(r::text) END, ', ')
          INTO role_list
          FROM unnest(p.roles) AS r;
        EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s',
          p.policy_name, p.table_name, p.permissive, p.cmd, role_list,
          CASE WHEN p.qual IS NOT NULL THEN format(' USING (%s)', p.qual) ELSE '' END,
          CASE WHEN p.with_check IS NOT NULL THEN format(' WITH CHECK (%s)', p.with_check) ELSE '' END);
      END IF;
    END LOOP;
    DELETE FROM public.security_lock_policies WHERE dropped_by = 'lock_anon_writes';
  END IF;
END;
$$;

-- Supabase's default: tables created by the SQL editor give anon and authenticated every privilege.
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLES TO anon;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT TRUNCATE, TRIGGER, REFERENCES ON TABLES TO authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Default privileges for new tables were left as they were: %', SQLERRM;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
