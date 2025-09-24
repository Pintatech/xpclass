-- Force refresh Supabase schema cache for courses table

-- First verify the table exists
SELECT 'Courses table exists!' as status, COUNT(*) as course_count
FROM public.courses;

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'courses' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ensure RLS is properly configured
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Recreate the basic policy to refresh cache
DROP POLICY IF EXISTS "Courses readable by authenticated users" ON public.courses;
CREATE POLICY "Courses readable by authenticated users" ON public.courses
FOR SELECT USING (auth.role() = 'authenticated');

-- Force a schema refresh by updating table comment
COMMENT ON TABLE public.courses IS 'Learning courses for students - Updated at ' || CURRENT_TIMESTAMP;

-- Show final status
SELECT
    'Schema refreshed!' as status,
    COUNT(*) as total_courses,
    COUNT(CASE WHEN is_active THEN 1 END) as active_courses
FROM public.courses;