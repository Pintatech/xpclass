-- Reading passages for the event battle.
--
-- The fight used to open on a bare question. It now opens on a story: the
-- student reads a short passage, then answers questions ABOUT that passage, so
-- a round is one piece of reading rather than ten unrelated stems. The day still
-- decides HOW it is asked — multiple choice, true/false, fill in the blank,
-- reorder — which is a knob in src/config/eventLadder.js. This decides WHAT is
-- being asked about.
--
-- WHICH passage is not a lottery: a story names the `stage_day` it belongs to,
-- so the week is seven passages read in order. A day can hold more than one,
-- split by `min_level`, and a student reads the highest band at or below their
-- own level — which is how day 3 can be an easier text for one child and a
-- harder one for another without either of them meeting a passage out of order.
--
-- The youngest readers meet none of it. Below STORY_MIN_LEVEL — a knob in
-- src/config/eventQuestions.js, currently 2 — a fight is drawn from the loose
-- bank instead, because a screen of English before the first question is a wall
-- to a child still sounding out the questions themselves.
--
-- Shape: a story has many questions; a question belongs to at most one story.
-- `story_id` is NULLABLE on purpose, and that is the whole compatibility story:
--   * every question already in the bank keeps working untouched, as a loose
--     question with no passage;
--   * a day with no suitable story falls back to those loose questions instead
--     of opening an empty fight (see openEventBattle in Dashboard.jsx).
-- So this migration can land before a single story is written and nothing
-- breaks — which matters, because the questions are what a fight needs and the
-- passages arrive later, written by a teacher.
--
-- Idempotent; safe to run before or after the other event migrations, and safe
-- to re-run.

CREATE TABLE IF NOT EXISTS public.event_stories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  -- The passage itself. Plain text with blank lines between paragraphs — the
  -- battle renders it as paragraphs and nothing else, because a child reading
  -- under a clock does not need rich text and the panel has no room for it.
  body text NOT NULL,
  -- Optional art above the passage. Unlike a question's image_url this one is
  -- safe to describe, so it carries no answer.
  image_url text,
  category text,
  -- Which day of the ladder reads this passage. A day names its own story, so
  -- the week is seven passages read in order rather than whichever one the
  -- lottery turned up. NULL is a passage written but not yet placed, and no
  -- fight will open on one.
  stage_day integer,
  -- Same ladder as the question bank's, so a story and its questions can be
  -- gated together. It is also what splits one DAY between readers: a day holds
  -- one passage per level band, and a student reads the highest band at or below
  -- their own level, so day 3 is a different text for a level-2 and a level-3
  -- reader. Below STORY_MIN_LEVEL (src/config/eventQuestions.js) no passage is
  -- read at all and the fight is drawn from the loose bank.
  min_level integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_stories_pkey PRIMARY KEY (id),
  -- A passage with nothing in it would be a reading phase with nothing to read.
  CONSTRAINT event_stories_body_present CHECK (length(btrim(body)) > 0)
);

-- For a database that created event_stories before days were attached to them.
ALTER TABLE public.event_stories
  ADD COLUMN IF NOT EXISTS stage_day integer;

COMMENT ON COLUMN public.event_stories.stage_day IS
  'The ladder day that reads this passage. NULL is unplaced, and no fight opens on it.';

ALTER TABLE public.event_question_bank
  ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES public.event_stories(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_question_bank.story_id IS
  'The passage this question is about. NULL is a standalone question, which is what every row was before reading rounds existed.';

-- The battle picks a story, then takes its questions of the day's types. Both
-- halves of that are indexed: the questions of one story, and the stories a
-- level may see.
CREATE INDEX IF NOT EXISTS event_question_bank_story
  ON public.event_question_bank (story_id, type)
  WHERE is_active = true;

-- The battle asks for one DAY's passages at or below a level, hardest band
-- first. Dropped and recreated rather than added to, because the old index led
-- on min_level, which is the wrong leading column once the day is filtered on
-- first and a re-run of CREATE INDEX IF NOT EXISTS would leave it as it was.
DROP INDEX IF EXISTS public.event_stories_pick;
CREATE INDEX IF NOT EXISTS event_stories_pick
  ON public.event_stories (stage_day, min_level)
  WHERE is_active = true;

ALTER TABLE public.event_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_stories_admin" ON public.event_stories;
CREATE POLICY "event_stories_admin"
  ON public.event_stories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "event_stories_read" ON public.event_stories;
CREATE POLICY "event_stories_read"
  ON public.event_stories FOR SELECT
  USING (is_active = true);

-- ── Seed ─────────────────────────────────────────────────────────────────────
-- Two passages, both on DAY 1 and in different level bands, so the day-and-band
-- grid can be walked end to end the moment this runs: a level-2 reader gets the
-- cat, a level-3 reader gets the picnic, a level-1 reader gets neither and
-- fights the loose bank. They are short on purpose — the reading phase is read
-- once, under no clock, by a child, and a screen of text is a wall where five
-- sentences is a story.
--
-- DAYS 2-7 HAVE NO PASSAGE YET and fall back to the loose bank until a teacher
-- writes them. Each one needs monsterHpFor(day) + HERO_LIVES - 1 questions OF
-- THAT DAY'S TYPE (see STAGES in src/config/eventLadder.js) before the battle
-- will open on it, because a passage that cannot carry the whole round is worse
-- than none: the round would finish on questions about nothing.
--
-- Guarded on the title so re-running does not seed them twice; the placement is
-- re-applied on every run, so a story seeded before days existed gets one.

INSERT INTO public.event_stories (title, body, category, stage_day, min_level)
SELECT
  'Mai and the Lost Cat',
  E'Mai has a small cat. Its name is Miu.\n\nOne morning, Miu is not in the house. Mai looks under the bed and behind the door, but she cannot find him.\n\nThen she hears a soft sound in the garden. Miu is in the tree! He is afraid to come down.\n\nMai''s father brings a ladder. He carries Miu down, and Mai is very happy.',
  'reading', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM public.event_stories WHERE title = 'Mai and the Lost Cat');

