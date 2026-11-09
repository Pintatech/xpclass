-- XPclass pet check, part 1 (2026-11-07). READ-ONLY: it changes nothing.
-- Why: on the pet page, Set Active and rename stopped showing up on the dashboard after today's lock files.
-- Run it in the Supabase SQL editor, then use "Download CSV" and send the file path.
--
--   1 user_pets: owner, RLS, columns, constraints
--   2 policies on user_pets and pets
--   3 what anon and authenticated may do on user_pets
--   4 triggers on user_pets, with the trigger function
--   5 set_active_pet (the wrapper in public and the original in lock_unguarded), get_active_pet,
--     require_acting_for: who may call them, and their code
--   6 counts that show broken pet data (no personal data)
SELECT 1 AS n, 'table' AS section, c.relname::text AS name,
       'owner=' || pg_get_userbyid(c.relowner) || ' rls=' || c.relrowsecurity || ' force_rls=' || c.relforcerowsecurity
       || ' rows~' || c.reltuples::bigint AS info
FROM pg_class c
WHERE c.oid = to_regclass('public.user_pets')

UNION ALL
SELECT 1, 'columns', 'user_pets',
       string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', ' ORDER BY a.attnum)
FROM pg_attribute a
WHERE a.attrelid = to_regclass('public.user_pets') AND a.attnum > 0 AND NOT a.attisdropped

UNION ALL
SELECT 1, 'constraint', con.conname::text, pg_get_constraintdef(con.oid)
FROM pg_constraint con
WHERE con.conrelid = to_regclass('public.user_pets')

UNION ALL
SELECT 2, 'policy', pol.tablename || '.' || pol.policyname,
       pol.cmd || ' to ' || array_to_string(pol.roles, ',') || ' | ' || pol.permissive
       || ' | using: ' || COALESCE(pol.qual, '-') || ' | check: ' || COALESCE(pol.with_check, '-')
FROM pg_policies pol
WHERE pol.schemaname = 'public' AND pol.tablename IN ('user_pets', 'pets')

UNION ALL
SELECT 3, 'grant', r.rolname::text,
       'SELECT=' || has_table_privilege(r.oid, to_regclass('public.user_pets'), 'SELECT')
       || ' INSERT=' || has_table_privilege(r.oid, to_regclass('public.user_pets'), 'INSERT')
       || ' UPDATE=' || has_table_privilege(r.oid, to_regclass('public.user_pets'), 'UPDATE')
       || ' DELETE=' || has_table_privilege(r.oid, to_regclass('public.user_pets'), 'DELETE')
       || ' | column UPDATE nickname=' || has_column_privilege(r.oid, to_regclass('public.user_pets'), 'nickname', 'UPDATE')
       || ' is_active=' || has_column_privilege(r.oid, to_regclass('public.user_pets'), 'is_active', 'UPDATE')
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated')

UNION ALL
SELECT 4, 'trigger', t.tgname::text,
       CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END
       || ' | ' || CASE t.tgenabled WHEN 'D' THEN 'disabled' ELSE 'enabled' END
       || ' | ' || pg_get_triggerdef(t.oid) || E'\n' || pg_get_functiondef(p.oid)
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = to_regclass('public.user_pets') AND NOT t.tgisinternal

UNION ALL
SELECT 5, 'function', ns.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END
       || ' | owner=' || pg_get_userbyid(p.proowner)
       || ' | authenticated may call=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
       || ' | anon may call=' || has_function_privilege('anon', p.oid, 'EXECUTE')
       || E'\n' || pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace ns ON ns.oid = p.pronamespace
WHERE p.prokind = 'f'
  AND ns.nspname IN ('public', 'lock_unguarded')
  AND p.proname IN ('set_active_pet', 'get_active_pet', 'require_acting_for')

UNION ALL
SELECT 6, 'data', 'students with 2 or more active pets', count(*)::text
FROM (SELECT user_id FROM public.user_pets WHERE is_active GROUP BY user_id HAVING count(*) > 1) s

UNION ALL
SELECT 6, 'data', 'students with pets but none active', count(*)::text
FROM (SELECT user_id FROM public.user_pets GROUP BY user_id HAVING NOT bool_or(COALESCE(is_active, false))) s

UNION ALL
SELECT 6, 'data', 'user_pets rows whose species row is missing', count(*)::text
FROM public.user_pets up
LEFT JOIN public.pets p ON p.id = up.pet_id
WHERE p.id IS NULL

UNION ALL
SELECT 6, 'data', 'user_pets rows', count(*)::text
FROM public.user_pets

ORDER BY 1, 2, 3;
