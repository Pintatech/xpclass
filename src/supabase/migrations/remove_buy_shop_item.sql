-- Undo of add_buy_shop_item.sql: students can INSERT their own purchases again (the policies come back from the copy
-- in security_lock_policies), and buy_shop_item is removed. The Shop then buys the old way: spend, then insert.
-- WARNING: a student can then again give themselves any shop item from the browser console without paying.
-- Safe to run twice. The last result: every row ok = true.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  p record;
  role_list text;
BEGIN
  IF to_regclass('public.security_lock_policies') IS NOT NULL THEN
    FOR p IN
      SELECT s.* FROM public.security_lock_policies s
      WHERE s.dropped_by = 'add_buy_shop_item' AND s.table_name = 'user_purchases'
    LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = p.table_name AND policyname = p.policy_name) THEN
        SELECT string_agg(CASE WHEN x::text = 'public' THEN 'PUBLIC' ELSE quote_ident(x::text) END, ', ')
          INTO role_list
          FROM unnest(p.roles) AS x;
        EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s',
          p.policy_name, p.table_name, p.permissive, p.cmd, role_list,
          CASE WHEN p.qual IS NOT NULL THEN format(' USING (%s)', p.qual) ELSE '' END,
          CASE WHEN p.with_check IS NOT NULL THEN format(' WITH CHECK (%s)', p.with_check) ELSE '' END);
      END IF;
    END LOOP;
    DELETE FROM public.security_lock_policies WHERE dropped_by = 'add_buy_shop_item';
  END IF;

  -- No copy found: put back the policy lock_rls_student_data.sql made, so the old way of buying works.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'user_purchases' AND cmd = 'INSERT') THEN
    CREATE POLICY "rls students: add own" ON public.user_purchases
      FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.buy_shop_item(uuid);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: ok = true on every row.
SELECT 'buy_shop_item removed' AS item,
       to_regprocedure('public.buy_shop_item(uuid)') IS NULL AS ok
UNION ALL
SELECT 'students can add their own purchases again (an INSERT policy on user_purchases)',
       EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'user_purchases' AND cmd = 'INSERT');
