-- Questions for the BAND 2 version of "Night Six", the day 6 passage.
--
-- The companion to add_event_story_night_six_fire_band3_questions.sql. Same
-- night in shorter sentences: three to six tiles here where band 3 runs to
-- eleven, and no commas at all, so no tile carries punctuation.
--
-- The passage is named by its id, and CHECKED against its slot: the row must
-- actually be the day 6 / level 2 one. A mis-pasted uuid is the one mistake
-- here that fails silently.
--
-- All twenty are reorder because DAY 6 IS THE REORDER DAY — see STAGES in
-- src/config/eventLadder.js.
--
-- Each sentence is written once, in the right order, and split on spaces into
-- the payload's token list; the battle shuffles the tiles itself on every
-- showing. The final full stop is not a tile, as it was not on the worksheet.
--
-- GUARDED ON THE ANSWER, not the stem: every row shares the stem "Put the
-- sentence in order.", so a stem guard would skip nineteen of them on a re-run.
--
-- Idempotent; a partial run can be finished by simply running it again.

DO $$
DECLARE
  v_story uuid := '12a3740a-9ce5-4808-9f01-cff15c9f1605';
  v_day integer;
  v_level integer;
BEGIN
  SELECT stage_day, min_level INTO v_day, v_level
  FROM public.event_stories WHERE id = v_story;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  IF v_day IS DISTINCT FROM 6 OR v_level IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Passage % is day % / level %, not day 6 / level 2. Wrong id?', v_story, v_day, v_level;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'reorder', 'Put the sentence in order.',
         jsonb_build_object('answer', to_jsonb(regexp_split_to_array(v.sentence, ' '))),
         'reading', 2, v_story
  FROM (VALUES
    ('The sky was orange'),
    ('The straw was on fire'),
    ('He had a red coat'),
    ('His hands were hot'),
    ('The bag was on a pole'),
    ('They put water on the fire'),
    ('Water is no good'),
    ('The branch did not burn'),
    ('Green wood has water in it'),
    ('The straw is moving to him'),
    ('He is pulling in air'),
    ('A candle needs air'),
    ('Then we take his air'),
    ('The walls were thick'),
    ('It had one iron door'),
    ('He will not go in'),
    ('He will go in after me'),
    ('The rabbit found a small hole'),
    ('They shut the iron door'),
    ('Fire needs air')
  ) AS v(sentence)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story
      AND q.type = 'reorder'
      AND q.payload->'answer' = to_jsonb(regexp_split_to_array(v.sentence, ' '))
  );
END $$;
