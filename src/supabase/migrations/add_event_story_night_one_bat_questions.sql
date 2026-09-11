-- Questions for "Night One: The Bat" (A2), the day 1 passage.
--
-- The passage itself is written in the admin screen; this only attaches its
-- questions, by the story id below. Nothing here creates or edits a story, so
-- the text stays editable in the UI without a migration fighting it.
--
-- All twenty are multiple_choice because DAY 1 IS THE MULTIPLE-CHOICE DAY —
-- see STAGES in src/config/eventLadder.js. A passage is only opened on if it
-- alone can carry the whole round in that day's one type, so a day-1 story
-- needs its questions in this type and no other.
--
-- min_level 3 matches the passage's own band. The bank query is a `lte`, so
-- these are visible to a level-3 reader and to anyone above who has no harder
-- passage of their own; a level-2 reader on day 1 gets the band-2 passage and
-- never sees these.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := 'eac97fdf-3f6f-4a1e-8060-9cdfa92f2fd7';
BEGIN
  -- A wrong id would silently attach twenty questions to nothing: they would
  -- pass the FK as a loose question and quietly pollute every level-3 round in
  -- the week. Better to stop here and say so.
  IF NOT EXISTS (SELECT 1 FROM public.event_stories WHERE id = v_story) THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'multiple_choice', v.question, v.payload::jsonb, 'reading', 3, v_story
  FROM (VALUES
    ('What was in the big basket?',
     '{"choices":["Toys","Candy","Fruit"],"answer_index":1}'),
    ('Who was the candy for?',
     '{"choices":["The six friends","All the children","The monsters"],"answer_index":1}'),
    ('Why were the six friends in the square?',
     '{"choices":["To eat the candy","To look after the basket","To meet Onikage"],"answer_index":1}'),
    ('What happened just before Onikage came?',
     '{"choices":["The bell rang","All the lights went out","It started to rain"],"answer_index":1}'),
    ('What did Milo carry?',
     '{"choices":["A drum","A mirror","A green branch"],"answer_index":2}'),
    ('How many bags did the monsters take?',
     '{"choices":["Four","Six","Ten"],"answer_index":1}'),
    ('What did Onikage tell the children to do?',
     '{"choices":["Go home","Come and get the bags","Ring the bell"],"answer_index":1}'),
    ('Where did the children go first?',
     '{"choices":["Crow Hill","The rice fields","The temple"],"answer_index":0}'),
    ('What hung at the top of the tower?',
     '{"choices":["A bell","A lantern","A bag"],"answer_index":0}'),
    ('How was the bat hanging?',
     '{"choices":["Upside down","On the bell","By the door"],"answer_index":0}'),
    ('What did the bat say when it saw the lantern?',
     '{"choices":["Go away","You have a light","The candy is mine"],"answer_index":1}'),
    ('What happened to Mai''s kite?',
     '{"choices":["The bat cut it","It flew away","Finn caught it"],"answer_index":0}'),
    ('Luna flashed her mirror. What did the bat do?',
     '{"choices":["It screamed","It did not blink","It flew away"],"answer_index":1}'),
    ('Why did the mirror not work on the bat?',
     '{"choices":["It was too dark","The bat was blind","The bat closed its eyes"],"answer_index":1}'),
    ('How did the bat find the children?',
     '{"choices":["It saw them","It heard them","It smelled them"],"answer_index":1}'),
    ('Who gave Zoe the idea?',
     '{"choices":["Kai''s drum","Milo''s rabbit","Luna''s mirror"],"answer_index":0}'),
    ('Why did Zoe take off her shoes?',
     '{"choices":["To run faster","To climb quietly","Because they were wet"],"answer_index":1}'),
    ('What did Zoe hit the bell with?',
     '{"choices":["Her shoe","Her hand","Her lantern"],"answer_index":2}'),
    ('Why could the bat not fly after the bell?',
     '{"choices":["It was hurt","It could not hear","It was too dark"],"answer_index":1}'),
    ('What happened to Zoe''s lantern?',
     '{"choices":["It broke","The bat took it","She dropped it"],"answer_index":0}')
  ) AS v(question, payload)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
