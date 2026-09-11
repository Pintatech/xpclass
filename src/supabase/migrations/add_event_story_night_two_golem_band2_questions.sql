-- Questions for the BAND 2 version of "Night Two: The Golem", the day 2 passage.
--
-- The companion to add_event_story_night_two_golem_band3_questions.sql. Same
-- night, shorter statements: this band says "the golem got heavier" where band
-- 3 says "every step made the golem heavier", and asks whether the golem could
-- hear the drum rather than whether it could hear at all.
--
-- The passage itself is written in the admin screen; this only attaches its
-- questions, by the story id below.
--
-- All twenty are true_false because DAY 2 IS THE TRUE/FALSE DAY — see STAGES in
-- src/config/eventLadder.js. A passage is only opened on if it alone can carry
-- the whole round in that day's one type.
--
-- The worksheet's trailing "____" is dropped: that is a blank for a child to
-- write T or F in on paper. In the battle the answer is two buttons.
--
-- min_level 2 matches the passage's own band, and is what keeps these away from
-- a level-3 reader, who gets the band-3 passage and its longer statements.
--
-- Idempotent; guarded per question, so a partial run can be finished by simply
-- running it again.

DO $$
DECLARE
  v_story uuid := '6d7db984-9fae-4f90-a992-b3fa7cf0562f';
BEGIN
  -- A wrong id would silently attach twenty questions to nothing: they would
  -- pass the FK as a loose question and quietly pollute every level-2 round in
  -- the week. Better to stop here and say so.
  IF NOT EXISTS (SELECT 1 FROM public.event_stories WHERE id = v_story) THEN
    RAISE EXCEPTION 'No event_stories row with id %. Create the passage first, then re-run.', v_story;
  END IF;

  INSERT INTO public.event_question_bank (type, question, payload, category, min_level, story_id)
  SELECT 'true_false', v.question, jsonb_build_object('answer', v.answer), 'reading', 2, v_story
  FROM (VALUES
    ('The moon was thin.',                    true),
    ('Zoe had a lantern.',                    false),
    ('Kai saw footprints.',                   true),
    ('The golem was very tall.',              true),
    ('The golem had red eyes.',               false),
    ('The golem had a hole in his chest.',    true),
    ('The candy papers were in the hole.',    true),
    ('Finn hit the golem.',                   true),
    ('Kai played his drum.',                  true),
    ('The golem could hear the drum.',        false),
    ('Luna had a mirror.',                    true),
    ('The golem looked at Kai.',              false),
    ('The golem stepped over Milo.',          true),
    ('The small stone came back.',            true),
    ('The golem ate the stones.',             true),
    ('The golem got heavier.',                true),
    ('The friends threw stones.',             true),
    ('Luna ran on the thin floor.',           true),
    ('The golem fell in the water.',          true),
    ('Milo caught the bag.',                  false)
  ) AS v(question, answer)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_question_bank q
    WHERE q.story_id = v_story AND q.question = v.question
  );
END $$;
