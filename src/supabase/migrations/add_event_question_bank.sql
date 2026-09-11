-- The event battle's own question bank.
--
-- The battle used to draw from pet_question_bank, which can only describe one
-- kind of question: a stem, four choices, an index. The ladder now wants a
-- different KIND of question each day — type a missing word, put a sentence back
-- in order, match pairs — so the shape of an answer is no longer fixed and the
-- shared table could not hold it without breaking every pet game that reads
-- `answer_index` off a row.
--
-- Hence a table of its own. `type` says how a row is asked and graded, and
-- `payload` carries whatever that type needs; the CHECK below is what stops a
-- row being written in a shape its renderer cannot read. Which day asks which
-- type is NOT here — that is a knob in src/config/eventLadder.js, so the week
-- can be re-cut without a migration.
--
-- Self-contained; safe to run before or after the other event migrations.

CREATE TABLE IF NOT EXISTS public.event_question_bank (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type text NOT NULL DEFAULT 'multiple_choice',
  -- The stem. Every type has one, so it stays a column rather than a payload
  -- key: it is what an admin searches by and what a list screen shows.
  question text NOT NULL,
  -- Type-specific. See the CHECK for the shape each type must supply.
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text,
  category text,
  min_level integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_question_bank_pkey PRIMARY KEY (id),

  -- A malformed row is a crash in the middle of a fight, and there is no admin
  -- screen yet to keep hand-written SQL honest — so the shapes are enforced
  -- here. The ELSE also pins the set of legal types: a row whose type has no
  -- renderer cannot be inserted at all.
  CONSTRAINT event_question_bank_payload_shape CHECK (
    CASE type
      WHEN 'multiple_choice' THEN
        jsonb_typeof(payload->'choices') = 'array'
        AND jsonb_array_length(payload->'choices') >= 2
        AND jsonb_typeof(payload->'answer_index') = 'number'
        AND (payload->>'answer_index')::integer >= 0
        AND (payload->>'answer_index')::integer < jsonb_array_length(payload->'choices')
      WHEN 'true_false' THEN
        jsonb_typeof(payload->'answer') = 'boolean'
      -- Several accepted spellings, because "is" and "'s" are both right and a
      -- child who types the other one has not made a mistake.
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
      ELSE false
    END
  )
);

-- The battle's only query: active rows of one or more types, at or below the
-- student's level.
CREATE INDEX IF NOT EXISTS event_question_bank_pick
  ON public.event_question_bank (type, min_level)
  WHERE is_active = true;

ALTER TABLE public.event_question_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_questions_admin" ON public.event_question_bank;
CREATE POLICY "event_questions_admin"
  ON public.event_question_bank FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "event_questions_read" ON public.event_question_bank;
CREATE POLICY "event_questions_read"
  ON public.event_question_bank FOR SELECT
  USING (is_active = true);

-- ── Seed ─────────────────────────────────────────────────────────────────────
-- Enough of each type that a ten-question round does not repeat itself. Levels
-- follow the pet bank's range: 1 is the first week of class, 4 is comfortable.

-- multiple_choice — payload {"choices": [...], "answer_index": n}
INSERT INTO public.event_question_bank (type, question, payload, category, min_level) VALUES
('multiple_choice', 'Which animal says "meow"?',            '{"choices":["dog","cat","cow","duck"],"answer_index":1}',        'vocabulary', 1),
('multiple_choice', 'What colour is the sun?',              '{"choices":["blue","green","yellow","purple"],"answer_index":2}', 'vocabulary', 1),
('multiple_choice', 'How many legs does a spider have?',    '{"choices":["six","eight","four","ten"],"answer_index":1}',       'general',    1),
('multiple_choice', 'The opposite of "hot" is ___.',        '{"choices":["warm","cold","big","fast"],"answer_index":1}',       'vocabulary', 1),
('multiple_choice', 'Which one is a fruit?',                '{"choices":["carrot","banana","potato","onion"],"answer_index":1}','vocabulary', 1),
('multiple_choice', 'She ___ to school every day.',         '{"choices":["go","goes","going","gone"],"answer_index":1}',       'grammar',    2),
('multiple_choice', 'The book is ___ the desk. (trên bàn)', '{"choices":["in","on","at","under"],"answer_index":1}',           'grammar',    2),
('multiple_choice', 'What is the past tense of "eat"?',     '{"choices":["eated","ate","eaten","eats"],"answer_index":1}',     'grammar',    3),
('multiple_choice', 'Which word means "bác sĩ"?',           '{"choices":["teacher","doctor","farmer","driver"],"answer_index":1}','vocabulary',2),
('multiple_choice', 'I have ___ apple in my bag.',          '{"choices":["a","an","the","some"],"answer_index":1}',            'grammar',    3),
('multiple_choice', 'Which season comes after summer?',     '{"choices":["spring","autumn","winter","monsoon"],"answer_index":1}','general',  3),
('multiple_choice', 'They ___ playing football now.',       '{"choices":["is","am","are","be"],"answer_index":2}',             'grammar',    3);

