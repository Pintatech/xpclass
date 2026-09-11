-- A per-question clock, overriding the type's default.
--
-- Time limits started out as one number per question TYPE, in
-- src/config/eventQuestions.js — reading four choices and rebuilding a sentence
-- are not the same amount of work, and that axis covers almost every row. This
-- adds the escape hatch: a single question that needs longer (a fiddly sentence,
-- a long stem, a picture that takes a moment to read) can carry its own.
--
-- NULL is the normal state and means "use the type's default", so every existing
-- row keeps behaving exactly as it did. Only a row that opts in has a number.
--
-- Idempotent: safe to run on a database that already has the column.

ALTER TABLE public.event_question_bank
  ADD COLUMN IF NOT EXISTS seconds integer;

COMMENT ON COLUMN public.event_question_bank.seconds IS
  'Per-question time limit in seconds. NULL uses the default for this question type (see src/config/eventQuestions.js).';

-- Bounds rather than a free integer: 0 or a negative would expire the question
-- before it could be read, and the range is wide enough that no real question
-- bumps into it. ADD CONSTRAINT has no IF NOT EXISTS, hence the guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_question_bank_seconds_range'
  ) THEN
    ALTER TABLE public.event_question_bank
      ADD CONSTRAINT event_question_bank_seconds_range
      CHECK (seconds IS NULL OR (seconds BETWEEN 5 AND 300));
  END IF;
END $$;
