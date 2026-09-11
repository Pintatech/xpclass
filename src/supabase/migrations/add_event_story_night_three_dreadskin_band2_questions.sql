-- Questions for the BAND 2 version of "Night Three: Dreadskin", the day 3 passage.
--
-- The passage itself is written in the admin screen; this only attaches its
-- questions, by the story id below.
--
-- All twenty are multiple_choice because DAY 3 IS A MULTIPLE-CHOICE DAY — see
-- STAGES in src/config/eventLadder.js. A passage is only opened on if it alone
-- can carry the whole round in that day's one type.
--
-- Three stems are sentence completions on the worksheet, where the choices
-- finish the line on the page. The battle renders the stem ABOVE the buttons,
-- so each of those has been given a visible ___ rather than being left hanging
-- mid-sentence: "Its head looked like ___." and so on. The choices and the key
-- are untouched.
--
-- min_level 2 matches the passage's own band. The story query takes the highest
-- band at or below the student, so a level-3 reader gets the band-3 passage for
-- this day and never sees these.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := '25e00a43-63c9-46cb-872d-9235a404026b';
BEGIN
  -- A wrong id would silently attach twenty questions to nothing: they would
  -- pass the FK as a loose question and quietly pollute every level-2 round in
  -- the week. Better to stop here and say so.
  IF NOT EXISTS (SELECT 1 FROM public.event_stories WHERE id = v_story) THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  -- And it must be the day 3 / level 2 passage, not merely A passage: a wrong
  -- but existing id would pass the check above and attach these to another night.
  IF NOT EXISTS (SELECT 1 FROM public.event_stories WHERE id = v_story AND stage_day = 3 AND min_level = 2) THEN
    RAISE EXCEPTION 'Passage % is not the day 3 / level 2 one. Wrong id?', v_story;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'multiple_choice', v.question, v.payload::jsonb, 'reading', 2, v_story
  FROM (VALUES
    ('What came back on the third night?',
     '{"choices":["Rain","Wind","Snow"],"answer_index":1}'),
    ('Where did the friends walk to?',
     '{"choices":["The rice fields","The sea","The shop"],"answer_index":0}'),
    ('What was in every field?',
     '{"choices":["Water","Sand","Cows"],"answer_index":0}'),
    ('What was in the rice fields?',
     '{"choices":["A house","A boat","An old black tree"],"answer_index":2}'),
    ('Where did Dreadskin come from?',
     '{"choices":["The water","The sky","The tree"],"answer_index":1}'),
    ('What colour was its head?',
     '{"choices":["Red","Blue","White"],"answer_index":0}'),
    ('Its head looked like ___.',
     '{"choices":["a ball","a pumpkin","a cat"],"answer_index":1}'),
    ('How many horns did it have?',
     '{"choices":["One","Two","Six"],"answer_index":1}'),
    ('What did Dreadskin have in one hand?',
     '{"choices":["A stick","A kite","The candy bag"],"answer_index":2}'),
    ('What did Finn throw?',
     '{"choices":["A stone","His stick","His shoe"],"answer_index":1}'),
    ('What did Milo climb?',
     '{"choices":["The tree","The wall","The gate"],"answer_index":0}'),
    ('Where did Milo fall?',
     '{"choices":["In the water","On the tree","On Kai"],"answer_index":0}'),
    ('What was on Milo''s head?',
     '{"choices":["A hat","A plant","A bird"],"answer_index":1}'),
    ('What colour was the light?',
     '{"choices":["Orange","Green","Blue"],"answer_index":0}'),
    ('What was in Dreadskin?',
     '{"choices":["Water","Candy","A fire"],"answer_index":2}'),
    ('What did Mai have?',
     '{"choices":["A kite","A rope","A ladder"],"answer_index":0}'),
    ('Dreadskin looked at the kite. It did not look at the ___.',
     '{"choices":["tree","string","water"],"answer_index":1}'),
    ('The string came down on the two ___.',
     '{"choices":["feet","horns","hands"],"answer_index":1}'),
    ('What did the friends run around?',
     '{"choices":["The water","The tree","The field"],"answer_index":1}'),
    ('What came up from the water?',
     '{"choices":["Birds","Black smoke","White steam"],"answer_index":2}')
  ) AS v(question, payload)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
