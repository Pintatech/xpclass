-- Buy a shop item in one step (Shop, 2026-11-12).
--
-- Until now the Shop bought an avatar, frame, background, bowl, spaceship, boat or hammer with two calls from the
-- browser: spend_user_gems / spend_user_xp, then an INSERT into user_purchases. Two problems:
--   - paid, got nothing: when the INSERT failed after the money was taken (the student already had the item from a
--     chest, a giftcode or another tab, so the unique key refused it, or the connection dropped), the XP or gems were
--     gone and no item came;
--   - free items: the policy "rls students: add own" lets a signed-in student INSERT any item for themselves, so one
--     line in the browser console (F12) gives any item without paying.
--
-- After this file:
--   - public.buy_shop_item(p_item_id) does it all in one transaction, for the signed-in student only: the item must be
--     on sale (is_active); an item already owned is not charged again; the price comes from shop_items, never from
--     the browser; XP or gems are checked and taken (spending XP also sets level, as spend_user_xp does); the
--     purchase is written. Two purchases at the same moment wait for each other (row lock on the student), so nobody
--     pays twice or goes below zero. The currency ledger logs it as /rpc/buy_shop_item.
--   - students can no longer INSERT into user_purchases themselves: the INSERT policies go, and a copy is kept in
--     security_lock_policies. Admins still give items (UserManagement, policy "rls students: admins change");
--     chests, crafting and giftcodes write with their own SECURITY DEFINER functions, which this does not touch.
--
-- RUN ORDER: deploy the new Shop code first, then run this file a few hours later (when few students are online).
-- The old Shop code inserts into user_purchases itself, so after this file a student still on an old page would pay
-- and get nothing. The new code calls buy_shop_item and uses the old way only while the function is missing.
--
-- Safe to run twice. Undo: remove_buy_shop_item.sql.
-- The last result: every row ok = true.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

-- Where the lock files keep copies of the policies they drop (made by lock_anon_writes.sql; created here only if
-- that file never ran).
CREATE TABLE IF NOT EXISTS public.security_lock_policies (
  table_name text NOT NULL,
  policy_name text NOT NULL,
  permissive text NOT NULL,
  roles name[] NOT NULL,
  cmd text NOT NULL,
  qual text,
  with_check text,
  dropped_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, policy_name)
);
ALTER TABLE public.security_lock_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_lock_policies FROM PUBLIC, anon, authenticated;

-- 1. The purchase. Returns { success, error?, item_id, price, price_type, xp, gems }.
--    error: 'not_signed_in' | 'not_for_sale' | 'no_user' | 'owned' | 'not_enough'. Nothing is taken on an error.
CREATE OR REPLACE FUNCTION public.buy_shop_item(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_item  jsonb;
  v_price integer;
  v_kind  text;
  v_xp    integer;
  v_gems  integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_signed_in');
  END IF;

  -- Read as jsonb, so an item without price_type (older rows) costs gems, as the Shop has always shown it.
  SELECT to_jsonb(s) INTO v_item FROM public.shop_items s WHERE s.id = p_item_id;
  IF v_item IS NULL OR NOT COALESCE((v_item ->> 'is_active')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_for_sale', 'item_id', p_item_id);
  END IF;
  v_price := GREATEST(COALESCE((v_item ->> 'price')::integer, 0), 0);
  v_kind := CASE WHEN v_item ->> 'price_type' = 'xp' THEN 'xp' ELSE 'gems' END;

  -- Lock the student's row first: a second purchase at the same moment waits here until this one has finished.
  SELECT COALESCE(u.xp, 0), COALESCE(u.gems, 0) INTO v_xp, v_gems
    FROM public.users u
   WHERE u.id = v_uid
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_user', 'item_id', p_item_id);
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_purchases p WHERE p.user_id = v_uid AND p.item_id = p_item_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'owned', 'item_id', p_item_id,
                              'price', v_price, 'price_type', v_kind, 'xp', v_xp, 'gems', v_gems);
  END IF;

  IF (v_kind = 'xp' AND v_xp < v_price) OR (v_kind = 'gems' AND v_gems < v_price) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough', 'item_id', p_item_id,
                              'price', v_price, 'price_type', v_kind, 'xp', v_xp, 'gems', v_gems);
  END IF;

  BEGIN
    IF v_price > 0 AND v_kind = 'xp' THEN
      UPDATE public.users u
         SET xp = COALESCE(u.xp, 0) - v_price,
             level = FLOOR((COALESCE(u.xp, 0) - v_price) / 1000) + 1,
             updated_at = now()
       WHERE u.id = v_uid
      RETURNING u.xp INTO v_xp;
    ELSIF v_price > 0 THEN
      UPDATE public.users u
         SET gems = COALESCE(u.gems, 0) - v_price,
             updated_at = now()
       WHERE u.id = v_uid
      RETURNING u.gems INTO v_gems;
    END IF;

    INSERT INTO public.user_purchases (user_id, item_id) VALUES (v_uid, p_item_id);
  EXCEPTION WHEN unique_violation THEN
    -- A chest, a giftcode or an admin gave the item a moment ago. Everything in this block is undone, so nothing is
    -- taken; read the balance again, as the variables above may hold the new amounts.
    SELECT COALESCE(u.xp, 0), COALESCE(u.gems, 0) INTO v_xp, v_gems FROM public.users u WHERE u.id = v_uid;
    RETURN jsonb_build_object('success', false, 'error', 'owned', 'item_id', p_item_id,
                              'price', v_price, 'price_type', v_kind, 'xp', v_xp, 'gems', v_gems);
  END;

  RETURN jsonb_build_object('success', true, 'item_id', p_item_id,
                            'price', v_price, 'price_type', v_kind, 'xp', v_xp, 'gems', v_gems);
END;
$$;

-- Signed-in users only. New functions get EXECUTE for anon from Supabase's default privileges, so take it away.
REVOKE ALL ON FUNCTION public.buy_shop_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_shop_item(uuid) TO authenticated, service_role;

-- 2. Students stop writing user_purchases themselves: copy every INSERT policy, then drop it. The admins' policy is
--    FOR ALL and stays.
INSERT INTO public.security_lock_policies (table_name, policy_name, permissive, roles, cmd, qual, with_check, dropped_by)
SELECT p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check, 'add_buy_shop_item'
FROM pg_policies p
WHERE p.schemaname = 'public' AND p.tablename = 'user_purchases' AND p.cmd = 'INSERT'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_purchases' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.user_purchases', p.policyname);
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: ok = true on every row.
SELECT 'buy_shop_item is installed and runs with the owner''s rights' AS item,
       EXISTS (SELECT 1 FROM pg_proc
               WHERE oid = to_regprocedure('public.buy_shop_item(uuid)') AND prosecdef) AS ok
UNION ALL
SELECT 'signed-in users can call buy_shop_item',
       COALESCE(has_function_privilege('authenticated', to_regprocedure('public.buy_shop_item(uuid)'), 'EXECUTE'), false)
UNION ALL
SELECT 'guests cannot call buy_shop_item',
       NOT COALESCE(has_function_privilege('anon', to_regprocedure('public.buy_shop_item(uuid)'), 'EXECUTE'), true)
UNION ALL
SELECT 'students cannot add purchases themselves (no INSERT policy on user_purchases)',
       NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'user_purchases' AND cmd = 'INSERT')
UNION ALL
SELECT 'admins still give items (policy "rls students: admins change")',
       EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'user_purchases'
                 AND policyname = 'rls students: admins change' AND cmd = 'ALL')
UNION ALL
SELECT 'row level security on for user_purchases',
       (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.user_purchases'::regclass);
