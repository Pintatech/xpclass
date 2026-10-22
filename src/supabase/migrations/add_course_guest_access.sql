-- Courses opted in to guest access (/guest)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_guest_accessible boolean DEFAULT false;