-- true_false — payload {"answer": true|false}
INSERT INTO public.event_question_bank (type, question, payload, category, min_level) VALUES
('true_false', 'A cat has four legs.',                    '{"answer":true}',  'general',    1),
('true_false', 'The sun rises in the west.',              '{"answer":false}', 'general',    1),
('true_false', '"Big" is the opposite of "small".',       '{"answer":true}',  'vocabulary', 1),
('true_false', 'Fish can live out of water.',             '{"answer":false}', 'general',    1),
('true_false', 'There are seven days in a week.',         '{"answer":true}',  'general',    1),
('true_false', '"Mouse" becomes "mouses" in the plural.', '{"answer":false}', 'grammar',    2),
('true_false', 'We use "an" before a vowel sound.',       '{"answer":true}',  'grammar',    2),
('true_false', 'The past tense of "go" is "goed".',       '{"answer":false}', 'grammar',    2),
('true_false', '"Happy" and "glad" mean almost the same.','{"answer":true}',  'vocabulary', 3),
('true_false', 'A triangle has four sides.',              '{"answer":false}', 'general',    1),
('true_false', 'December is the last month of the year.', '{"answer":true}',  'general',    2),
('true_false', '"Quickly" is an adjective.',              '{"answer":false}', 'grammar',    4);

-- fill_blank — the stem carries ___ ; payload {"answers": ["accepted", ...]}
-- Several spellings are accepted where more than one is right: a child who
-- types "'s" instead of "is" has not made a mistake.
INSERT INTO public.event_question_bank (type, question, payload, category, min_level) VALUES
('fill_blank', 'A baby dog is called a ___.',          '{"answers":["puppy"]}',       'vocabulary', 1),
('fill_blank', 'The opposite of "day" is ___.',        '{"answers":["night"]}',       'vocabulary', 1),
('fill_blank', 'We see with our ___. (đôi mắt)',       '{"answers":["eyes","eye"]}',  'vocabulary', 1),
('fill_blank', 'My name ___ Nam.',                     '{"answers":["is","''s"]}',    'grammar',    1),
('fill_blank', 'There are ___ days in a week. (số)',   '{"answers":["seven","7"]}',   'general',    1),
('fill_blank', 'She ___ a teacher. (thì hiện tại)',    '{"answers":["is","''s"]}',    'grammar',    2),
('fill_blank', 'The past tense of "run" is ___.',      '{"answers":["ran"]}',         'grammar',    3),
('fill_blank', 'We wear shoes on our ___. (đôi chân)', '{"answers":["feet"]}',        'vocabulary', 2),
('fill_blank', 'The colour of grass is ___.',          '{"answers":["green"]}',       'vocabulary', 1),
('fill_blank', 'I ___ not like coffee.',               '{"answers":["do"]}',          'grammar',    2),
('fill_blank', 'The plural of "child" is ___.',        '{"answers":["children"]}',    'grammar',    3),
('fill_blank', 'An animal that gives us milk is a ___.','{"answers":["cow"]}',        'vocabulary', 2);

-- reorder — payload {"answer": [words in the right order]} ; shuffled on screen
INSERT INTO public.event_question_bank (type, question, payload, category, min_level) VALUES
('reorder', 'Put the sentence in order.', '{"answer":["I","like","ice","cream"]}',             'grammar', 1),
('reorder', 'Put the sentence in order.', '{"answer":["She","is","my","sister"]}',             'grammar', 1),
('reorder', 'Put the sentence in order.', '{"answer":["The","cat","is","sleeping"]}',          'grammar', 1),
('reorder', 'Put the sentence in order.', '{"answer":["We","go","to","school"]}',              'grammar', 1),
('reorder', 'Put the sentence in order.', '{"answer":["He","plays","football","every","day"]}','grammar', 2),
('reorder', 'Put the sentence in order.', '{"answer":["My","father","is","a","doctor"]}',      'grammar', 2),
('reorder', 'Put the sentence in order.', '{"answer":["They","are","reading","a","book"]}',    'grammar', 2),
('reorder', 'Put the sentence in order.', '{"answer":["I","did","not","see","him"]}',          'grammar', 3),
('reorder', 'Put the sentence in order.', '{"answer":["Where","do","you","live"]}',            'grammar', 3),
('reorder', 'Put the sentence in order.', '{"answer":["She","has","a","red","bike"]}',         'grammar', 2),
('reorder', 'Put the sentence in order.', '{"answer":["The","weather","is","very","cold"]}',   'grammar', 3),
('reorder', 'Put the sentence in order.', '{"answer":["I","have","been","to","Hanoi"]}',       'grammar', 4);

