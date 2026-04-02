-- Guest access tables
-- Run this in Supabase SQL Editor

-- Table to store guest visitor names
CREATE TABLE IF NOT EXISTS public.guest_visitors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT guest_visitors_pkey PRIMARY KEY (id)
);

-- Table to store guest exercise/test attempts
CREATE TABLE IF NOT EXISTS public.guest_attempts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  guest_id uuid NOT NULL REFERENCES public.guest_visitors(id),
  session_id uuid NOT NULL REFERENCES public.sessions(id),
  score integer DEFAULT 0,
  total_correct integer DEFAULT 0,
  total_questions integer DEFAULT 0,
  time_used_seconds integer DEFAULT 0,
  timed_out boolean DEFAULT false,
  answers jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT guest_attempts_pkey PRIMARY KEY (id)
);

-- Allow anonymous access to guest tables (since guests are not authenticated)
ALTER TABLE public.guest_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert on guest_visitors"
  ON public.guest_visitors FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous insert on guest_attempts"
  ON public.guest_attempts FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users (admins) to read guest data
CREATE POLICY "Allow authenticated read on guest_visitors"
  ON public.guest_visitors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on guest_attempts"
  ON public.guest_attempts FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users to read sessions, exercises, etc. for the demo course
-- (These policies may already exist; adjust as needed)
-- If your tables already have RLS policies for authenticated users only,
-- you'll need to add anon read access for these tables:

-- Sessions: allow anon to read
CREATE POLICY "Allow anonymous read on sessions"
  ON public.sessions FOR SELECT
  TO anon
  USING (true);

-- Exercises: allow anon to read
CREATE POLICY "Allow anonymous read on exercises"
  ON public.exercises FOR SELECT
  TO anon
  USING (true);

-- Exercise assignments: allow anon to read
CREATE POLICY "Allow anonymous read on exercise_assignments"
  ON public.exercise_assignments FOR SELECT
  TO anon
  USING (true);

-- Courses: allow anon to read
CREATE POLICY "Allow anonymous read on courses"
  ON public.courses FOR SELECT
  TO anon
  USING (true);

-- Units: allow anon to read
CREATE POLICY "Allow anonymous read on units"
  ON public.units FOR SELECT
  TO anon
  USING (true);

-- Site settings: allow anon to read (for demo_course_id)
CREATE POLICY "Allow anonymous read on site_settings"
  ON public.site_settings FOR SELECT
  TO anon
  USING (true);

-- Add the demo course setting (replace YOUR_COURSE_ID with actual course UUID)
-- INSERT INTO public.site_settings (setting_key, setting_value, description)
-- VALUES ('demo_course_id', 'YOUR_COURSE_ID', 'Course ID used for guest/demo access');
