-- Test the debug function
-- First find your user ID, then test the function

-- 1. Find your user ID
SELECT 'Your user ID:' as info, id, email FROM public.users LIMIT 5;

-- 2. Test the function with your user ID (replace the UUID below with your actual user ID)
-- SELECT public.get_today_daily_quest_simple('PUT_YOUR_USER_ID_HERE');

-- 3. Or test with any user ID from the database
SELECT
    'Testing with user:' as info,
    u.email,
    public.get_today_daily_quest_simple(u.id) as debug_result
FROM public.users u
LIMIT 1;