-- A day for the spoken questions, so every redo reads something different.
--
-- The seven days never needed this. A day's questions are found by their TYPE,
-- because each day asks a different one — day 2 is the true/false day, day 6 is
-- the reorder day, and that is how a row knows where it belongs.
--
-- The replay breaks that. Every day's redo asks the same one type, so type
-- carries no day at all and all seven redos drew from one shared pool: read the
-- same twelve phrases on Monday and on Sunday. This writes the day onto the row
-- instead, which is what event_stories.stage_day already does for passages —
-- same word, same meaning, deliberately.
--
-- NULL stays meaningful and is the common case: an untagged phrase belongs to
-- no day and is the fallback pool for a day nobody has written yet. A day with
-- phrases of its own never blends them in — see replayPool in Dashboard.jsx —
-- so writing a day's five sentences takes that day off the generic pool
-- entirely, and a half-written week degrades one day at a time.
--
-- The LEVEL axis is the min_level already on the row, but read differently for
-- a replay: the highest band at or below the student, and only that band. The
-- ordinary bank query is a `lte`, which would hand a level-3 speaker the
-- level-2 sentences too and quietly collapse the two levels onto the same easy
-- pool. Passages resolve their bands the same way.
--
-- Idempotent; safe to re-run. Requires add_event_pronunciation_questions.sql.

ALTER TABLE public.event_question_bank
  ADD COLUMN IF NOT EXISTS stage_day integer;

COMMENT ON COLUMN public.event_question_bank.stage_day IS
  'The ladder day whose REDO asks this question. Only meaningful for replay types (pronunciation), where every day asks the same type and so the day cannot be implied by it. NULL is the shared fallback pool.';

-- The replay query: one type, one day (or none), at or below a level.
CREATE INDEX IF NOT EXISTS event_question_bank_replay
  ON public.event_question_bank (type, stage_day, min_level)
  WHERE is_active = true;

-- ── Seed ─────────────────────────────────────────────────────────────────────
-- Five phrases per day per band, which is exactly a replay round: three hit
-- points and two allowed mistakes (REPLAY_MONSTER_HP + HERO_LIVES - 1). A day
-- stocked to five can never run its speaking round dry, and asking for more
-- than five sentences aloud is where a child goes hoarse and starts guessing.
--
-- Two bands, 2 and 3, because those are the levels that read. Level 1 is left
-- on the untagged pool from add_event_pronunciation_questions.sql: it is the
-- level that gets no passages either, and the same twelve simple sentences on
-- every redo is the right amount of novelty for the youngest readers.
--
-- Band 2 is present simple and concrete — things in a room, things a child
-- does. Band 3 adds a clause, a past tense, or a consonant cluster worth
-- practising. Each day is loosely coloured by the monster it replays, so the
-- week reads as written rather than as a list that happened to be split seven
-- ways.
--
-- Guarded on the phrase, which is also the stem, so re-running seeds nothing
-- twice and an edited phrase is left alone rather than reverted.