INSERT INTO public.event_stories (title, body, category, stage_day, min_level)
SELECT
  'The Rainy Picnic',
  E'On Saturday, Nam and his friends want to have a picnic. They make sandwiches and put them in a big bag.\n\nAt the park, the sky turns grey. Soon it starts to rain, and everyone runs under a tree.\n\nNam has an idea. They go back to his house and have the picnic on the floor of his room.\n\nIt is not the picnic they planned, but it is the best day of the week.',
  'reading', 1, 3
WHERE NOT EXISTS (SELECT 1 FROM public.event_stories WHERE title = 'The Rainy Picnic');

-- Place the two seeded passages on their day and band. Written separately from
-- the INSERTs above because those are guarded on the title: a database that ran
-- this migration before stage_day existed already has both rows, so the INSERT
-- is skipped and the placement would never land.
--
-- Only ever fills a BLANK day, never corrects one. A teacher who moves the cat
-- to day 4 has said where it goes, and a re-run of this file is not an argument
-- against them — which is also why min_level rides along inside the same guard
-- rather than being set unconditionally.
UPDATE public.event_stories SET stage_day = 1, min_level = 2
WHERE title = 'Mai and the Lost Cat' AND stage_day IS NULL;

UPDATE public.event_stories SET stage_day = 1, min_level = 3
WHERE title = 'The Rainy Picnic' AND stage_day IS NULL;

-- Questions about "Mai and the Lost Cat".
INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
SELECT v.type, v.question, v.payload::jsonb, 'reading', v.min_level, s.id
FROM public.event_stories s
CROSS JOIN (VALUES
  ('multiple_choice', 'What is the name of Mai''s cat?',            '{"choices":["Miu","Mai","Nam","Bo"],"answer_index":0}', 1),
  ('multiple_choice', 'Where does Mai find her cat?',               '{"choices":["under the bed","behind the door","in the tree","in the garden shed"],"answer_index":2}', 1),
  ('multiple_choice', 'Who helps Mai get the cat down?',            '{"choices":["her father","her teacher","her friend","her brother"],"answer_index":0}', 1),
  ('true_false',      'Miu is missing in the evening.',             '{"answer":false}', 1),
  ('true_false',      'Mai looks under the bed for her cat.',       '{"answer":true}',  1),
  ('true_false',      'Miu comes down from the tree by himself.',   '{"answer":false}', 1),
  ('fill_blank',      'Mai''s cat is called ___.',                  '{"answers":["Miu","miu"]}', 1),
  ('fill_blank',      'Mai''s father brings a ___ to reach the cat.','{"answers":["ladder"]}',   2),
  ('fill_blank',      'Miu is hiding in the ___.',                  '{"answers":["tree"]}',      1),
  ('reorder',         'Put the sentence in order.',                 '{"answer":["Mai","has","a","small","cat"]}', 1),
  ('reorder',         'Put the sentence in order.',                 '{"answer":["Miu","is","in","the","tree"]}',  1),
  ('reorder',         'Put the sentence in order.',                 '{"answer":["Mai","is","very","happy"]}',     1)
) AS v(type, question, payload, min_level)
WHERE s.title = 'Mai and the Lost Cat'
  AND NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q WHERE q.story_id = s.id
  );

-- Questions about "The Rainy Picnic".
INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
SELECT v.type, v.question, v.payload::jsonb, 'reading', v.min_level, s.id
FROM public.event_stories s
CROSS JOIN (VALUES
  ('multiple_choice', 'What day is the picnic?',                    '{"choices":["Friday","Saturday","Sunday","Monday"],"answer_index":1}', 2),
  ('multiple_choice', 'What do they make for the picnic?',          '{"choices":["sandwiches","rice","noodles","cake"],"answer_index":0}',   2),
  ('multiple_choice', 'Where do they finally have the picnic?',     '{"choices":["under a tree","at the park","in Nam''s room","at school"],"answer_index":2}', 2),
  ('true_false',      'It rains at the park.',                      '{"answer":true}',  2),
  ('true_false',      'They cancel the picnic and go home to sleep.','{"answer":false}', 2),
  ('true_false',      'Nam has the idea to move the picnic.',       '{"answer":true}',  2),
  ('fill_blank',      'They put the sandwiches in a big ___.',      '{"answers":["bag"]}',   2),
  ('fill_blank',      'At the park the sky turns ___.',             '{"answers":["grey","gray"]}', 3),
  ('fill_blank',      'They have the picnic on the ___ of his room.','{"answers":["floor"]}', 3),
  ('reorder',         'Put the sentence in order.',                 '{"answer":["Soon","it","starts","to","rain"]}',      2),
  ('reorder',         'Put the sentence in order.',                 '{"answer":["Nam","has","an","idea"]}',               2),
  ('reorder',         'Put the sentence in order.',                 '{"answer":["They","go","back","to","his","house"]}', 3)
) AS v(type, question, payload, min_level)
WHERE s.title = 'The Rainy Picnic'
  AND NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q WHERE q.story_id = s.id
  );
