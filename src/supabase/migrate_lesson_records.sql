-- Migration: Create lesson tables for teacher lesson reports
-- Date: 2026-02-23

-- ============================================================
-- lesson_info: One row per lesson (course + date)
-- Stores lesson-level data: name, mode, skill, feedback
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lesson_info (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  lesson_name text,
  lesson_mode text,
  skill text,
  feedback text,
  recorded_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT lesson_info_unique UNIQUE (course_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_lesson_info_course_date
  ON public.lesson_info(course_id, session_date DESC);

ALTER TABLE public.lesson_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view lesson info" ON public.lesson_info;
DROP POLICY IF EXISTS "Teachers can insert lesson info" ON public.lesson_info;
DROP POLICY IF EXISTS "Teachers can update lesson info" ON public.lesson_info;
DROP POLICY IF EXISTS "Teachers can delete lesson info" ON public.lesson_info;

CREATE POLICY "Teachers can view lesson info"
  ON public.lesson_info FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_teachers ct
      WHERE ct.course_id = lesson_info.course_id AND ct.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Teachers can insert lesson info"
  ON public.lesson_info FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_teachers ct
      WHERE ct.course_id = lesson_info.course_id AND ct.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Teachers can update lesson info"
  ON public.lesson_info FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.course_teachers ct
      WHERE ct.course_id = lesson_info.course_id AND ct.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Teachers can delete lesson info"
  ON public.lesson_info FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.course_teachers ct
      WHERE ct.course_id = lesson_info.course_id AND ct.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ============================================================
-- lesson_records: One row per student per lesson (course + date)
-- Stores per-student data: attendance, homework, performance
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lesson_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  lesson_info_id uuid NOT NULL REFERENCES public.lesson_info(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Roll Call
  attendance_status text DEFAULT 'present'
    CHECK (attendance_status IN ('present', 'absent', 'late', 'excused')),
  participation_level text DEFAULT 'medium'
    CHECK (participation_level IN ('low', 'medium', 'high')),

  -- Homework
  homework_status text,  -- wow, good, ok
  homework_notes text,
  homework_score integer DEFAULT NULL
    CHECK (homework_score IS NULL OR (homework_score >= 0 AND homework_score <= 100)),

  -- Class Performance
  performance_rating text,  -- wow, good, ok
  star_flag text DEFAULT ''
    CHECK (star_flag IN ('', 'star', 'flag')),
  engagement_level text DEFAULT 'medium'
    CHECK (engagement_level IN ('low', 'medium', 'high')),

  -- Shared
  notes text,
  recorded_by uuid REFERENCES public.users(id),
  recorded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT lesson_records_unique UNIQUE (lesson_info_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lesson_records_lesson_info
  ON public.lesson_records(lesson_info_id);

CREATE INDEX IF NOT EXISTS idx_lesson_records_student
  ON public.lesson_records(student_id);

-- RLS
ALTER TABLE public.lesson_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view lesson records" ON public.lesson_records;
DROP POLICY IF EXISTS "Teachers can insert lesson records" ON public.lesson_records;
DROP POLICY IF EXISTS "Teachers can update lesson records" ON public.lesson_records;
DROP POLICY IF EXISTS "Teachers can delete lesson records" ON public.lesson_records;
DROP POLICY IF EXISTS "Students can view their own lesson records" ON public.lesson_records;

CREATE POLICY "Teachers can view lesson records"
  ON public.lesson_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_info li
      JOIN public.course_teachers ct ON ct.course_id = li.course_id
      WHERE li.id = lesson_records.lesson_info_id
      AND ct.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Teachers can insert lesson records"
  ON public.lesson_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lesson_info li
      JOIN public.course_teachers ct ON ct.course_id = li.course_id
      WHERE li.id = lesson_records.lesson_info_id
      AND ct.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Teachers can update lesson records"
  ON public.lesson_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_info li
      JOIN public.course_teachers ct ON ct.course_id = li.course_id
      WHERE li.id = lesson_records.lesson_info_id
      AND ct.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Teachers can delete lesson records"
  ON public.lesson_records
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_info li
      JOIN public.course_teachers ct ON ct.course_id = li.course_id
      WHERE li.id = lesson_records.lesson_info_id
      AND ct.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Students can view their own lesson records"
  ON public.lesson_records
  FOR SELECT
  USING (student_id = auth.uid());
