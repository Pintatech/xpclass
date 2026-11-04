-- Pet Dash: allow game_type 'petdash' (tournaments, and any other table that checks game types)
-- and mission goal_type 'dash_words'.
-- Safe to run twice. Every CHECK that lists game types (it names 'astroblast') or mission goals
-- (it names 'blast_words') is rebuilt from its live definition plus the new value, so values added
-- on the live database since Schema.sql was dumped are kept. Undo: remove_pet_dash_game.sql.
DO $$
DECLARE
  c record;
  col text;
  extra text;
  vals text[];
BEGIN
  FOR c IN
    SELECT con.conrelid::regclass AS tbl, con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    WHERE con.connamespace = 'public'::regnamespace
      AND con.contype = 'c'
      AND (pg_get_constraintdef(con.oid) LIKE '%game_type%''astroblast''%'
        OR pg_get_constraintdef(con.oid) LIKE '%goal_type%''blast_words''%'
        OR pg_get_constraintdef(con.oid) LIKE '%game_type%{%astroblast%}%'
        OR pg_get_constraintdef(con.oid) LIKE '%goal_type%{%blast_words%}%')
  LOOP
    col := CASE WHEN c.def LIKE '%goal_type%' THEN 'goal_type' ELSE 'game_type' END;
    extra := CASE col WHEN 'goal_type' THEN 'dash_words' ELSE 'petdash' END;
    -- Only a plain "column IN (...)" list is rebuilt; anything else stops the script untouched.
    IF c.def !~ ('^CHECK \(\(' || col || ' = ANY \(') THEN
      RAISE EXCEPTION 'Unexpected constraint % on %: %', c.conname, c.tbl, c.def;
    END IF;
    -- The list is either ARRAY['a'::text, ...] or '{a,b}'::text[].
    SELECT array_agg(item ORDER BY m.n, i.k) INTO vals
    FROM regexp_matches(c.def, '''([^'']*)''', 'g') WITH ORDINALITY AS m(token, n),
         LATERAL unnest(CASE WHEN m.token[1] LIKE '{%}'
                             THEN string_to_array(btrim(m.token[1], '{}'), ',')
                             ELSE ARRAY[m.token[1]] END) WITH ORDINALITY AS i(item, k);
    IF extra = ANY (vals) THEN
      RAISE NOTICE '% on % already allows %', c.conname, c.tbl, extra;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I CHECK (%I = ANY (%L::text[]))', c.tbl, c.conname, col, vals || extra);
    RAISE NOTICE '% on % now allows %', c.conname, c.tbl, extra;
  END LOOP;
END $$;
