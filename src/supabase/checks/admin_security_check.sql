-- Read-only check: is admin-only data really admin-only?
-- Changes nothing. Run in the Supabase SQL editor, then "Download CSV".
-- One result set: section | tbl | detail

with
admin_tables(name) as (values
  ('avatar_uploads'), ('collectible_items'), ('drop_config'), ('event_question_bank'),
  ('event_stories'), ('exercise_folder_access'), ('missions'), ('pet_question_bank'),
  ('pet_word_bank'), ('recipes'), ('user_chests'), ('user_inventory'), ('user_pets')
),
pub as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
)

-- 1. Any public table with RLS OFF (whoever holds a grant can do anything)
select '1 rls off' as section, p.relname as tbl,
       'authenticated can write: ' ||
       (has_table_privilege('authenticated', p.oid, 'INSERT')
        or has_table_privilege('authenticated', p.oid, 'UPDATE')
        or has_table_privilege('authenticated', p.oid, 'DELETE'))::text as detail
from pub p where not p.relrowsecurity

union all
-- 2. The 13 tables the admin pages write to that no lock file covers
select '2 admin table', a.name,
       coalesce('rls=' || p.relrowsecurity::text
         || ' ins=' || has_table_privilege('authenticated', p.oid, 'INSERT')::text
         || ' upd=' || has_table_privilege('authenticated', p.oid, 'UPDATE')::text
         || ' del=' || has_table_privilege('authenticated', p.oid, 'DELETE')::text,
         'table does not exist')
from admin_tables a left join pub p on p.relname = a.name

union all
-- 3. Their policies (who may do what)
select '3 policy', pl.tablename,
       pl.cmd || ' to ' || array_to_string(pl.roles, ',') || ' "' || pl.policyname || '"'
       || ' using: ' || left(coalesce(pl.qual, '-'), 160)
       || ' check: ' || left(coalesce(pl.with_check, '-'), 160)
from pg_policies pl
where pl.schemaname = 'public' and pl.tablename in (select name from admin_tables)

union all
-- 4. Who is admin right now
select '4 admin', u.email,
       'created ' || to_char(u.created_at, 'YYYY-MM-DD') || coalesce(' banned=' || u.is_banned::text, '')
from public.users u where u.role = 'admin'

union all
-- 5. Guard trigger that stops students from setting role = admin
select '5 guard', tg.tgname,
       case tg.tgenabled when 'D' then 'DISABLED' else 'enabled' end
from pg_trigger tg
where tg.tgrelid = 'public.users'::regclass and not tg.tgisinternal

order by 1, 2, 3;
