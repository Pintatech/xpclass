-- XPclass pre-check for turning RLS on (step 2 of the lock). READ-ONLY: it changes nothing.
-- Run it in the Supabase SQL editor, then use "Download CSV" and send the file path (the result is too long to paste).
--
-- It covers the tables with RLS off, plus the RLS tables whose write policies are open to everyone, and lists what
-- the new policies must not break:
--   1 owner and RLS state (ENABLE ROW LEVEL SECURITY needs the owner)
--   2 every policy already on them (RLS off means none of them apply today)
--   3 triggers on them; an INVOKER trigger runs as the student, so the new policies apply to what it writes
--   4 INVOKER functions anywhere in public that write to them (same reason)
--   5 views that read them
--   6 their columns
--   7 the ones in the realtime publication (live updates are filtered by SELECT policies once RLS is on)
WITH targets AS (
  SELECT c.oid, c.relname::text AS relname
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relname NOT LIKE 'security\_lock\_%'
    AND (NOT c.relrowsecurity
         OR c.relname IN ('notifications', 'weekly_xp_tracking', 'live_battle_sessions', 'live_battle_participants',
                          'tournament_teams', 'tournament_team_members', 'giftcode_redemptions', 'wild_area_logs'))
)
SELECT n, section, name, info
FROM (
  SELECT 1 AS n, 'table'::text AS section, t.relname AS name,
         'owner=' || pg_get_userbyid(c.relowner) || ' rls=' || c.relrowsecurity
         || ' rows~' || GREATEST(c.reltuples, 0)::bigint AS info
  FROM targets t JOIN pg_class c ON c.oid = t.oid

  UNION ALL
  SELECT 2, 'policy', p.tablename || '.' || p.policyname,
         p.cmd || ' to ' || array_to_string(p.roles, ',') || ' | using: ' || COALESCE(p.qual, '-')
         || ' | check: ' || COALESCE(p.with_check, '-')
  FROM pg_policies p JOIN targets t ON t.relname = p.tablename
  WHERE p.schemaname = 'public'

  UNION ALL
  SELECT 3, 'trigger', t.relname || '.' || tg.tgname,
         CASE WHEN f.prosecdef THEN 'DEFINER | ' ELSE 'INVOKER | ' END
         || CASE WHEN tg.tgenabled = 'D' THEN 'DISABLED | ' ELSE '' END || pg_get_triggerdef(tg.oid)
  FROM pg_trigger tg
  JOIN targets t ON t.oid = tg.tgrelid
  JOIN pg_proc f ON f.oid = tg.tgfoid
  WHERE NOT tg.tgisinternal

  UNION ALL
  SELECT 4, 'invoker fn', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'writes: ' || string_agg(t.relname, ', ' ORDER BY t.relname)
         || ' | auth=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  JOIN targets t
    ON pg_get_functiondef(p.oid) ~* ('(insert\s+into|update|delete\s+from)\s+(public\.)?"?' || t.relname || '\M')
  WHERE ns.nspname = 'public'
    AND p.prokind = 'f'
    AND NOT p.prosecdef
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  GROUP BY p.oid, p.proname

  UNION ALL
  SELECT 5, 'view', v.view_name::text,
         'reads: ' || string_agg(v.table_name::text, ', ' ORDER BY v.table_name::text)
         || CASE WHEN bool_or(COALESCE(vc.reloptions::text, '') ~ 'security_invoker=(true|on|1)')
                 THEN ' | security_invoker' ELSE '' END
  FROM information_schema.view_table_usage v
  JOIN pg_class vc ON vc.oid = format('%I.%I', v.view_schema, v.view_name)::regclass
  WHERE v.view_schema = 'public' AND v.table_schema = 'public'
    AND v.table_name::text IN (SELECT relname FROM targets)
  GROUP BY v.view_name

  UNION ALL
  SELECT 6, 'columns', t.relname, string_agg(a.attname::text, ', ' ORDER BY a.attnum)
  FROM targets t
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
  GROUP BY t.relname

  UNION ALL
  SELECT 7, 'realtime', pt.tablename::text, pt.pubname::text
  FROM pg_publication_tables pt
  JOIN targets t ON t.relname = pt.tablename::text
  WHERE pt.schemaname = 'public'
) r
ORDER BY n, name;
