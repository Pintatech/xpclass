-- SUPERSEDED IN PART by add_event_replay_day_ladder_phrases.sql: the round
-- sizes quoted below were correct when this was written, against a flat
-- REPLAY_MONSTER_HP of 3. The redo now climbs (REPLAY_HP_BY_DAY), so ten per
-- band is no longer the target from day 3 on. Still run this — the ladder file
-- tops up on top of it and both are guarded on the phrase.
--
-- Day-tagged speaking phrases for LEVEL 1, ten per day.
--
-- add_event_replay_day.sql tagged days for bands 2 and 3 and deliberately left
-- level 1 on the untagged pool, on the grounds that the youngest readers do not
-- need novelty. That reasoning holds for a bank of twelve shared sentences read
-- once. It does not hold for a REPLAY: a spoken round is five questions, and
-- level 1 has exactly five phrases it can draw, so every redo of every day is
-- the same five sentences in the same shuffled bag — the one band with no
-- variation at all, and the band least able to say so.
--
-- Ten per day, matching the other two bands after
-- add_event_replay_day_more_phrases.sql, so a redo is a different round and a
-- day survives losing a phrase.
--
-- Band 1 is shorter than band 2 and stays there: three to six words, present
-- simple, one idea per sentence, and every word one a five-year-old reader has
-- already met. Where a phrase here looks like a plainer version of a band 2 one,
-- that is the ladder working — the same picture, fewer moving parts.
--
-- pass 70 throughout, as the existing level 1 rows use. A short phrase is a
-- small denominator: at five words one missed word is twenty percent, so there
-- is no room to be stricter, and no need to be.
--
-- Idempotent; safe to re-run. Requires add_event_replay_day.sql first.

INSERT INTO public.event_question_bank (type, question, payload, category, min_level, stage_day)
SELECT 'pronunciation', v.text, jsonb_build_object('text', v.text, 'pass', v.pass), 'speaking', v.min_level, v.day
FROM (VALUES
  -- Day 1 — the bat. Night, dark, wings.
  ('I see the moon',          70, 1, 1),
  ('The bat is black',        70, 1, 1),
  ('The cave is dark',        70, 1, 1),
  ('The sky is dark',         70, 1, 1),
  ('The bat is small',        70, 1, 1),
  ('It has two wings',        70, 1, 1),
  ('Bats can fly',            70, 1, 1),
  ('I see the stars',         70, 1, 1),
  ('We sleep at night',       70, 1, 1),
  ('I go to sleep',           70, 1, 1),

  -- Day 2 — the golem. Stone, weight, slowness.
  ('The rock is big',         70, 1, 2),
  ('It is very heavy',        70, 1, 2),
  ('The wall is grey',        70, 1, 2),
  ('I can see a stone',       70, 1, 2),
  ('He walks very slowly',    70, 1, 2),
  ('The box is heavy',        70, 1, 2),
  ('It is made of rock',      70, 1, 2),
  ('The hill is high',        70, 1, 2),
  ('I lift my bag',           70, 1, 2),
  ('The giant is big',        70, 1, 2),

  -- Day 3 — the demon. Fire, smoke, being brave.
  ('The fire is hot',         70, 1, 3),
  ('I see a red light',       70, 1, 3),
  ('The smoke is grey',       70, 1, 3),
  ('We run away',             70, 1, 3),
  ('I am not afraid',         70, 1, 3),
  ('The sun is hot',          70, 1, 3),
  ('He is very brave',        70, 1, 3),
  ('The flame is small',      70, 1, 3),
  ('We stay together',        70, 1, 3),
  ('The room is warm',        70, 1, 3),

  -- Day 4 — the machine. Lights, buttons, counting.
  ('The button is red',       70, 1, 4),
  ('The light is green',      70, 1, 4),
  ('The clock is slow',       70, 1, 4),
  ('It goes very fast',       70, 1, 4),
  ('I count to ten',          70, 1, 4),
  ('The machine is big',      70, 1, 4),
  ('The light is on',         70, 1, 4),
  ('I turn it off',           70, 1, 4),
  ('It makes a sound',        70, 1, 4),
  ('The number is five',      70, 1, 4),

  -- Day 5 — the skeleton. An empty house, cold, quiet.
  ('The house is old',        70, 1, 5),
  ('My hands are cold',       70, 1, 5),
  ('The door is open',        70, 1, 5),
  ('The room is dark',        70, 1, 5),
  ('I walk up the stairs',    70, 1, 5),
  ('Nobody is here',          70, 1, 5),
  ('The floor is cold',       70, 1, 5),
  ('I hear a noise',          70, 1, 5),
  ('The window is open',      70, 1, 5),
  ('It is very quiet',        70, 1, 5),

  -- Day 6 — the satyr. Woods, water, music.
  ('The tree is green',       70, 1, 6),
  ('I hear the birds',        70, 1, 6),
  ('The water is cold',       70, 1, 6),
  ('He plays a song',         70, 1, 6),
  ('We walk in the forest',   70, 1, 6),
  ('The grass is green',      70, 1, 6),
  ('I like this music',       70, 1, 6),
  ('The river is long',       70, 1, 6),
  ('The forest is quiet',     70, 1, 6),
  ('We sit on the grass',     70, 1, 6),

  -- Day 7 — the ninja, and the boss. Fast, quiet, the last day.
  ('I am ready',              70, 1, 7),
  ('He is very fast',         70, 1, 7),
  ('This is the last day',    70, 1, 7),
  ('I can do it',             70, 1, 7),
  ('We are a team',           70, 1, 7),
  ('She is very quiet',       70, 1, 7),
  ('I try my best',           70, 1, 7),
  ('The fight is now',        70, 1, 7),
  ('We win together',         70, 1, 7),
  ('I am not afraid now',     70, 1, 7)
) AS v(text, pass, min_level, day)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_question_bank q
  WHERE q.type = 'pronunciation' AND q.payload->>'text' = v.text
);
