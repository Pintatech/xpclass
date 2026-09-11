-- More LOOSE true/false for level 1 — day 2's question type, and part of the
-- boss's mixed round. See add_event_loose_level1_multiple_choice.sql for why a
-- level-1 student only ever sees loose rows.
--
-- Half true, half false, so guessing one button all round does not win it.
--
-- Guarded per row on type + stem, so re-running this adds nothing twice. Needs
-- add_event_story_bank.sql (for story_id) to have run first.

INSERT INTO public.event_question_bank (type, question, payload, category, min_level)
SELECT v.type, v.question, v.payload::jsonb, v.category, 1
FROM (VALUES
  -- True  ('true_false', 'A dog can run.',                    '{"answer":true}',  'general'),
  ('true_false', 'Milk is white.',                    '{"answer":true}',  'general'),
  ('true_false', 'A bird has two legs.',              '{"answer":true}',  'general'),
  ('true_false', 'We sleep at night.',                '{"answer":true}',  'general'),
  ('true_false', 'An apple is a fruit.',              '{"answer":true}',  'vocabulary'),
  ('true_false', 'Snow is cold.',                     '{"answer":true}',  'general'),
  ('true_false', 'The sky is blue.',                  '{"answer":true}',  'general'),
  ('true_false', 'Ten is more than five.',            '{"answer":true}',  'general'),
  ('true_false', 'A banana is yellow.',               '{"answer":true}',  'vocabulary'),
  ('true_false', 'We eat with our mouth.',            '{"answer":true}',  'vocabulary'),
  ('true_false', '"Cat" means "con mèo".',            '{"answer":true}',  'vocabulary'),
  ('true_false', '"Red" means "màu đỏ".',             '{"answer":true}',  'vocabulary'),
  ('true_false', '"Hello" is a greeting.',            '{"answer":true}',  'vocabulary'),
  ('true_false', 'Monday comes after Sunday.',        '{"answer":true}',  'general'),
  ('true_false', 'A car has four wheels.',            '{"answer":true}',  'general'),
  ('true_false', 'Fish can swim.',                    '{"answer":true}',  'general'),
  ('true_false', '"Mother" means "mẹ".',              '{"answer":true}',  'vocabulary'),
  ('true_false', 'One and one make two.',             '{"answer":true}',  'general'),
  ('true_false', '"Up" is the opposite of "down".',   '{"answer":true}',  'vocabulary'),
  ('true_false', 'We have two eyes.',                 '{"answer":true}',  'general'),

  -- False
  ('true_false', 'A cow can fly.',                    '{"answer":false}', 'general'),
  ('true_false', 'The sun is cold.',                  '{"answer":false}', 'general'),
  ('true_false', 'A pig says "meow".',                '{"answer":false}', 'general'),
  ('true_false', 'Ice is hot.',                       '{"answer":false}', 'general'),
  ('true_false', 'A spider has two legs.',            '{"answer":false}', 'general'),
  ('true_false', 'We see with our ears.',             '{"answer":false}', 'vocabulary'),
  ('true_false', '"Dog" means "con mèo".',            '{"answer":false}', 'vocabulary'),
  ('true_false', '"Book" means "cái bàn".',           '{"answer":false}', 'vocabulary'),
  ('true_false', '"Green" means "màu vàng".',         '{"answer":false}', 'vocabulary'),
  ('true_false', 'Three is more than five.',          '{"answer":false}', 'general'),
  ('true_false', 'An elephant is very small.',        '{"answer":false}', 'general'),
  ('true_false', 'We write with a spoon.',            '{"answer":false}', 'vocabulary'),
  ('true_false', 'A fish has four legs.',             '{"answer":false}', 'general'),
  ('true_false', 'Bananas are blue.',                 '{"answer":false}', 'vocabulary'),
  ('true_false', '"Goodbye" means "xin chào".',       '{"answer":false}', 'vocabulary'),
  ('true_false', '"Father" means "mẹ".',              '{"answer":false}', 'vocabulary'),
  ('true_false', 'Friday comes after Monday.',        '{"answer":false}', 'general'),
  ('true_false', 'A baby is very old.',               '{"answer":false}', 'vocabulary'),
  ('true_false', 'We wear shoes on our hands.',       '{"answer":false}', 'vocabulary'),
  ('true_false', 'A bicycle has four wheels.',        '{"answer":false}', 'general')

) AS v(type, question, payload, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_question_bank q
  WHERE q.type = v.type AND q.question = v.question AND q.story_id IS NULL
);
