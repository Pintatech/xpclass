-- Add full_name and exercise_title columns to user_progress table for easier tracking
-- These are denormalized fields purely for admin/debugging convenience

ALTER TABLE public.user_progress
ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE public.user_progress
ADD COLUMN IF NOT EXISTS exercise_title text;

-- Add comments to document the purpose
COMMENT ON COLUMN public.user_progress.full_name IS 'User full name for easier tracking and debugging (denormalized from users table)';
COMMENT ON COLUMN public.user_progress.exercise_title IS 'Exercise title for easier tracking and debugging (denormalized from exercises table)';

-- Optional: Populate existing rows with full_name and exercise_title
UPDATE public.user_progress up
SET
  full_name = u.full_name,
  exercise_title = e.title
FROM public.users u, public.exercises e
WHERE up.user_id = u.id
AND up.exercise_id = e.id
AND (up.full_name IS NULL OR up.exercise_title IS NULL);

-- Optional: Create a trigger to automatically populate full_name and exercise_title when inserting
CREATE OR REPLACE FUNCTION public.populate_user_progress_tracking_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Populate full_name from users table
  IF NEW.full_name IS NULL THEN
    SELECT full_name INTO NEW.full_name
    FROM public.users
    WHERE id = NEW.user_id;
  END IF;

  -- Populate exercise_title from exercises table
  IF NEW.exercise_title IS NULL THEN
    SELECT title INTO NEW.exercise_title
    FROM public.exercises
    WHERE id = NEW.exercise_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_populate_user_progress_tracking_fields
BEFORE INSERT ON public.user_progress
FOR EACH ROW
EXECUTE FUNCTION public.populate_user_progress_tracking_fields();
