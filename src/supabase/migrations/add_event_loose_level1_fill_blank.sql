-- More LOOSE fill-in-the-blank for level 1 — the type for days 4 AND 5, so this
-- pool carries two fights back to back, and part of the boss's mixed round. See
-- add_event_loose_level1_multiple_choice.sql for why a level-1 student only ever
-- sees loose rows.
--
-- A typed answer is the hardest thing a beginner is asked, so every stem pins
-- its blank to ONE word: a Vietnamese gloss in brackets, a counting pattern, or
-- a phrase a first-week class says every day. "I like ___." would be a fair
-- sentence and an unfair question — a child who types "cats" has not been wrong.
--
-- Where more than one spelling is right, all of them are accepted: mum and mom,
-- a digit for a number, "'s" for "is". The first entry is the one the reveal
-- shows after a wrong answer. Case, spaces and trailing punctuation are ignored
-- by the grader (normalize in components/event/prompts/shared.jsx).
--
-- Guarded per row on type + stem, so re-running this adds nothing twice. Needs
-- add_event_story_bank.sql (for story_id) to have run first.

INSERT INTO public.event_question_bank (type, question, payload, category, min_level)
SELECT v.type, v.question, v.payload::jsonb, v.category, 1
FROM (VALUES
  -- Words, pinned by a Vietnamese gloss
  ('fill_blank', 'I have a ___. (con mèo)',              '{"answers":["cat"]}',                                   'vocabulary'),
  ('fill_blank', 'This is my ___. (quyển sách)',         '{"answers":["book"]}',                                  'vocabulary'),
  ('fill_blank', 'I eat a ___. (quả chuối)',             '{"answers":["banana"]}',                                'vocabulary'),
  ('fill_blank', 'The ___ is red. (quả táo)',            '{"answers":["apple"]}',                                 'vocabulary'),
  ('fill_blank', 'I drink ___. (sữa)',                   '{"answers":["milk"]}',                                  'vocabulary'),
  ('fill_blank', 'My ___ is a teacher. (mẹ)',            '{"answers":["mother","mom","mum","mommy","mummy"]}',    'vocabulary'),
  ('fill_blank', 'My ___ is tall. (bố)',                 '{"answers":["father","dad","daddy"]}',                  'vocabulary'),
  ('fill_blank', 'Look at the ___! (con chim)',          '{"answers":["bird"]}',                                  'vocabulary'),
  ('fill_blank', 'I can see a ___. (con cá)',            '{"answers":["fish"]}',                                  'vocabulary'),
  ('fill_blank', 'Open the ___, please. (cái cửa)',      '{"answers":["door"]}',                                  'vocabulary'),
  ('fill_blank', 'Sit on the ___. (cái ghế)',            '{"answers":["chair"]}',                                 'vocabulary'),
  ('fill_blank', 'This is a ___. (cái bút)',             '{"answers":["pen"]}',                                   'vocabulary'),
  ('fill_blank', 'I have a red ___. (quả bóng)',         '{"answers":["ball"]}',                                  'vocabulary'),
  ('fill_blank', 'The ___ is hot today. (mặt trời)',     '{"answers":["sun"]}',                                   'vocabulary'),
  ('fill_blank', 'I brush my ___. (răng)',               '{"answers":["teeth"]}',                                 'vocabulary'),
  ('fill_blank', 'Wash your ___. (đôi tay)',             '{"answers":["hands","hand"]}',                          'vocabulary'),
  ('fill_blank', 'I love my ___. (con chó)',             '{"answers":["dog"]}',                                   'vocabulary'),
  ('fill_blank', 'The ___ is big. (ngôi nhà)',           '{"answers":["house"]}',                                 'vocabulary'),
  ('fill_blank', 'I eat ___ every day. (cơm)',           '{"answers":["rice"]}',                                  'vocabulary'),
  ('fill_blank', 'It is ___ today. (trời nắng)',         '{"answers":["sunny"]}',                                 'vocabulary'),
  ('fill_blank', 'I wear a ___ on my head. (cái mũ)',    '{"answers":["hat","cap"]}',                             'vocabulary'),
  ('fill_blank', 'I go to ___ every day. (trường học)',  '{"answers":["school"]}',                                'vocabulary'),
  ('fill_blank', 'I sleep in my ___. (cái giường)',      '{"answers":["bed"]}',                                   'vocabulary'),

  -- Colours
  ('fill_blank', 'The sky is ___. (màu xanh dương)',     '{"answers":["blue"]}',                                  'vocabulary'),
  ('fill_blank', 'A banana is ___. (màu vàng)',          '{"answers":["yellow"]}',                                'vocabulary'),
  ('fill_blank', 'Snow is ___. (màu trắng)',             '{"answers":["white"]}',                                 'vocabulary'),
  ('fill_blank', 'An orange is ___. (màu cam)',          '{"answers":["orange"]}',                                'vocabulary'),
  ('fill_blank', 'My bag is ___. (màu đen)',             '{"answers":["black"]}',                                 'vocabulary'),

  -- Numbers
  ('fill_blank', 'One, two, ___, four.',                 '{"answers":["three","3"]}',                             'general'),
  ('fill_blank', 'Five, six, seven, ___.',               '{"answers":["eight","8"]}',                             'general'),
  ('fill_blank', 'I have ___ eyes. (số)',                '{"answers":["two","2"]}',                               'general'),
  ('fill_blank', 'A dog has ___ legs. (số)',             '{"answers":["four","4"]}',                              'general'),
  ('fill_blank', 'One and one make ___.',                '{"answers":["two","2"]}',                               'general'),

  -- First grammar and classroom phrases
  ('fill_blank', 'I ___ a boy.',                         '{"answers":["am","''m"]}',                              'grammar'),
  ('fill_blank', 'I ___ seven years old.',               '{"answers":["am","''m"]}',                              'grammar'),
  ('fill_blank', 'You ___ my friend.',                   '{"answers":["are","''re"]}',                            'grammar'),
  ('fill_blank', 'He ___ my brother.',                   '{"answers":["is","''s"]}',                              'grammar'),
  ('fill_blank', 'It ___ a cat.',                        '{"answers":["is","''s"]}',                              'grammar'),
  ('fill_blank', 'This ___ my pen.',                     '{"answers":["is"]}',                                    'grammar'),
  ('fill_blank', 'What ___ your name?',                  '{"answers":["is","''s"]}',                              'grammar'),
  ('fill_blank', '___ are you? I am fine.',              '{"answers":["how"]}',                                   'grammar'),
  ('fill_blank', 'I ___ swim. (có thể)',                 '{"answers":["can"]}',                                   'grammar'),
  ('fill_blank', 'Good ___! (buổi sáng)',                '{"answers":["morning"]}',                               'vocabulary'),
  ('fill_blank', 'Thank ___!',                           '{"answers":["you"]}',                                   'vocabulary'),
  ('fill_blank', 'Nice to meet ___.',                    '{"answers":["you"]}',                                   'vocabulary'),

  -- Opposites, days and sounds
  ('fill_blank', 'The opposite of "yes" is ___.',        '{"answers":["no"]}',                                    'vocabulary'),
  ('fill_blank', 'The opposite of "cold" is ___.',       '{"answers":["hot"]}',                                   'vocabulary'),
  ('fill_blank', 'The opposite of "up" is ___.',         '{"answers":["down"]}',                                  'vocabulary'),
  ('fill_blank', 'The opposite of "sad" is ___.',        '{"answers":["happy","glad"]}',                          'vocabulary'),
  ('fill_blank', 'Sunday, ___, Tuesday.',                '{"answers":["Monday"]}',                                'general'),
  ('fill_blank', 'A cow says "___".',                    '{"answers":["moo"]}',                                   'general'),
  ('fill_blank', 'A duck says "___".',                   '{"answers":["quack"]}',                                 'general')
) AS v(type, question, payload, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_question_bank q
  WHERE q.type = v.type AND q.question = v.question AND q.story_id IS NULL
);
