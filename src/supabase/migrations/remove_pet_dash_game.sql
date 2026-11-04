-- Undo add_pet_dash_game.sql: take 'petdash' and 'dash_words' out of the CHECK lists again.
-- If rows still use them, this stops with an error and changes nothing. Find those rows first:
--   SELECT id, title FROM public.missions WHERE goal_type = 'dash_words';
--   SELECT id, name FROM public.tournaments WHERE game_type = 'petdash';
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
      AND (pg_get_constraintdef(con.oid) LIKE '%game_type%''petdash''%'
        OR pg_get_constraintdef(con.oid) LIKE '%goal_type%''dash_words''%'
        OR pg_get_constraintdef(con.oid) LIKE '%game_type%{%petdash%}%'
        OR pg_get_constraintdef(con.oid) LIKE '%goal_type%{%dash_words%}%')
  LOOP
    col := CASE WHEN c.def LIKE '%goal_type%' THEN 'goal_type' ELSE 'game_type' END;
    extra := CASE col WHEN 'goal_type' THEN 'dash_words' ELSE 'petdash' END;
    IF c.def !~ ('^CHECK \(\(' || col || ' = ANY \(') THEN
      RAISE EXCEPTION 'Unexpected constraint % on %: %', c.conname, c.tbl, c.def;
    END IF;
    SELECT array_agg(item ORDER BY m.n, i.k) INTO vals
    FROM regexp_matches(c.def, '''([^'']*)''', 'g') WITH ORDINALITY AS m(token, n),
         LATERAL unnest(CASE WHEN m.token[1] LIKE '{%}'
                             THEN string_to_array(btrim(m.token[1], '{}'), ',')
                             ELSE ARRAY[m.token[1]] END) WITH ORDINALITY AS i(item, k);
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I CHECK (%I = ANY (%L::text[]))', c.tbl, c.conname, col, array_remove(vals, extra));
    RAISE NOTICE '% on % no longer allows %', c.conname, c.tbl, extra;
  END LOOP;
END $$;
