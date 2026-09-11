-- Questions for the BAND 3 version of "Night Five: The Skeleton", the day 5 passage.
--
-- The passage is named by its id, and CHECKED against its slot: the row must
-- actually be the day 5 / level 3 one. A mis-pasted uuid is the one mistake
-- here that fails silently — the questions land, the migration succeeds, and
-- some other night starts asking about the bridge.
--
-- All twenty are fill_blank because DAY 5 IS A FILL-IN-THE-BLANK DAY — see
-- STAGES in src/config/eventLadder.js. A passage is only opened on if it alone
-- can carry the whole round in that day's one type.
--
-- Items 16 and 17 are the corrected pair: 16 now carries the blank it was
-- missing ("he did it ___" / wrong) and 17 is the "stepped forward" rewrite, so
-- the two no longer collide on the same answer.
--
-- UNLIKE DAYS 1-4, the bank here is not one word per question. `bridge` is the
-- answer to both 2 and 17, and `wet` is a distractor that is never the answer —
-- it appears in the stem of 10, which is where a child skimming for it will
-- find it and be wrong. Both are deliberate and neither is a problem for the
-- app, which grades each row on its own accepted spellings and shows no bank.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := 'a8ce4f60-4fbb-4f7e-9c7b-c0a7f391ce4a';
  v_day integer;
  v_level integer;
BEGIN
  SELECT stage_day, min_level INTO v_day, v_level
  FROM public.event_stories WHERE id = v_story;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  IF v_day IS DISTINCT FROM 5 OR v_level IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Passage % is day % / level %, not day 5 / level 3. Wrong id?', v_story, v_day, v_level;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'fill_blank', v.question, jsonb_build_object('answers', jsonb_build_array(v.answer)),
         'reading', 3, v_story
  FROM (VALUES
    ('It rained all day, and the river was big and ___.',                  'fast'),
    ('The only way across was an old wooden ___.',                         'bridge'),
    ('The candy bag hung in the ___.',                                     'middle'),
    ('It was so cold that they could see their ___.',                      'breath'),
    ('The skeleton had white bones, no skin and no ___.',                  'eyes'),
    ('In its hand was a long ___.',                                        'sword'),
    ('Luna said that the skeleton ___ Finn.',                              'copied'),
    ('Finn got ___, but the skeleton did not.',                            'tired'),
    ('Finn fell on one ___.',                                              'knee'),
    ('The bridge was wet, and everyone made ___.',                         'footprints'),
    ('But where the skeleton walked, the wood was ___.',                   'dry'),
    ('Kai said the skeleton was very ___.',                                'light'),
    ('He said it was only a bag of ___.',                                  'sticks'),
    ('Finn put his foot behind a ___.',                                    'post'),
    ('Now he could not ___.',                                              'fall'),
    ('Finn did the River Sweep slowly, and he did it ___.',                'wrong'),
    ('The skeleton stepped forward, but there was no ___ there.',          'bridge'),
    ('The ___ took the skeleton away at once.',                            'water'),
    ('Milo found a little white ___.',                                     'bone'),
    ('He blew it, and it sang like a ___.',                                'flute')
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
