-- Questions for the BAND 2 version of "Night Seven: Onikage", the day 7 passage.
--
-- The companion to add_event_story_night_seven_onikage_band3_questions.sql, and
-- the last slot in the week: with this, every day has a passage and a full set
-- of questions in both bands.
--
-- The passage is named by its id, and CHECKED against its slot: the row must
-- actually be the day 7 / level 2 one. A mis-pasted uuid is the one mistake
-- here that fails silently.
--
-- DAY 7 IS THE BOSS, and its stage is MIXED — every type the week taught:
-- multiple_choice, true_false, fill_blank and reorder (LADDER_QUESTION_TYPES in
-- src/config/eventLadder.js). All four are here, one insert apiece, and all
-- twenty count towards whether this passage can carry the round.
--
-- The battle shuffles the round, so these are NOT asked in worksheet order.
--
-- Adjustments from the worksheet, none touching an answer: true/false stems
-- drop their trailing "____", and the two "Organize the sentence" items take
-- the stem every other reorder row uses, "Put the sentence in order."
--
-- Guarded per question: on the stem for the first three types, and on the
-- answer for reorder, whose two rows share a stem. Idempotent; a partial run can
-- be finished by simply running it again.

DO $$
DECLARE
  v_story uuid := 'd174ae26-cd57-4457-8693-2c777200eead';
  v_day integer;
  v_level integer;
BEGIN
  SELECT stage_day, min_level INTO v_day, v_level
  FROM public.event_stories WHERE id = v_story;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  IF v_day IS DISTINCT FROM 7 OR v_level IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Passage % is day % / level %, not day 7 / level 2. Wrong id?', v_story, v_day, v_level;
  END IF;

  -- ── Multiple choice (1-7) ─────────────────────────────────────────────────
  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'multiple_choice', v.question, v.payload::jsonb, 'reading', 2, v_story
  FROM (VALUES
    ('What did the friends have?',
     '{"choices":["Swords","Six bags","A dog"],"answer_index":1}'),
    ('What colour were Onikage''s clothes?',
     '{"choices":["Red and white","Purple and black","Green"],"answer_index":1}'),
    ('How many years?',
     '{"choices":["Six","Ten","Forty"],"answer_index":2}'),
    ('What did Finn hit?',
     '{"choices":["Onikage","The air","The bag"],"answer_index":1}'),
    ('How many Onikages were there?',
     '{"choices":["One","Three","Six"],"answer_index":2}'),
    ('What did Milo blow?',
     '{"choices":["The bone","A bell","The fire"],"answer_index":0}'),
    ('Where did Zoe put the fire?',
     '{"choices":["In the bag","In the stone lamp","In the pot"],"answer_index":1}')
  ) AS v(question, payload)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );

  -- ── True or false (8-14) ──────────────────────────────────────────────────
  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'true_false', v.question, jsonb_build_object('answer', v.answer), 'reading', 2, v_story
  FROM (VALUES
    ('The sword made no sound.',             true),
    ('Onikage took one bag.',                false),
    ('Kai said, "He is very fast."',         true),
    ('The bone worked every time.',          false),
    ('Five copies had no shadow.',           true),
    ('Luna ran at Onikage.',                 false),
    ('Mai gave the fire dry grass.',         true)
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );

  -- ── Fill in the blank (15-18) ─────────────────────────────────────────────
  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'fill_blank', v.question, jsonb_build_object('answers', jsonb_build_array(v.answer)),
         'reading', 2, v_story
  FROM (VALUES
    ('Kai said, "He is very ___."',          'fast'),
    ('The ___ moved. The note changed.',     'air'),
    ('Five ___ had no shadow.',              'copies'),
    ('One Onikage had a big black ___.',     'shadow')
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );

  -- ── Put the sentence in order (19-20) ─────────────────────────────────────
  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'reorder', 'Put the sentence in order.',
         jsonb_build_object('answer', to_jsonb(regexp_split_to_array(v.sentence, ' '))),
         'reading', 2, v_story
  FROM (VALUES
    ('She ran at the shadow'),
    ('They had six bags')
  ) AS v(sentence)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story
      AND q.type = 'reorder'
      AND q.payload->'answer' = to_jsonb(regexp_split_to_array(v.sentence, ' '))
  );
END $$;
