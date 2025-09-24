-- Simple fix for courses table API access
-- Run this in your Supabase SQL editor

-- Ensure table exists and has proper structure
SELECT 'Checking courses table...' as status;

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.courses;
CREATE POLICY "Enable read access for all users" ON public.courses
    FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON public.courses TO authenticated;
GRANT SELECT ON public.courses TO anon;

-- Verify data exists
SELECT
    COUNT(*) as total_courses,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_courses
FROM public.courses;

-- Show current data
SELECT id, title, level_number, is_active FROM public.courses ORDER BY level_number;