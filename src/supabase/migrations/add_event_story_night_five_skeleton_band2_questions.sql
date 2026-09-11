-- Questions for the BAND 2 version of "Night Five: The Skeleton", the day 5 passage.
--
-- The passage is named by its id, and CHECKED against its slot: the row must
-- actually be the day 5 / level 2 one. A mis-pasted uuid is the one mistake
-- here that fails silently.
--
-- All twenty are fill_blank because DAY 5 IS A FILL-IN-THE-BLANK DAY — see
-- STAGES in src/config/eventLadder.js.
--
-- The tail is the corrected version: the original item 20 carried two blanks in
-- one stem, which the renderer cannot express — there is one input box, so the
-- second blank would be unanswerable. It is split into "Milo found a small
-- white ___" and "Milo blew the bone. It sang like a ___", and the old "There
-- was no ___" is dropped, since bridge already answers item 2.
--
-- Bank and answers are one-to-one again here: twenty words, twenty questions,
-- each used exactly once.
--
-- `Kai` at 12 is the one proper noun in any of these sets. It grades fine — the
-- comparison is case-insensitive, so a child who types "kai" is marked right.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := '55583e72-1e75-4d79-b964-3fcfbecef277';
  v_day integer;
  v_level integer;
BEGIN
  SELECT stage_day, min_level INTO v_day, v_level
  FROM public.event_stories WHERE id = v_story;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  IF v_day IS DISTINCT FROM 5 OR v_level IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Passage % is day % / level %, not day 5 / level 2. Wrong id?', v_story, v_day, v_level;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'fill_blank', v.question, jsonb_build_object('answers', jsonb_build_array(v.answer)),
         'reading', 2, v_story
  FROM (VALUES
    ('The river was big and ___.',                    'fast'),
    ('There was one ___.',                            'bridge'),
    ('The candy bag was in the ___.',                 'middle'),
    ('It was very ___.',                              'cold'),
    ('They could see their ___.',                     'breath'),
    ('The skeleton had no ___.',                      'eyes'),
    ('The skeleton had a long ___.',                  'sword'),
    ('The skeleton ___ Finn.',                        'copied'),
    ('Finn was ___.',                                 'tired'),
    ('The children made ___.',                        'footprints'),
    ('The wood was ___.',                             'dry'),
    ('___ said, "It is a bag of sticks."',            'Kai'),
    ('The skeleton was very ___.',                    'light'),
    ('It was a bag of ___.',                          'sticks'),
    ('Finn put his foot behind a ___.',               'post'),
    ('Now he could not ___.',                         'fall'),
    ('Finn did the move ___.',                        'badly'),
    ('Milo found a small white ___.',                 'bone'),
    ('The ___ took the skeleton away.',               'water'),
    ('Milo blew the bone. It sang like a ___.',       'flute')
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
