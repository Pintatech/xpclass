-- Add personal assignment support to units and sessions
-- When assigned_student_id is set, the unit/session is only visible to that student + teachers

ALTER TABLE public.units ADD COLUMN assigned_student_id uuid REFERENCES public.users(id);
ALTER TABLE public.sessions ADD COLUMN assigned_student_id uuid REFERENCES public.users(id);
