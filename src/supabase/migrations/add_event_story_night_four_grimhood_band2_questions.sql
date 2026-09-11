-- Questions for the BAND 2 version of "Night Four: Grimhood", the day 4 passage.
--
-- The companion to add_event_story_night_four_grimhood_band3_questions.sql.
-- Same night, shorter sentences: this band splits what band 3 says in one line
-- across two — "Kai held up his ___" and then "The map made a shadow. It looked
-- like a ___" — where band 3 has the whole thing as a single stem.
--
-- The passage is named by its id, and CHECKED against its slot: the row must
-- actually be the day 4 / level 2 one. The id alone would happily attach these
-- twenty questions to any passage in the table, and a mis-pasted uuid is the
-- one mistake here that fails silently — the questions land, the migration
-- succeeds, and some other night starts asking about Grimhood.
--
-- All twenty are fill_blank because DAY 4 IS A FILL-IN-THE-BLANK DAY — see
-- STAGES in src/config/eventLadder.js. A passage is only opened on if it alone
-- can carry the whole round in that day's one type.
--
-- The worksheet's six-underscore blank is written as ___ here, which is what
-- the renderer and the payload CHECK both look for.
--
-- ONE ACCEPTED SPELLING EACH, because the word bank makes each answer exact and
-- every word is used once. Note 9 is `fell`, not `fall` — the sentence is past
-- tense and the bank offers only the one form.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := '54775a90-1557-4019-92e1-3a3c8d32e3b8';
  v_day integer;
  v_level integer;
BEGIN
  SELECT stage_day, min_level INTO v_day, v_level
  FROM public.event_stories WHERE id = v_story;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  IF v_day IS DISTINCT FROM 4 OR v_level IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Passage % is day % / level %, not day 4 / level 2. Wrong id?', v_story, v_day, v_level;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'fill_blank', v.question, jsonb_build_object('answers', jsonb_build_array(v.answer)),
         'reading', 2, v_story
  FROM (VALUES
    ('The fourth night was very ___.',                      'bright'),
    ('The ___ was above them.',                             'moon'),
    ('The temple floor was white ___.',                     'stone'),
    ('The candy bag was on the ___.',                       'gate'),
    ('Zoe said, "It is a ___."',                            'trap'),
    ('A big black ___ walked out.',                         'coat'),
    ('There was no ___ in the hood.',                       'face'),
    ('It had a green ___.',                                 'axe'),
    ('Finn ran at it. Then Finn ___ down.',                 'fell'),
    ('Finn said, "My ___ is gone!"',                        'shadow'),
    ('They saw a boy with a ___.',                          'stick'),
    ('Zoe said, "Break the ___!"',                          'lamps'),
    ('The temple was ___ now.',                             'dark'),
    ('The gate made a big ___ shadow.',                     'black'),
    ('The moon went up. The shadows got ___.',              'short'),
    ('Kai put his back on the ___.',                        'wall'),
    ('His shadow was not on the ___.',                      'floor'),
    ('Kai held up his ___.',                                'map'),
    ('The map made a shadow. It looked like a ___.',        'boy'),
    ('The coat fell down. It was ___.',                     'empty')
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
