-- Questions for the BAND 3 version of "Night Two: The Golem", the day 2 passage.
--
-- The passage itself is written in the admin screen; this only attaches its
-- questions, by the story id below.
--
-- All twenty are true_false because DAY 2 IS THE TRUE/FALSE DAY — see STAGES in
-- src/config/eventLadder.js. A passage is only opened on if it alone can carry
-- the whole round in that day's one type, so a day-2 story needs its questions
-- in this type and no other. The same passage asked as multiple choice would
-- leave day 2 falling back to the loose bank.
--
-- The worksheet's trailing "____" is dropped: that is a blank for a child to
-- write T or F in on paper. In the battle the answer is two buttons, and a
-- stem ending in a blank would read as a fill-in-the-gap question.
--
-- min_level 3 matches the passage's own band. The story query takes the highest
-- band at or below the student, so a level-2 reader gets the band-2 passage for
-- this day and never sees these.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := 'ed0a9f71-3636-4115-88d7-35354b52dd6d';
BEGIN
  -- A wrong id would silently attach twenty questions to nothing: they would
  -- pass the FK as a loose question and quietly pollute every level-3 round in
  -- the week. Better to stop here and say so.
  IF NOT EXISTS (SELECT 1 FROM public.event_stories WHERE id = v_story) THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'true_false', v.question, jsonb_build_object('answer', v.answer), 'reading', 3, v_story
  FROM (VALUES
    ('The moon was thin tonight.',                        true),
    ('Zoe still had her lantern.',                        false),
    ('Kai found footprints in hard rock.',                true),
    ('The golem was taller than one man.',                true),
    ('The golem had two red eyes.',                       false),
    ('There was a crack in its chest.',                   true),
    ('The candy papers were inside the crack.',           true),
    ('Finn''s first hit broke the golem.',                false),
    ('Kai''s drum made the golem turn around.',           false),
    ('The golem could not hear.',                         true),
    ('Luna used a mirror.',                               true),
    ('The golem looked at all six children.',             false),
    ('The golem stepped over Milo.',                      true),
    ('The small piece of stone went back to the golem.',  true),
    ('The old footprints were deeper than the new ones.', false),
    ('Every step made the golem heavier.',                true),
    ('The friends threw stones on purpose.',              true),
    ('The thin floor broke under Luna.',                  false),
    ('Finn caught the candy bag.',                        true),
    ('Luna lost her mirror by accident.',                 false)
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
