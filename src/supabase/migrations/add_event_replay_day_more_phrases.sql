-- SUPERSEDED IN PART by add_event_replay_day_ladder_phrases.sql: the round
-- sizes quoted below were correct when this was written, against a flat
-- REPLAY_MONSTER_HP of 3. The redo now climbs (REPLAY_HP_BY_DAY), so ten per
-- band is no longer the target from day 3 on. Still run this — the ladder file
-- tops up on top of it and both are guarded on the phrase.
--
-- A second set of day-tagged speaking phrases: five more per band, per day.
--
-- add_event_replay_day.sql stocked each day/band with exactly five, which is
-- exactly what a replay asks for — REPLAY_MONSTER_HP 3 plus the two mistakes
-- allowed on the way. Exactly enough is a thin place to stand: every redo of a
-- day drew the same five sentences in a shuffled order, so the second attempt
-- was the first one again, and a single row deactivated for a typo would open a
-- fight that runs out of questions before the monster runs out of health.
--
-- Ten per band is the smallest number that fixes both. A round of five drawn
-- from ten is a different round each time, and the day survives losing a phrase.
--
-- Everything else is unchanged from that file and deliberately so: same two
-- bands, same day colouring, same pass thresholds, same guard. Band 2 is
-- present simple and concrete; band 3 adds a clause, a past tense, or a cluster
-- worth practising, and the longest of them drop to 60 because word coverage
-- over a phone microphone gets harsher the more words there are to mishear.
--
-- Vocabulary stays deliberately plain. These are graded by transcription, not
-- by a phoneme model, so an uncommon word is not a harder exercise — it is a
-- higher chance the recogniser hands back something the scorer cannot match,
-- and the child is marked wrong for a word they said correctly.
--
-- Idempotent; safe to re-run. Requires add_event_replay_day.sql first.

INSERT INTO public.event_question_bank (type, question, payload, category, min_level, stage_day)
SELECT 'pronunciation', v.text, jsonb_build_object('text', v.text, 'pass', v.pass), 'speaking', v.min_level, v.day
FROM (VALUES
  -- Day 1 — the bat. Night, dark, wings, the cave.
  ('The moon is big and round',                70, 2, 1),
  ('The cave is cold and quiet',               70, 2, 1),
  ('Bats do not like the sun',                 70, 2, 1),
  ('We walk home before dark',                 70, 2, 1),
  ('I hold my torch very tight',               70, 2, 1),
  ('It flew past me without making a sound',   65, 3, 1),
  ('She listened but the sound had stopped',   65, 3, 1),
  ('Hundreds of wings moved at the same time', 65, 3, 1),
  ('The cave was darker than the night outside', 60, 3, 1),
  ('The bat found its way using only sound',   60, 3, 1),

  -- Day 2 — the golem. Stone, weight, slowness.
  ('The old bridge is made of rock',           70, 2, 2),
  ('My arms are tired from lifting',           70, 2, 2),
  ('The path is full of stones',               70, 2, 2),
  ('It moves one step at a time',              70, 2, 2),
  ('The ground shakes under my feet',          70, 2, 2),
  ('The giant was made of rock and earth',     65, 3, 2),
  ('They could not move it on their own',      65, 3, 2),
  ('Every step left a mark in the ground',     65, 3, 2),
  ('The stone was colder than the water',      65, 3, 2),
  ('It looked like a hill until it moved',     60, 3, 2),

  -- Day 3 — the demon. Fire, smoke, being brave anyway.
  ('The flames are bright and tall',           70, 2, 3),
  ('I can feel the heat from here',            70, 2, 3),
  ('We keep away from the fire',               70, 2, 3),
  ('The sky turned red at night',              70, 2, 3),
  ('He is brave and very calm',                70, 2, 3),
  ('The fire burned for the whole night',      65, 3, 3),
  ('She stood her ground and did not run',     65, 3, 3),
  ('Smoke made it hard to see the door',       65, 3, 3),
  ('He stayed calm while the others ran',      65, 3, 3),
  ('The heat pushed them back towards the wall', 60, 3, 3),

  -- Day 4 — the machine. Lights, buttons, counting, exactness.
  ('The red light starts to flash',            70, 2, 4),
  ('I turn the handle to the left',            70, 2, 4),
  ('The clock counts every second',            70, 2, 4),
  ('The machine never stops working',          70, 2, 4),
  ('The screen shows a green number',          70, 2, 4),
  ('The wheels turned faster and faster',      65, 3, 4),
  ('He checked each wire before starting it',  65, 3, 4),
  ('It repeated the same movement all day',    65, 3, 4),
  ('One wrong number stops the whole machine', 60, 3, 4),
  ('The lights blinked in a steady pattern',   60, 3, 4),

  -- Day 5 — the skeleton. An empty house, cold, counting steps.
  ('The door opens very slowly',               70, 2, 5),
  ('I cannot see in the dark hall',            70, 2, 5),
  ('The window is broken and old',             70, 2, 5),
  ('We go up the stairs together',             70, 2, 5),
  ('Something is moving downstairs',           70, 2, 5),
  ('Nobody had opened that door for years',    65, 3, 5),
  ('They held their breath and kept walking',  65, 3, 5),
  ('He felt cold air under the door',          65, 3, 5),
  ('The stairs made a noise under his feet',   60, 3, 5),
  ('The room was empty but the light was on',  60, 3, 5),

  -- Day 6 — the satyr. Woods, music, trickery.
  ('The tall trees hide the sky',              70, 2, 6),
  ('I follow the path to the river',           70, 2, 6),
  ('The song is soft and slow',                70, 2, 6),
  ('We sit under the old tree',                70, 2, 6),
  ('The water is clear and cold',              70, 2, 6),
  ('She stopped walking and listened again',   65, 3, 6),
  ('He smiled but his eyes were not kind',     65, 3, 6),
  ('Every path led back to the same tree',     65, 3, 6),
  ('The music seemed to come from everywhere', 60, 3, 6),
  ('The forest looked different on the way back', 60, 3, 6),

  -- Day 7 — the ninja, and the boss. Quiet, quick, the end of the week.
  ('I am not going to give up',                70, 2, 7),
  ('We have come a long way',                  70, 2, 7),
  ('The shadow moves along the wall',          70, 2, 7),
  ('He waits for the right moment',            70, 2, 7),
  ('This is my best try',                      70, 2, 7),
  ('The last fight is the one you remember',   65, 3, 7),
  ('They had trained for exactly this moment', 65, 3, 7),
  ('Winning quietly is still winning',         65, 3, 7),
  ('Every day of practice brought her here',   60, 3, 7),
  ('He was gone before anyone could turn around', 60, 3, 7)
) AS v(text, pass, min_level, day)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_question_bank q
  WHERE q.type = 'pronunciation' AND q.payload->>'text' = v.text
);
