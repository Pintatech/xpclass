-- Questions for the BAND 3 version of "Night Six", the day 6 passage.
--
-- The passage is named by its id, and CHECKED against its slot: the row must
-- actually be the day 6 / level 3 one. A mis-pasted uuid is the one mistake
-- here that fails silently.
--
-- All twenty are reorder because DAY 6 IS THE REORDER DAY — see STAGES in
-- src/config/eventLadder.js. A passage is only opened on if it alone can carry
-- the whole round in that day's one type.
--
-- EACH SENTENCE IS WRITTEN ONCE, in the right order, and split on spaces into
-- the payload's token list. The worksheet's scrambled order is not stored at
-- all: the battle shuffles the tokens itself on every showing, so a fixed
-- scramble would only have been thrown away. What has to match the worksheet is
-- the SET of tiles, and it does, commas included — "him," and "branch," and
-- "air," are single tiles, exactly as on the page.
--
-- The final full stop is not a tile, because it was not one on the worksheet.
-- Grading ignores case and trailing punctuation anyway (see normalize in
-- prompts/shared.jsx), so a repeated word — the two "water"s in 6, the two
-- "one"s in 16 — can be placed either way round and still be right.
--
-- GUARDED ON THE ANSWER, not the stem. Every row here has the same stem, so a
-- stem guard would see the first row and skip the other nineteen on a re-run.
--
-- Idempotent; a partial run can be finished by simply running it again.

DO $$
DECLARE
  v_story uuid := 'e5105c45-2ccd-4fbd-8466-76b1d0db06b9';
  v_day integer;
  v_level integer;
BEGIN
  SELECT stage_day, min_level INTO v_day, v_level
  FROM public.event_stories WHERE id = v_story;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;
  IF v_day IS DISTINCT FROM 6 OR v_level IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Passage % is day % / level %, not day 6 / level 3. Wrong id?', v_story, v_day, v_level;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'reorder', 'Put the sentence in order.',
         jsonb_build_object('answer', to_jsonb(regexp_split_to_array(v.sentence, ' '))),
         'reading', 3, v_story
  FROM (VALUES
    ('Something big was burning'),
    ('The friends ran to the straw yard'),
    ('A man was standing inside the fire'),
    ('His hands were bare and white-hot'),
    ('The candy bag hung on a tall pole'),
    ('They threw water at him, but the water turned to steam'),
    ('Mai''s sleeve started to smoke'),
    ('Water will not work'),
    ('Milo jumped in front of Mai with his green branch'),
    ('The fire hit the branch, but the branch did not burn'),
    ('Green wood has water inside it'),
    ('The straw is moving towards him'),
    ('He needs air, like a candle'),
    ('Then we will take his air away'),
    ('The walls were thick'),
    ('It had one iron door and one chimney'),
    ('He will never go in there'),
    ('He will go in if he is chasing me'),
    ('A boy could get through it'),
    ('Fire needs air, and now there is none')
  ) AS v(sentence)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story
      AND q.type = 'reorder'
      AND q.payload->'answer' = to_jsonb(regexp_split_to_array(v.sentence, ' '))
  );
END $$;