INSERT INTO public.event_question_bank (type, question, payload, category, min_level, stage_day)
SELECT 'pronunciation', v.text, jsonb_build_object('text', v.text, 'pass', v.pass), 'speaking', v.min_level, v.day
FROM (VALUES
  -- Day 1 — the bat. Night, and small animals.
  ('The bat sleeps in the day',              70, 2, 1),
  ('It is dark outside my window',           70, 2, 1),
  ('I can hear a small sound',               70, 2, 1),
  ('The little bat has black wings',         70, 2, 1),
  ('We go to bed at nine',                   70, 2, 1),
  ('The bat hangs upside down in the cave',  65, 3, 1),
  ('I heard something moving in the dark',   65, 3, 1),
  ('Bats sleep all day and fly at night',    65, 3, 1),
  ('Its wings are thin and very quiet',      65, 3, 1),
  ('Nobody saw the bat leave the tree',      65, 3, 1),

  -- Day 2 — the golem. Stone, weight, slowness.
  ('The big rock is very heavy',             70, 2, 2),
  ('I cannot lift this box',                 70, 2, 2),
  ('The wall is made of stone',              70, 2, 2),
  ('He walks slowly up the hill',            70, 2, 2),
  ('My bag is too heavy today',              70, 2, 2),
  ('The stone giant moves very slowly',      65, 3, 2),
  ('These rocks are harder than they look',  65, 3, 2),
  ('He pushed the heavy door open',          65, 3, 2),
  ('The old wall stood for a hundred years', 65, 3, 2),
  ('Nothing could break the grey stone',     65, 3, 2),

  -- Day 3 — the demon. Fire, heat, courage.
  ('The fire is very hot',                   70, 2, 3),
  ('I am not afraid of the dark',            70, 2, 3),
  ('The red light is on',                    70, 2, 3),
  ('She runs away from the smoke',           70, 2, 3),
  ('We stay together in the cave',           70, 2, 3),
  ('The flames were bright and very hot',    65, 3, 3),
  ('He was brave enough to stay',            65, 3, 3),
  ('Thick smoke filled the whole room',      65, 3, 3),
  ('They ran towards the light instead',     65, 3, 3),
  ('Being afraid is not the same as losing', 65, 3, 3),

  -- Day 4 — axion. Machines, speed, precision.
  ('The machine is very fast',               70, 2, 4),
  ('I press the blue button',                70, 2, 4),
  ('The lights turn on and off',             70, 2, 4),
  ('It moves in a straight line',            70, 2, 4),
  ('My watch tells me the time',             70, 2, 4),
  ('The machine works faster than a person', 65, 3, 4),
  ('She pressed the button three times',     65, 3, 4),
  ('Every part must fit exactly',            65, 3, 4),
  ('The engine started with a loud noise',   65, 3, 4),
  ('It counted down from ten to one',        65, 3, 4),

  -- Day 5 — the skeleton. Bones, cold, the old and quiet.
  ('My hands are very cold',                 70, 2, 5),
  ('The old house is empty',                 70, 2, 5),
  ('I count the steps to the door',          70, 2, 5),
  ('There is nobody in the room',            70, 2, 5),
  ('The floor makes a loud noise',           70, 2, 5),
  ('The empty house was cold and silent',    65, 3, 5),
  ('She counted every step on the stairs',   65, 3, 5),
  ('Something moved behind the closed door', 65, 3, 5),
  ('The old bones had been there for years', 65, 3, 5),
  ('He whispered so nobody would hear him',  65, 3, 5),

  -- Day 6 — the satyr. Woods, music, trickery.
  ('I hear music in the trees',              70, 2, 6),
  ('The forest is green and quiet',          70, 2, 6),
  ('He plays a small flute',                 70, 2, 6),
  ('We walk along the river',                70, 2, 6),
  ('The birds sing every morning',           70, 2, 6),
  ('The music came from deep in the forest', 65, 3, 6),
  ('He played a tune nobody had heard',      65, 3, 6),
  ('They followed the sound through the trees', 60, 3, 6),
  ('The path turned and turned again',       65, 3, 6),
  ('Not everything in the wood is friendly', 60, 3, 6),

  -- Day 7 — the ninja, and the boss. Quiet, quick, the end of the week.
  ('He moves without a sound',               70, 2, 7),
  ('The last fight is today',                70, 2, 7),
  ('I am ready to begin',                    70, 2, 7),
  ('She is quick and very quiet',            70, 2, 7),
  ('We finish what we started',              70, 2, 7),
  ('He crossed the room without a sound',    65, 3, 7),
  ('This is the last day of the week',       65, 3, 7),
  ('She had practised for seven days',       60, 3, 7),
  ('Nothing they had learned was wasted',    60, 3, 7),
  ('The quietest fighter wins the longest fight', 60, 3, 7)
) AS v(text, pass, min_level, day)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_question_bank q
  WHERE q.type = 'pronunciation' AND q.payload->>'text' = v.text
);
