-- Questions for the BAND 3 version of "Night Four: Grimhood", the day 4 passage.
--
-- The passage itself is written in the admin screen; this only attaches its
-- questions, by the story id below, checked against its slot.
--
-- All twenty are fill_blank because DAY 4 IS A FILL-IN-THE-BLANK DAY — see
-- STAGES in src/config/eventLadder.js. A passage is only opened on if it alone
-- can carry the whole round in that day's one type.
--
-- The worksheet's six-underscore blank is written as ___ here, which is what
-- the renderer and the payload CHECK both look for, and what every other row in
-- the bank uses.
--
-- Item 19 is the replacement ("Mai cut the coat open with the horn...") rather
-- than the original, which had no blank in it. `shadows` is in the bank and
-- `wide` is not, per the revised list.
--
-- ONE ACCEPTED SPELLING EACH, because the word bank makes each answer exact and
-- every word is used once. Singular and plural are NOT interchangeable here —
-- 10 is `shadow` and 19 is `shadows`, and the sentences require it.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := '52f109b8-d028-4b9a-913f-da0110859ec6';
  v_day integer;
  v_level integer;
BEGIN
  SELECT stage_day, min_level INTO v_day, v_level
  FROM public.event_stories WHERE id = v_story;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  IF v_day IS DISTINCT FROM 4 OR v_level IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Passage % is day % / level %, not day 4 / level 3. Wrong id?', v_story, v_day, v_level;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'fill_blank', v.question, jsonb_build_object('answers', jsonb_build_array(v.answer)),
         'reading', 3, v_story
  FROM (VALUES
    ('The fourth night was very ___.',                                        'bright'),
    ('The ___ was right above them.',                                         'moon'),
    ('The floor of the temple was pale ___.',                                 'stone'),
    ('The candy bag hung on the ___.',                                        'gate'),
    ('Zoe said that the bag was a ___.',                                      'trap'),
    ('A big black ___ walked out of the temple.',                             'coat'),
    ('There was no ___ inside the hood.',                                     'face'),
    ('Grimhood held an ___ of green jade.',                                   'axe'),
    ('The axe was made of green ___.',                                        'jade'),
    ('Finn fell down, and then he said, "My ___ is gone!"',                   'shadow'),
    ('Inside the coat they saw a boy with a ___.',                            'stick'),
    ('Zoe wanted to break the ___.',                                          'lamps'),
    ('When the lamps broke, the ___ went dark.',                              'temple'),
    ('In the ___, Grimhood could still find them.',                           'dark'),
    ('The tall gate made a big black shadow on the ___.',                     'floor'),
    ('The moon went up, so the shadows got ___.',                             'shorter'),
    ('Kai put his back against the ___.',                                     'wall'),
    ('Kai held up his ___, and it made a shadow like a boy.',                 'map'),
    ('Mai cut the coat open with the horn, and hundreds of ___ came out.',    'shadows'),
    ('At the end, the coat fell down and it was ___.',                        'empty')
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
