-- Test Script for Simplified Student Levels
-- Run this after migration to verify everything works correctly

-- Test 1: Check if table structure is correct
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'student_levels' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 2: Verify data was inserted correctly
SELECT 
  level_number,
  xp_required,
  badge_name,
  badge_tier,
  title_unlocked
FROM public.student_levels 
ORDER BY level_number;

-- Test 3: Test get_user_level function with various XP values
SELECT 'Test with 0 XP:' as test_case, * FROM get_user_level(0);
SELECT 'Test with 500 XP:' as test_case, * FROM get_user_level(500);
SELECT 'Test with 1500 XP:' as test_case, * FROM get_user_level(1500);
SELECT 'Test with 5000 XP:' as test_case, * FROM get_user_level(5000);
SELECT 'Test with 10000 XP:' as test_case, * FROM get_user_level(10000);
SELECT 'Test with 50000 XP:' as test_case, * FROM get_user_level(50000);
SELECT 'Test with 150000 XP:' as test_case, * FROM get_user_level(150000);

-- Test 4: Test get_next_level_info function
SELECT 'Test next level info with 1500 XP:' as test_case, * FROM get_next_level_info(1500);
SELECT 'Test next level info with 5000 XP:' as test_case, * FROM get_next_level_info(5000);
SELECT 'Test next level info with 100000 XP (max level):' as test_case, * FROM get_next_level_info(100000);

-- Test 5: Verify level progression logic
WITH test_xp AS (
  SELECT unnest(ARRAY[0, 500, 1000, 1500, 2000, 3500, 5000, 8000, 10000, 15000, 20000, 30000, 50000, 75000, 100000, 150000]) as xp
)
SELECT 
  t.xp,
  sl.level_number,
  sl.badge_name,
  sl.badge_tier,
  sl.xp_required,
  CASE 
    WHEN t.xp >= sl.xp_required THEN 'Current Level'
    ELSE 'Not Reached'
  END as status
FROM test_xp t
CROSS JOIN LATERAL (
  SELECT * FROM get_user_level(t.xp)
) level_data
LEFT JOIN public.student_levels sl ON (level_data.level_info->>'level_number')::int = sl.level_number
ORDER BY t.xp;

-- Test 6: Check if backup table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_levels_backup') 
    THEN 'Backup table exists ✓'
    ELSE 'Backup table missing ✗'
  END as backup_status;

-- Test 7: Verify RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'student_levels';

-- Test 8: Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'student_levels';

-- Test 9: Verify functions exist
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name IN ('get_user_level', 'get_next_level_info')
  AND routine_schema = 'public';

-- Test 10: Performance test (should be fast)
EXPLAIN ANALYZE 
SELECT * FROM get_user_level(5000);

-- Summary
SELECT 
  'Migration Test Summary' as status,
  (SELECT COUNT(*) FROM public.student_levels) as total_levels,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN ('get_user_level', 'get_next_level_info')) as functions_created,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'student_levels') as indexes_created;
