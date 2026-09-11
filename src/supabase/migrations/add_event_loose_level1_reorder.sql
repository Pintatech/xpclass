-- More LOOSE reorder for level 1 — day 6's question type, and part of the boss's
-- mixed round. See add_event_loose_level1_multiple_choice.sql for why a level-1
-- student only ever sees loose rows.
--
-- The grader accepts exactly one order, so every sentence here has only one:
-- no "a cat and a dog" (which is just as right the other way round), no "please"
-- that could sit at either end, no time phrase that could open the sentence
-- instead of closing it. Three to five words, which is a sentence a first-week
-- class can hold in its head while tapping.
--
-- Every reorder row shares the same stem, so the guard is on the sentence
-- itself (the payload) rather than on the stem — otherwise the first row would
-- block the other thirty-nine. Re-running this adds nothing twice. Needs
-- add_event_story_bank.sql (for story_id) to have run first.

INSERT INTO public.event_question_bank (type, question, payload, category, min_level)
SELECT v.type, v.question, v.payload::jsonb, 'grammar', 1
FROM (VALUES
  ('reorder', 'Put the sentence in order.', '{"answer":["I","have","a","dog"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","like","apples"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","eat","rice"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["We","play","football"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","love","my","mom"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["The","sun","is","hot"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["The","dog","is","big"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["My","bag","is","red"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["This","is","my","pen"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["That","is","a","bird"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","can","see","a","cat"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["He","has","a","ball"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["She","likes","milk"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","go","to","bed"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["We","read","books"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["The","fish","can","swim"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["My","name","is","Lan"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["How","are","you"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["What","is","your","name"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["How","old","are","you"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","am","six","years","old"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["It","is","my","book"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","drink","water"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["They","are","my","friends"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["Open","your","book"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["Close","your","eyes"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","like","my","school"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["The","sky","is","blue"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["My","dad","is","tall"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","see","a","red","car"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["The","bird","can","fly"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","have","two","hands"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["He","is","my","brother"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","brush","my","teeth"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["Look","at","the","moon"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","want","an","apple"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["I","wash","my","hands"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["The","cat","is","black"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["Where","is","my","bag"]}'),
  ('reorder', 'Put the sentence in order.', '{"answer":["Nam","has","a","kite"]}')
) AS v(type, question, payload)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_question_bank q
  WHERE q.type = v.type AND q.payload = v.payload::jsonb AND q.story_id IS NULL
);
