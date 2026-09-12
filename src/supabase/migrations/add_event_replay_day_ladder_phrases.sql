-- Stocking the spoken bank for a replay ladder that CLIMBS.
--
-- The redo used to be three hit points on every day of the week, so five
-- phrases per day/band covered it. It now rises 8/8/9/9/10/10/12 — see
-- REPLAY_HP_BY_DAY in src/config/eventLadder.js — which asks 10, 11, 12 and 14
-- questions. Ten phrases per day/band no longer covers that: from day 3 on, the
-- round would be shorter than the monster needs and the student would lose a
-- fight they answered perfectly.
--
-- This tops every day up to its own round PLUS TWO. The two are not spare
-- capacity for its own sake — they are what lets a teacher deactivate a phrase
-- with a typo in it without silently shortening that day's round for everyone,
-- which is a failure with no error message and no way to notice it from the
-- admin screen.
--
--   day 1-2   8 hp -> asks 10 -> stocked to 12  (+2 per band)
--   day 3-4   9 hp -> asks 11 -> stocked to 13  (+3)
--   day 5-6  10 hp -> asks 12 -> stocked to 14  (+4)
--   day 7    12 hp -> asks 14 -> stocked to 16  (+6)
--
-- Note what this does NOT buy: variety. A round of 14 drawn from 16 is very
-- nearly the whole bag, so two redos of day 7 hold much the same sentences in a
-- different order. For a speaking drill that is defensible — repetition is how
-- pronunciation improves, unlike a reading question where a second sighting
-- means the answer is remembered rather than worked out. If a redo should feel
-- like DIFFERENT questions rather than the same ones reordered, the band has to
-- run closer to twice the round, which is another six to ten phrases a day.
--
-- Bands, thresholds and day colouring are unchanged from the three files before
-- this one. Band 1 three to five words, band 2 four to seven, band 3 five to
-- nine with a clause or a past tense, and the longest of band 3 at 60 because
-- word coverage gets harsher the more words there are to mishear.
--
-- Idempotent; safe to re-run. Requires add_event_replay_day.sql first.

INSERT INTO public.event_question_bank (type, question, payload, category, min_level, stage_day)
SELECT 'pronunciation', v.text, jsonb_build_object('text', v.text, 'pass', v.pass), 'speaking', v.min_level, v.day
FROM (VALUES
  -- Day 1 — the bat. +2 per band.
  ('The night is long',                       70, 1, 1),
  ('I am not sleepy',                         70, 1, 1),
  ('The bat flies over the tree',             70, 2, 1),
  ('I take my torch outside',                 70, 2, 1),
  ('They only come out after sunset',         65, 3, 1),
  ('The whole cave was full of them',         65, 3, 1),

  -- Day 2 — the golem. +2 per band.
  ('I push the rock',                         70, 1, 2),
  ('My legs are tired',                       70, 1, 2),
  ('The stone door will not open',            70, 2, 2),
  ('He carries a big rock',                   70, 2, 2),
  ('The ground shook when it walked',         65, 3, 2),
  ('No one could move the great stone',       65, 3, 2),

  -- Day 3 — the demon. +3 per band.
  ('I can see the fire',                      70, 1, 3),
  ('It is too hot',                           70, 1, 3),
  ('We are not scared',                       70, 1, 3),
  ('The fire lights up the room',             70, 2, 3),
  ('I cover my eyes',                         70, 2, 3),
  ('The smoke goes up high',                  70, 2, 3),
  ('The heat made the air shake',             65, 3, 3),
  ('Nobody wanted to go near the flames',     65, 3, 3),
  ('She walked through the smoke without stopping', 60, 3, 3),

  -- Day 4 — the machine. +3 per band.
  ('The wheel goes round',                    70, 1, 4),
  ('I hear a beep',                           70, 1, 4),
  ('The box is open',                         70, 1, 4),
  ('The engine starts at once',               70, 2, 4),
  ('I follow the green line',                 70, 2, 4),
  ('Every light is blinking now',             70, 2, 4),
  ('It stopped when the power went off',      65, 3, 4),
  ('She checked the numbers one more time',   65, 3, 4),
  ('The machine copied every move he made',   60, 3, 4),

  -- Day 5 — the skeleton. +4 per band.
  ('The bed is empty',                        70, 1, 5),
  ('I look behind me',                        70, 1, 5),
  ('The light is off',                        70, 1, 5),
  ('It is cold here',                         70, 1, 5),
  ('The old clock has stopped',               70, 2, 5),
  ('I walk down the dark hall',               70, 2, 5),
  ('The chairs are covered in dust',          70, 2, 5),
  ('I can see my own breath',                 70, 2, 5),
  ('The candle went out by itself',           65, 3, 5),
  ('Every door in the house was locked',      65, 3, 5),
  ('He could hear his own heart beating',     60, 3, 5),
  ('The dust had not been touched for years', 60, 3, 5),

  -- Day 6 — the satyr. +4 per band.
  ('The bird is small',                       70, 1, 6),
  ('I like the trees',                        70, 1, 6),
  ('The sun is warm',                         70, 1, 6),
  ('We walk very far',                        70, 1, 6),
  ('The flute plays a soft song',             70, 2, 6),
  ('I sit beside the water',                  70, 2, 6),
  ('The leaves fall from the tree',           70, 2, 6),
  ('We follow the small path',                70, 2, 6),
  ('He knew the forest better than anyone',   65, 3, 6),
  ('The trees looked taller in the evening',  65, 3, 6),
  ('They walked until the music stopped',     65, 3, 6),
  ('The tune stayed in her head all day',     60, 3, 6),

  -- Day 7 — the ninja, and the boss. +6 per band, the biggest round of the week.
  ('This is the last one',                    70, 1, 7),
  ('I am not tired',                          70, 1, 7),
  ('We are very close',                       70, 1, 7),
  ('He is my friend',                         70, 1, 7),
  ('I know what to do',                       70, 1, 7),
  ('The day is here',                         70, 1, 7),
  ('We have trained all week',                70, 2, 7),
  ('The last monster is waiting',             70, 2, 7),
  ('I will not run away',                     70, 2, 7),
  ('She never makes a sound',                 70, 2, 7),
  ('This is what we practised for',           70, 2, 7),
  ('The end is very close',                   70, 2, 7),
  ('He had waited all week for this',         65, 3, 7),
  ('The last one is always the hardest',      65, 3, 7),
  ('No one had ever beaten him before',       65, 3, 7),
  ('She took one deep breath and began',      65, 3, 7),
  ('Everything she learned came back to her', 60, 3, 7),
  ('They stood together at the final door',   60, 3, 7)
) AS v(text, pass, min_level, day)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_question_bank q
  WHERE q.type = 'pronunciation' AND q.payload->>'text' = v.text
);
