-- XPclass security check. READ-ONLY: it changes nothing.
-- Run it in the Supabase SQL editor and send back the result table (or export it as CSV).
SELECT n, section, name, info
FROM (
  -- 1. Is the users guard (add_user_row_guard.sql) installed?
  SELECT 1 AS n, 0::bigint AS k, 'guard trigger'::text AS section, 'trg_guard_user_row'::text AS name,
         CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                           WHERE tgrelid = 'public.users'::regclass AND tgname = 'trg_guard_user_row' AND tgenabled <> 'D')
              THEN 'INSTALLED' ELSE 'MISSING: add_user_row_guard.sql has not been run' END AS info

  UNION ALL
  -- 2. Every trigger on users
  SELECT 2, 0, 'users trigger', t.tgname::text,
         p.proname::text || CASE t.tgenabled WHEN 'D' THEN ' (DISABLED)' ELSE '' END
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid = 'public.users'::regclass AND NOT t.tgisinternal

  UNION ALL
  -- 3. RLS and policies on users
  SELECT 3, 0, 'users RLS', 'enabled', relrowsecurity::text
  FROM pg_class WHERE oid = 'public.users'::regclass

  UNION ALL
  SELECT 3, 1, 'users policy', policyname::text,
         cmd || ' to ' || array_to_string(roles, ',') || ' | using: ' || COALESCE(qual, '-') || ' | check: ' || COALESCE(with_check, '-')
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'

  UNION ALL
  -- 4. Table grants on users for the browser roles
  SELECT 4, 0, 'users grant', grantee::text, string_agg(privilege_type::text, ',' ORDER BY privilege_type::text)
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'users' AND grantee IN ('anon', 'authenticated')
  GROUP BY grantee

  UNION ALL
  -- 5. SECURITY DEFINER functions a browser can call (they bypass RLS and the guard)
  SELECT 5, 0, 'definer fn', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
         || ' auth=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || CASE WHEN pg_get_functiondef(p.oid) ~* 'update\s+(public\.)?users' THEN ' | WRITES users' ELSE '' END
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))

  UNION ALL
  -- 6. Accounts with a role in auth metadata. Anyone can set their own; the old isAdmin() in the app trusted it.
  SELECT 6, 0, 'metadata role', au.email::text,
         'metadata=' || (au.raw_user_meta_data ->> 'role') || ' users.role=' || COALESCE(u.role, '?')
  FROM auth.users au LEFT JOIN public.users u ON u.id = au.id
  WHERE au.raw_user_meta_data ? 'role'

  UNION ALL
  -- 7. Admin accounts: this should be a short list you recognise
  SELECT 7, 0, 'admin', u.email,
         'created ' || to_char(u.created_at, 'YYYY-MM-DD') || ', last update ' || to_char(u.updated_at, 'YYYY-MM-DD')
  FROM public.users u WHERE u.role = 'admin'

  UNION ALL
  -- 8. Teachers who teach no course: a student who promoted themselves would show up here
  SELECT 8, 0, 'teacher, no course', u.email, 'created ' || to_char(u.created_at, 'YYYY-MM-DD')
  FROM public.users u
  WHERE u.role = 'teacher'
    AND NOT EXISTS (SELECT 1 FROM public.course_teachers ct WHERE ct.teacher_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.courses c WHERE c.teacher_id = u.id)

  UNION ALL
  -- 9. Highest XP: look for outliers
  SELECT 9, -t.xp, 'top xp', t.email, t.role || ' xp=' || t.xp || ' gems=' || t.gems || ' level=' || t.level
  FROM (SELECT email, COALESCE(role, 'user') AS role, COALESCE(xp, 0)::bigint AS xp, COALESCE(gems, 0) AS gems,
               COALESCE(level, 1) AS level
        FROM public.users ORDER BY xp DESC NULLS LAST LIMIT 15) t

  UNION ALL
  -- 10. Write policies that let every signed-in user (or anon) write any row
  SELECT 10, 0, 'open write policy', tablename || '.' || policyname,
         cmd || ' to ' || array_to_string(roles, ',') || ' | ' || COALESCE(CASE WHEN cmd = 'INSERT' THEN with_check ELSE qual END, 'true')
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    AND roles && ARRAY['public', 'authenticated', 'anon']::name[]
    AND COALESCE(CASE WHEN cmd = 'INSERT' THEN with_check ELSE qual END, 'true')
        ~* '^\s*\(?\s*(true|auth\.role\(\)\s*=\s*''authenticated''(::text)?|auth\.uid\(\)\s+is\s+not\s+null)\s*\)?\s*$'

  UNION ALL
  -- 11. Tables with RLS switched off: the browser can read and write every row the grants allow
  SELECT 11, 0, 'RLS OFF', c.relname::text,
         'anon: ' || COALESCE((SELECT string_agg(privilege_type::text, ',' ORDER BY privilege_type::text)
                               FROM information_schema.role_table_grants g
                               WHERE g.table_schema = 'public' AND g.table_name = c.relname AND g.grantee = 'anon'), '-')
         || ' | authenticated: ' || COALESCE((SELECT string_agg(privilege_type::text, ',' ORDER BY privilege_type::text)
                               FROM information_schema.role_table_grants g
                               WHERE g.table_schema = 'public' AND g.table_name = c.relname AND g.grantee = 'authenticated'), '-')
  FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity

  UNION ALL
  -- 12. Read policies open to anon (no login needed)
  SELECT 12, 0, 'anon read policy', tablename || '.' || policyname, array_to_string(roles, ',') || ' | ' || COALESCE(qual, 'true')
  FROM pg_policies
  WHERE schemaname = 'public' AND cmd IN ('SELECT', 'ALL') AND roles && ARRAY['public', 'anon']::name[]

  UNION ALL
  -- 13. Every write policy on the tables whose content is rendered as HTML or holds secrets
  SELECT 13, 0, 'content write policy', tablename || '.' || policyname,
         cmd || ' to ' || array_to_string(roles, ',') || ' | using: ' || COALESCE(qual, '-') || ' | check: ' || COALESCE(with_check, '-')
  FROM pg_policies
  WHERE schemaname = 'public' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    AND tablename IN ('exercises', 'units', 'courses', 'sessions', 'site_settings', 'giftcodes', 'notifications', 'shop_items')

  UNION ALL
  -- 14. Storage buckets
  SELECT 14, 0, 'bucket', b.id::text,
         CASE WHEN b.public THEN 'PUBLIC' ELSE 'private' END
         || ' | max size: ' || COALESCE(b.file_size_limit::text, 'none')
         || ' | types: ' || COALESCE(array_to_string(b.allowed_mime_types, ','), 'any')
  FROM storage.buckets b

  UNION ALL
  -- 15. Storage policies
  SELECT 15, 0, 'storage policy', tablename || '.' || policyname,
         cmd || ' to ' || array_to_string(roles, ',') || ' | using: ' || COALESCE(qual, '-') || ' | check: ' || COALESCE(with_check, '-')
  FROM pg_policies
  WHERE schemaname = 'storage'
) r
ORDER BY n, k, name;
