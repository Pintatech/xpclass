-- More LOOSE multiple choice for level 1.
--
-- A level-1 student never reads a passage (STORY_MIN_LEVEL in
-- src/config/eventQuestions.js), so every multiple-choice day they fight — day 1,
-- day 3, and their share of the boss's mixed round — is drawn from the loose
-- bank: rows with no story_id, at min_level 1. The original seed left five such
-- rows, and a day-3 round alone can ask for fourteen, so a beginner was either
-- seeing the same handful on repeat or running the bank dry mid-fight.
--
-- These are first-week-of-class questions: short stems, one idea each, and a
-- Vietnamese gloss in brackets where the word itself is what is being asked.
-- Choices are shuffled on screen, so answer_index can sit anywhere.
--
-- Guarded per row on type + stem, so re-running this adds nothing twice. Needs
-- add_event_story_bank.sql (for story_id) to have run first.

INSERT INTO public.event_question_bank (type, question, payload, category, min_level)
SELECT v.type, v.question, v.payload::jsonb, v.category, 1
FROM (VALUES
  -- Animals
  ('multiple_choice', 'Which animal says "woof"?',              '{"choices":["cat","dog","bird","fish"],"answer_index":1}',                       'vocabulary'),
  ('multiple_choice', 'Which animal can fly?',                  '{"choices":["fish","cow","bird","pig"],"answer_index":2}',                       'general'),
  ('multiple_choice', 'Which animal lives in water?',           '{"choices":["fish","dog","cat","horse"],"answer_index":0}',                      'general'),
  ('multiple_choice', 'Which word means "con gà"?',             '{"choices":["duck","pig","goat","chicken"],"answer_index":3}',                   'vocabulary'),
  ('multiple_choice', 'Which animal is very big?',              '{"choices":["ant","mouse","elephant","frog"],"answer_index":2}',                 'general'),
  ('multiple_choice', 'Which animal has a long neck?',          '{"choices":["pig","giraffe","duck","rabbit"],"answer_index":1}',                 'general'),

  -- Colours
  ('multiple_choice', 'What colour is grass?',                  '{"choices":["red","green","black","white"],"answer_index":1}',                   'vocabulary'),
  ('multiple_choice', 'What colour is snow?',                   '{"choices":["black","orange","white","pink"],"answer_index":2}',                 'vocabulary'),
  ('multiple_choice', 'Which word means "màu đỏ"?',             '{"choices":["blue","yellow","brown","red"],"answer_index":3}',                   'vocabulary'),
  ('multiple_choice', 'What colour is a banana?',               '{"choices":["yellow","purple","blue","grey"],"answer_index":0}',                 'vocabulary'),

  -- Numbers
  ('multiple_choice', 'What is 2 + 3?',                         '{"choices":["four","six","five","seven"],"answer_index":2}',                     'general'),
  ('multiple_choice', 'How many legs does a dog have?',         '{"choices":["two","four","six","eight"],"answer_index":1}',                      'general'),
  ('multiple_choice', 'Which number comes after nine?',         '{"choices":["eight","seven","eleven","ten"],"answer_index":3}',                  'general'),
  ('multiple_choice', 'How many fingers are on one hand?',      '{"choices":["five","four","six","ten"],"answer_index":0}',                       'general'),
  ('multiple_choice', 'Which word is the number 3?',            '{"choices":["two","thirteen","three","thirty"],"answer_index":2}',               'vocabulary'),

  -- Food and drink
  ('multiple_choice', 'Which one is a drink?',                  '{"choices":["bread","milk","rice","egg"],"answer_index":1}',                     'vocabulary'),
  ('multiple_choice', 'Which word means "quả táo"?',            '{"choices":["orange","grape","apple","mango"],"answer_index":2}',                'vocabulary'),
  ('multiple_choice', 'Which one is a vegetable?',              '{"choices":["cake","candy","cookie","carrot"],"answer_index":3}',                'vocabulary'),
  ('multiple_choice', 'Which word means "cơm"?',                '{"choices":["rice","noodles","bread","soup"],"answer_index":0}',                 'vocabulary'),

  -- The body
  ('multiple_choice', 'We hear with our ___.',                  '{"choices":["eyes","ears","nose","mouth"],"answer_index":1}',                    'vocabulary'),
  ('multiple_choice', 'We smell with our ___.',                 '{"choices":["hands","feet","nose","ears"],"answer_index":2}',                    'vocabulary'),
  ('multiple_choice', 'Which word means "cái miệng"?',          '{"choices":["hand","leg","hair","mouth"],"answer_index":3}',                     'vocabulary'),

  -- Family
  ('multiple_choice', 'Which word means "bố"?',                 '{"choices":["mother","father","sister","brother"],"answer_index":1}',            'vocabulary'),
  ('multiple_choice', 'Which word means "bà"?',                 '{"choices":["grandfather","aunt","grandmother","uncle"],"answer_index":2}',      'vocabulary'),
  ('multiple_choice', 'The opposite of "boy" is ___.',          '{"choices":["girl","man","baby","friend"],"answer_index":0}',                    'vocabulary'),

  -- School and things at home
  ('multiple_choice', 'You write with a ___.',                  '{"choices":["ball","cup","pen","shoe"],"answer_index":2}',                       'vocabulary'),
  ('multiple_choice', 'Which word means "cái cặp"?',            '{"choices":["book","desk","ruler","bag"],"answer_index":3}',                     'vocabulary'),
  ('multiple_choice', 'Where do you go to learn?',              '{"choices":["zoo","school","beach","market"],"answer_index":1}',                 'general'),
  ('multiple_choice', 'You sleep in a ___.',                    '{"choices":["bed","cup","box","bag"],"answer_index":0}',                         'vocabulary'),
  ('multiple_choice', 'Which one has wheels?',                  '{"choices":["tree","cat","book","car"],"answer_index":3}',                       'general'),
  ('multiple_choice', 'You drink water from a ___.',            '{"choices":["shoe","hat","cup","bed"],"answer_index":2}',                        'vocabulary'),

  -- Weather, sky and time
  ('multiple_choice', 'We see the moon at ___.',                '{"choices":["morning","night","lunch","noon"],"answer_index":1}',                'general'),
  ('multiple_choice', 'When it rains, you need an ___.',        '{"choices":["apple","egg","umbrella","orange"],"answer_index":2}',               'vocabulary'),
  ('multiple_choice', 'Which one is in the sky?',               '{"choices":["star","fish","tree","car"],"answer_index":0}',                      'general'),
  ('multiple_choice', 'Which one is a day of the week?',        '{"choices":["March","Monday","summer","morning"],"answer_index":1}',             'general'),
  ('multiple_choice', 'Which day comes after Sunday?',          '{"choices":["Saturday","Friday","Tuesday","Monday"],"answer_index":3}',          'general'),

  -- Opposites
  ('multiple_choice', 'The opposite of "big" is ___.',          '{"choices":["tall","long","small","fat"],"answer_index":2}',                     'vocabulary'),
  ('multiple_choice', 'The opposite of "up" is ___.',           '{"choices":["down","in","on","out"],"answer_index":0}',                          'vocabulary'),
  ('multiple_choice', 'The opposite of "happy" is ___.',        '{"choices":["good","sad","nice","fun"],"answer_index":1}',                       'vocabulary'),

  -- First grammar
  ('multiple_choice', 'My name ___ Lan.',                       '{"choices":["are","am","is","be"],"answer_index":2}',                            'grammar'),
  ('multiple_choice', 'I ___ a student.',                       '{"choices":["am","is","are","be"],"answer_index":0}',                            'grammar'),
  ('multiple_choice', 'Hello! How ___ you?',                    '{"choices":["is","am","be","are"],"answer_index":3}',                            'grammar'),
  ('multiple_choice', '___ is your name?',                      '{"choices":["Who","What","Where","When"],"answer_index":1}',                     'grammar'),
  ('multiple_choice', 'I have two ___.',                        '{"choices":["cat","a cat","cats","one cat"],"answer_index":2}',                  'grammar'),
  ('multiple_choice', 'Which one is a greeting?',               '{"choices":["Apple","Table","Blue","Hello"],"answer_index":3}',                  'vocabulary')
) AS v(type, question, payload, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_question_bank q
  WHERE q.type = v.type AND q.question = v.question AND q.story_id IS NULL
);
