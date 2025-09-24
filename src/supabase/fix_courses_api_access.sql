-- Fix Supabase API access to courses table
-- This script ensures the courses table is properly accessible via the API

-- Step 1: Verify current state
SELECT 'Current courses table status:' as info;
SELECT
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables
WHERE tablename = 'courses';

-- Step 2: Ensure table is in public schema with correct permissions
ALTER TABLE IF EXISTS public.courses OWNER TO postgres;

-- Step 3: Enable RLS and create proper policies
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.courses;
DROP POLICY IF EXISTS "Courses readable by authenticated users" ON public.courses;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.courses;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.courses;

-- Create comprehensive RLS policies
CREATE POLICY "Enable read access for all authenticated users" ON public.courses
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users only" ON public.courses
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.courses
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Step 4: Grant proper permissions
GRANT ALL ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
GRANT SELECT ON public.courses TO anon;

-- Step 5: Refresh the API schema cache
NOTIFY pgrst, 'reload schema';

-- Step 6: Update table statistics
ANALYZE public.courses;

-- Step 7: Verify the setup
SELECT 'Final verification:' as info;
SELECT
    COUNT(*) as total_courses,
    COUNT(CASE WHEN is_active THEN 1 END) as active_courses,
    'Courses table ready for API access' as status
FROM public.courses;

-- Show RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'courses';