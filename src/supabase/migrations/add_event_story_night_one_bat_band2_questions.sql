-- Questions for the BAND 2 version of "Night One: The Bat", the day 1 passage.
--
-- The companion to add_event_story_night_one_bat_questions.sql, which carries
-- the band 3 set. Same night, same events, easier questions: this band asks
-- mostly what a reader can point at in the text — colours, counts, who carried
-- what — where band 3 asks why the mirror failed and what gave Zoe the idea.
-- Day 1 therefore reads differently for a level-2 and a level-3 student without
-- either of them meeting a passage out of turn.
--
-- The passage itself is written in the admin screen; this only attaches its
-- questions, by the story id below.
--
-- All twenty are multiple_choice because DAY 1 IS THE MULTIPLE-CHOICE DAY —
-- see STAGES in src/config/eventLadder.js. A passage is only opened on if it
-- alone can carry the whole round in that day's one type.
--
-- min_level 2 matches the passage's own band, and is what keeps these away from
-- a level-3 reader: the story query takes the highest band at or below the
-- student, so a level-3 student gets the band-3 passage and its harder set.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := 'a980aebb-6ce9-41c3-94ba-c31cdac0a49b';
BEGIN
  -- A wrong id would silently attach twenty questions to nothing: they would
  -- pass the FK as a loose question and quietly pollute every level-2 round in
  -- the week. Better to stop here and say so.
  IF NOT EXISTS (SELECT 1 FROM public.event_stories WHERE id = v_story) THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'multiple_choice', v.question, v.payload::jsonb, 'reading', 2, v_story
  FROM (VALUES
    ('What night was it?',
     '{"choices":["Mid-Autumn night","New Year","A school night"],"answer_index":0}'),
    ('What colour was the moon?',
     '{"choices":["Gold","Blue","Green"],"answer_index":0}'),
    ('What was in the big basket?',
     '{"choices":["Toys","Candy","Fruit"],"answer_index":1}'),
    ('Who was the candy for?',
     '{"choices":["The six friends","All the children","Onikage"],"answer_index":1}'),
    ('How many friends looked after the basket?',
     '{"choices":["Three","Six","Ten"],"answer_index":1}'),
    ('What did Zoe have?',
     '{"choices":["A drum","A kite","A lantern"],"answer_index":2}'),
    ('What did Kai have?',
     '{"choices":["A drum","A stick","A mirror"],"answer_index":0}'),
    ('What was in Milo''s coat?',
     '{"choices":["A cat","A white rabbit","Candy"],"answer_index":1}'),
    ('What colour were Onikage''s clothes?',
     '{"choices":["Red and gold","Purple and black","White"],"answer_index":1}'),
    ('How many bags did the monsters take?',
     '{"choices":["Four","Six","Ten"],"answer_index":1}'),
    ('Where did the children go?',
     '{"choices":["Crow Hill","The river","The school"],"answer_index":0}'),
    ('What was on the hill?',
     '{"choices":["An old tower","A shop","A big tree"],"answer_index":0}'),
    ('What was at the top of the tower?',
     '{"choices":["A bell","A bed","A light"],"answer_index":0}'),
    ('What colour was the bat?',
     '{"choices":["White","Black","Blue"],"answer_index":1}'),
    ('What colour were the bat''s eyes?',
     '{"choices":["Red","Blue","Green"],"answer_index":0}'),
    ('What did Finn hit at the bat with?',
     '{"choices":["A stone","His stick","His shoe"],"answer_index":1}'),
    ('What did the bat do to Mai''s kite?',
     '{"choices":["It took it","It cut it","It ate it"],"answer_index":1}'),
    ('The bat is ___.',
     '{"choices":["blind","very old","asleep"],"answer_index":0}'),
    ('Why did Zoe take off her shoes?',
     '{"choices":["To be quiet","To run fast","They were wet"],"answer_index":0}'),
    ('What did Zoe hit the bell with?',
     '{"choices":["Her stick","Her drum","Her lantern"],"answer_index":2}')
  ) AS v(question, payload)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
