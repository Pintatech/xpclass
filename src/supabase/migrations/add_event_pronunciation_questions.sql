-- A spoken question type for the event battle.
--
-- The week's seven days are read and typed — tap a choice, fill a blank, put a
-- sentence back in order — and not one of them asks a child to open their
-- mouth. This adds the type that does. It is asked ONLY on a redo of a cleared
-- stage, where it REPLACES the day's usual questions (see REPLAY_QUESTION_TYPES
-- in src/config/eventLadder.js), so a replay is a speaking round rather than
-- the same fight for a smaller prize.
--
-- A redo is also the only place it is safe to ask. It banks no level and no
-- first-clear reward, and a question graded by a speech-to-text engine over a
-- phone microphone WILL sometimes mishear a child — so nothing that matters can
-- be lost to a bad recording.
--
-- Grading is transcription, not phoneme assessment: AssemblyAI reports what it
-- heard, and src/utils/speechScore.js scores how much of the phrase came back.
-- It answers "were those the words?", not "how native was that vowel" — the
-- kinder measure, and the only one this API can honestly support.
--
-- payload: {"text": "the phrase to say", "pass": 70}
--   text  what the student reads aloud. At least two words: scored word by word
--         against a transcript, one word is a coin flip on the recogniser.
--   pass  percent of the phrase that must come back, 40-100. Optional; the
--         default lives in DEFAULT_SPEECH_PASS in config/eventQuestions.js.
--
-- Idempotent; safe to re-run. Requires add_event_question_bank.sql first.

-- The shape CHECK pins the set of legal types in its ELSE, so a new type cannot
-- simply be inserted — the constraint has to be replaced wholesale. Dropped and
-- recreated rather than added alongside, because two overlapping CHECKs on the
-- same column would both have to pass and the old one rejects every spoken row.
--
-- Every arm below is unchanged from add_event_question_bank.sql except the new
-- 'pronunciation' one. If a rule changes there, it changes here too — which is
-- the cost of a constraint that enumerates its own types.
ALTER TABLE public.event_question_bank
  DROP CONSTRAINT IF EXISTS event_question_bank_payload_shape;

ALTER TABLE public.event_question_bank
  ADD CONSTRAINT event_question_bank_payload_shape CHECK (
    CASE type
      WHEN 'multiple_choice' THEN
        jsonb_typeof(payload->'choices') = 'array'
        AND jsonb_array_length(payload->'choices') >= 2
        AND jsonb_typeof(payload->'answer_index') = 'number'
        AND (payload->>'answer_index')::integer >= 0
        AND (payload->>'answer_index')::integer < jsonb_array_length(payload->'choices')
      WHEN 'true_false' THEN
        jsonb_typeof(payload->'answer') = 'boolean'
      WHEN 'fill_blank' THEN
        jsonb_typeof(payload->'answers') = 'array'
        AND jsonb_array_length(payload->'answers') >= 1
      WHEN 'reorder' THEN
        jsonb_typeof(payload->'answer') = 'array'
        AND jsonb_array_length(payload->'answer') >= 2
      WHEN 'unscramble' THEN
        jsonb_typeof(payload->'answer') = 'string'
        AND length(payload->>'answer') >= 2
      WHEN 'matching' THEN
        jsonb_typeof(payload->'pairs') = 'array'
        AND jsonb_array_length(payload->'pairs') >= 2
      -- New. `pass` is optional and NULL-safe: a row that omits it inherits the
      -- app default, and one that carries it is held to the same range the
      -- admin form offers, so a hand-written 0 cannot make a phrase unpassable
      -- or a 500 make one impossible.
      WHEN 'pronunciation' THEN
        jsonb_typeof(payload->'text') = 'string'
        AND length(btrim(payload->>'text')) >= 3
        AND (
          payload->'pass' IS NULL
          OR (
            jsonb_typeof(payload->'pass') = 'number'
            AND (payload->>'pass')::integer BETWEEN 40 AND 100
          )
        )
      ELSE false
    END
  );

-- ── Seed ─────────────────────────────────────────────────────────────────────
-- Enough to make a redo of the early days a real round rather than a demo. The
-- phrases are short and concrete on purpose: a child reading aloud under a
-- clock needs a sentence they can hold in one breath, and the grader scores
-- word coverage, so a long phrase is a longer list of chances to be misheard.
--
-- Written as LOOSE questions — no story_id — so they are available on a redo of
-- any day at any level, including level 1, which reads no passages at all.
-- Nothing here is tied to a DAY, and nothing can be: a question's day is
-- implied by its type, and every day's redo asks this same one. To give a day
-- its own speaking round, attach phrases to that day's passage with story_id
-- and the battle will pick them up — see pickEventStory in Dashboard.jsx.
--
-- The phrase is written ONCE, as the payload text, and the stem is filled from
-- it. For this type the question IS the sentence, and two copies of it would be
-- two things to keep in step — including across a re-run of this file, where a
-- guard matching on one and a column rewritten from the other seeds duplicates.
-- The admin form derives the same way on save.

INSERT INTO public.event_question_bank (type, question, payload, category, min_level)
SELECT 'pronunciation', v.text, jsonb_build_object('text', v.text, 'pass', v.pass), 'speaking', v.min_level
FROM (VALUES
  ('I have a red bike',               70, 1),
  ('The cat is sleeping',             70, 1),
  ('My father is a doctor',           70, 1),
  ('We go to school every day',       70, 1),
  ('She is my sister',                70, 1),
  ('The weather is very cold today',  65, 2),
  ('They are reading a book',         70, 2),
  ('I would like some orange juice',  65, 2),
  ('He plays football on Saturday',   65, 2),
  ('My favourite colour is green',    65, 2),
  ('The children are playing outside', 60, 3),
  ('Please open the window for me',   60, 3)
) AS v(text, pass, min_level)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_question_bank q
  WHERE q.type = 'pronunciation' AND q.payload->>'text' = v.text
);
