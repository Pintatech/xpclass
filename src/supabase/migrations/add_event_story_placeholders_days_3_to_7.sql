-- Empty passage slots for days 3-7, both bands.
--
-- Ten rows with no story in them yet, so the week's grid exists and each slot
-- has an id to hang questions on. The text is written afterwards in the admin
-- screen; nothing here will overwrite it, because every insert is guarded on
-- the title.
--
-- Titles follow the two that are already written: "Day N - Easy" is the band 2
-- passage and "Day N - Medium" is band 3, matching Day 1 and Day 2.
--
-- WHY THESE ARE SAFE TO LEAVE ACTIVE. A passage is only opened on if it alone
-- carries the whole round in that day's one type — see pickEventStory in
-- Dashboard.jsx, which counts a story's questions and skips it if there are too
-- few. A slot with no questions can never be picked, so an unwritten passage
-- cannot reach a student. They are inserted active rather than hidden because
-- the story editor has no is_active toggle: a hidden row could not be turned
-- back on from the UI.
--
-- The body is a placeholder rather than empty because event_stories has a CHECK
-- that rejects a blank one — a reading phase with nothing to read. It is
-- written to be obvious in the admin list, so an unfinished slot looks
-- unfinished.
--
-- WHAT EACH DAY NEEDS. A day asks ONE type throughout, so its passage's
-- questions must all be that type or the day falls back to the loose bank:
--
--   Day 3  multiple_choice
--   Day 4  fill_blank      (the stem must contain ___)
--   Day 5  fill_blank      (the stem must contain ___)
--   Day 6  reorder         (payload answer is the words in the right order)
--   Day 7  MIXED — the boss draws from every type the week taught, so this one
--          passage may carry multiple_choice, true_false, fill_blank and
--          reorder together.
--
-- Idempotent; safe to re-run.

INSERT INTO public.event_stories (title, body, category, stage_day, min_level)
SELECT v.title, v.body, 'reading', v.day, v.min_level
FROM (VALUES
  ('Day 3 - Easy',   'Chưa viết. Thay bằng nội dung truyện cho ngày 3 (cấp 2).',   3, 2),
  ('Day 3 - Medium', 'Chưa viết. Thay bằng nội dung truyện cho ngày 3 (cấp 3).',   3, 3),
  ('Day 4 - Easy',   'Chưa viết. Thay bằng nội dung truyện cho ngày 4 (cấp 2).',   4, 2),
  ('Day 4 - Medium', 'Chưa viết. Thay bằng nội dung truyện cho ngày 4 (cấp 3).',   4, 3),
  ('Day 5 - Easy',   'Chưa viết. Thay bằng nội dung truyện cho ngày 5 (cấp 2).',   5, 2),
  ('Day 5 - Medium', 'Chưa viết. Thay bằng nội dung truyện cho ngày 5 (cấp 3).',   5, 3),
  ('Day 6 - Easy',   'Chưa viết. Thay bằng nội dung truyện cho ngày 6 (cấp 2).',   6, 2),
  ('Day 6 - Medium', 'Chưa viết. Thay bằng nội dung truyện cho ngày 6 (cấp 3).',   6, 3),
  ('Day 7 - Easy',   'Chưa viết. Thay bằng nội dung truyện cho ngày 7 (cấp 2).',   7, 2),
  ('Day 7 - Medium', 'Chưa viết. Thay bằng nội dung truyện cho ngày 7 (cấp 3).',   7, 3)
) AS v(title, body, day, min_level)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_stories s WHERE s.title = v.title
);

-- The ids to hang questions on. Copy the one you want into the question
-- migration for that night, the way Day 1 and Day 2 already do.
SELECT stage_day, min_level, title, id
FROM public.event_stories
WHERE stage_day BETWEEN 1 AND 7
ORDER BY stage_day, min_level;