-- unscramble — payload {"answer": "word"} ; the letters are shuffled on screen
INSERT INTO public.event_question_bank (type, question, payload, category, min_level) VALUES
('unscramble', 'A big grey animal with a long nose.',   '{"answer":"elephant"}', 'vocabulary', 2),
('unscramble', 'You read it. (quyển sách)',             '{"answer":"book"}',     'vocabulary', 1),
('unscramble', 'It shines in the sky in the daytime.',  '{"answer":"sun"}',      'vocabulary', 1),
('unscramble', 'You sit on it. (cái ghế)',              '{"answer":"chair"}',    'vocabulary', 1),
('unscramble', 'The colour of the sky.',                '{"answer":"blue"}',     'vocabulary', 1),
('unscramble', 'A person who teaches you. (giáo viên)', '{"answer":"teacher"}',  'vocabulary', 2),
('unscramble', 'You write with it. (bút chì)',          '{"answer":"pencil"}',   'vocabulary', 2),
('unscramble', 'The first month of the year.',          '{"answer":"january"}',  'general',    3),
('unscramble', 'A yellow fruit monkeys love.',          '{"answer":"banana"}',   'vocabulary', 1),
('unscramble', 'Where you live with your family.',      '{"answer":"house"}',    'vocabulary', 1),
('unscramble', 'The season of snow.',                   '{"answer":"winter"}',   'general',    2),
('unscramble', 'You use it to open a door.',            '{"answer":"key"}',      'vocabulary', 2);

-- matching — payload {"pairs": [[left, right], ...]} ; the right column shuffles.
-- Three pairs, not four: a round is ten questions whatever the type, and four
-- pairs ten times over is a chore rather than a fight.
INSERT INTO public.event_question_bank (type, question, payload, category, min_level) VALUES
('matching', 'Match the word to its meaning.',   '{"pairs":[["cat","mèo"],["dog","chó"],["bird","chim"]]}',                     'vocabulary', 1),
('matching', 'Match the colour to its meaning.', '{"pairs":[["red","đỏ"],["blue","xanh dương"],["green","xanh lá"]]}',          'vocabulary', 1),
('matching', 'Match the word to its opposite.',  '{"pairs":[["hot","cold"],["big","small"],["fast","slow"]]}',                  'vocabulary', 1),
('matching', 'Match the word to its meaning.',   '{"pairs":[["book","quyển sách"],["pen","cái bút"],["bag","cái cặp"]]}',       'vocabulary', 1),
('matching', 'Match the job to its meaning.',    '{"pairs":[["doctor","bác sĩ"],["teacher","giáo viên"],["farmer","nông dân"]]}','vocabulary',2),
('matching', 'Match the verb to its past tense.','{"pairs":[["go","went"],["eat","ate"],["see","saw"]]}',                       'grammar',    3),
('matching', 'Match the word to its opposite.',  '{"pairs":[["happy","sad"],["open","closed"],["early","late"]]}',              'vocabulary', 2),
('matching', 'Match the animal to its home.',    '{"pairs":[["bird","nest"],["bee","hive"],["dog","kennel"]]}',                 'general',    3),
('matching', 'Match the number to the word.',    '{"pairs":[["3","three"],["5","five"],["8","eight"]]}',                        'general',    1),
('matching', 'Match the verb to its past tense.','{"pairs":[["buy","bought"],["bring","brought"],["think","thought"]]}',        'grammar',    4),
('matching', 'Match the food to its meaning.',   '{"pairs":[["rice","cơm"],["bread","bánh mì"],["milk","sữa"]]}',               'vocabulary', 1),
('matching', 'Match the word to its meaning.',   '{"pairs":[["hand","bàn tay"],["foot","bàn chân"],["head","cái đầu"]]}',       'vocabulary', 2);
