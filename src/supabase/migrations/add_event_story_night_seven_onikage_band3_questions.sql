-- Questions for the BAND 3 version of "Night Seven: Onikage", the day 7 passage.
--
-- The passage is named by its id, and CHECKED against its slot: the row must
-- actually be the day 7 / level 3 one. A mis-pasted uuid is the one mistake
-- here that fails silently.
--
-- DAY 7 IS THE BOSS, and the only day that asks more than one kind of question.
-- Its stage is MIXED, which means every type the week has already taught —
-- multiple_choice, true_false, fill_blank and reorder (LADDER_QUESTION_TYPES in
-- src/config/eventLadder.js). All four of those are here, one insert apiece,
-- and all twenty count towards whether this passage can carry the round.
--
-- The battle shuffles the round, so these are NOT asked in worksheet order: a
-- multiple choice question may come after the reorder that follows it on paper.
--
-- Two small adjustments from the worksheet, neither touching an answer:
--   * true/false stems drop their trailing "____" — the answer is two buttons;
--   * the two "Organize the sentence" items take the stem every other reorder
--     row uses, "Put the sentence in order.", so the boss reads like the week.
--
-- `Copies` at 17 is stored capitalised because it opens the sentence and the
-- reveal shows it as written. Grading ignores case, so "copies" is right too.
--
-- Guarded per question: on the stem for the first three types, and on the
-- answer for reorder, whose two rows share a stem. Idempotent; a partial run can
-- be finished by simply running it again.

DO $$
DECLARE
  v_story uuid := 'd4e6582c-057e-441b-9c46-342b6c3e4f49';
  v_day integer;
  v_level integer;
BEGIN
  SELECT stage_day, min_level INTO v_day, v_level
  FROM public.event_stories WHERE id = v_story;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  IF v_day IS DISTINCT FROM 7 OR v_level IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Passage % is day % / level %, not day 7 / level 3. Wrong id?', v_story, v_day, v_level;
  END IF;

  -- ── Multiple choice (1-7) ─────────────────────────────────────────────────
  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'multiple_choice', v.question, v.payload::jsonb, 'reading', 3, v_story
  FROM (VALUES
    ('What did the friends carry up the hill?',
     '{"choices":["Swords","Six bags","Nothing"],"answer_index":1}'),
    ('Onikage never took a bag. Why did he give the bags away?',
     '{"choices":["They were heavy","He wanted to see brave children","He did not like candy"],"answer_index":1}'),
    ('For how long was no child brave?',
     '{"choices":["Six nights","Ten years","Forty years"],"answer_index":2}'),
    ('Finn hit at Onikage. What did Finn hit?',
     '{"choices":["The sword","Only air","The shadow"],"answer_index":1}'),
    ('Why did Finn hit only air?',
     '{"choices":["He was tired","Onikage was too fast","His eyes were closed"],"answer_index":1}'),
    ('What did Milo use?',
     '{"choices":["The white bone","A drum","A rabbit"],"answer_index":0}'),
    ('Onikage ran past Milo. What happened to the note?',
     '{"choices":["It stopped","It changed","It got louder"],"answer_index":1}')
  ) AS v(question, payload)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );

  -- ── True or false (8-14) ──────────────────────────────────────────────────
  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'true_false', v.question, jsonb_build_object('answer', v.answer), 'reading', 3, v_story
  FROM (VALUES
    ('Onikage''s sword made no sound.',                  true),
    ('Onikage took one bag on the first night.',         false),
    ('There were six Onikages, one for every child.',    true),
    ('The bone trick worked every time.',                false),
    ('Five of them had no shadow.',                      true),
    ('Luna ran at Onikage.',                             false),
    ('Mai gave the fire dry grass.',                     true)
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );

  -- ── Fill in the blank (15-18) ─────────────────────────────────────────────
  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'fill_blank', v.question, jsonb_build_object('answers', jsonb_build_array(v.answer)),
         'reading', 3, v_story
  FROM (VALUES
    ('Kai said, "He is too ___."',                        'fast'),
    ('The moving ___ changed the note of the bone.',      'air'),
    ('___ do not have shadows.',                          'Copies'),
    ('The real Onikage had a big black ___.',             'shadow')
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );

  -- ── Put the sentence in order (19-20) ─────────────────────────────────────
  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'reorder', 'Put the sentence in order.',
         jsonb_build_object('answer', to_jsonb(regexp_split_to_array(v.sentence, ' '))),
         'reading', 3, v_story
  FROM (VALUES
    ('She ran at the shadow'),
    ('Copies do not have shadows')
  ) AS v(sentence)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story
      AND q.type = 'reorder'
      AND q.payload->'answer' = to_jsonb(regexp_split_to_array(v.sentence, ' '))
  );
END $$;
