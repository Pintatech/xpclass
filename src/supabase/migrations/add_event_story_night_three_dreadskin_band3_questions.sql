-- Questions for the BAND 3 version of "Night Three: Dreadskin", the day 3 passage.
--
-- The companion to add_event_story_night_three_dreadskin_band2_questions.sql.
-- Same night, harder questions: band 2 asks what colour the head was, this one
-- asks why Zoe wanted Milo to make it laugh a second time.
--
-- The passage is named by its id, and CHECKED against its slot: the row must
-- actually be the day 3 / level 3 one. The id alone would happily attach these
-- twenty questions to any passage in the table, and a mis-pasted uuid is the
-- one mistake here that fails silently — the questions land, the migration
-- succeeds, and some other night starts asking about Dreadskin.
--
-- All twenty are multiple_choice because DAY 3 IS A MULTIPLE-CHOICE DAY — see
-- STAGES in src/config/eventLadder.js. A passage is only opened on if it alone
-- can carry the whole round in that day's one type.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := 'bcb5f3b8-cb7b-4ebb-a2af-fac3ac1a1529';
  v_day integer;
  v_level integer;
BEGIN
  SELECT stage_day, min_level INTO v_day, v_level
  FROM public.event_stories WHERE id = v_story;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  IF v_day IS DISTINCT FROM 3 OR v_level IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Passage % is day % / level %, not day 3 / level 3. Wrong id?', v_story, v_day, v_level;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'multiple_choice', v.question, v.payload::jsonb, 'reading', 3, v_story
  FROM (VALUES
    ('What came back on the third night?',
     '{"choices":["Rain","Wind","Snow"],"answer_index":1}'),
    ('Where did the friends walk to?',
     '{"choices":["The rice fields","The sea","The temple"],"answer_index":0}'),
    ('What was in every field?',
     '{"choices":["Water","Sand","Rice"],"answer_index":0}'),
    ('What was at the top of the fields?',
     '{"choices":["A house","A boat","An old black tree"],"answer_index":2}'),
    ('What did Dreadskin''s head look like?',
     '{"choices":["A ball","A pumpkin","A cat"],"answer_index":1}'),
    ('What colour was its head?',
     '{"choices":["Red","Blue","White"],"answer_index":0}'),
    ('How many horns did it have?',
     '{"choices":["One","Two","Six"],"answer_index":1}'),
    ('What did Finn throw?',
     '{"choices":["A stone","His staff","His shoe"],"answer_index":1}'),
    ('Did the staff hit Dreadskin?',
     '{"choices":["Yes","No","It broke in two"],"answer_index":1}'),
    ('What happened to Milo when he jumped?',
     '{"choices":["He caught the bag","He fell in the water","He climbed higher"],"answer_index":1}'),
    ('What did Kai notice about its feet?',
     '{"choices":["They were big","It never lands","It had no feet"],"answer_index":1}'),
    ('What happened when Dreadskin laughed?',
     '{"choices":["Its head lit up","It came down","It dropped the bag"],"answer_index":0}'),
    ('Why did Zoe want Milo to make it laugh again?',
     '{"choices":["To make it angry","To see the light again","To take the bag"],"answer_index":1}'),
    ('What was inside Dreadskin?',
     '{"choices":["Water","Candy","A fire"],"answer_index":2}'),
    ('Mai said it was not flying. What was it doing?',
     '{"choices":["Jumping","Floating","Falling"],"answer_index":1}'),
    ('What did Mai use to reach it?',
     '{"choices":["A ladder","Her kite","A long rope"],"answer_index":1}'),
    ('Dreadskin watched the kite. What did it not watch?',
     '{"choices":["Mai","The string","The tree"],"answer_index":1}'),
    ('Where did the string catch?',
     '{"choices":["On its nose","On its horns","On its hand"],"answer_index":1}'),
    ('Why did the friends run around the tree?',
     '{"choices":["To make the string shorter","To get away","To find the bag"],"answer_index":0}'),
    ('What went up when Dreadskin hit the water?',
     '{"choices":["Birds","Black smoke","White steam"],"answer_index":2}')
  ) AS v(question, payload)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
