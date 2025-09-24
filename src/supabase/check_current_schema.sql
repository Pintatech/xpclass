-- Check current database schema before migration
-- Run this first to see what exists

-- Check if levels table exists and its columns
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'levels'
ORDER BY ordinal_position;

-- Check if courses table already exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'courses'
ORDER BY ordinal_position;

-- Check units table columns
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'units'
ORDER BY ordinal_position;

-- Check user_progress table columns
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_progress'
ORDER BY ordinal_position;

-- Check level_progress vs course_progress
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('level_progress', 'course_progress')
ORDER BY table_name, ordinal_position;

-- Check users table role constraint
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
AND conname LIKE '%role%';

-- List all tables to see what exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;