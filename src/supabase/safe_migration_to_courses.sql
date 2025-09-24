-- =================================================================
-- Safe Migration: Levels to Courses
-- =================================================================
-- Run the check_current_schema.sql first to see what exists
-- This script handles the migration safely with proper checks

-- Step 1: Only rename levels table if it exists AND courses doesn't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'levels' AND table_schema = 'public')
    AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courses' AND table_schema = 'public') THEN

        RAISE NOTICE 'Renaming levels table to courses...';
        ALTER TABLE public.levels RENAME TO courses;

    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courses' AND table_schema = 'public') THEN
        RAISE NOTICE 'Courses table already exists, skipping rename';
    ELSE
        RAISE NOTICE 'No levels table found to rename';
    END IF;
END $$;

-- Step 2: Add teacher_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'courses'
        AND column_name = 'teacher_id'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Adding teacher_id column to courses...';
        ALTER TABLE public.courses
        ADD COLUMN teacher_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
    ELSE
        RAISE NOTICE 'teacher_id column already exists in courses table';
    END IF;
END $$;

-- Step 3: Update user roles constraint
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_role_check'
        AND conrelid = 'public.users'::regclass
    ) THEN
        RAISE NOTICE 'Dropping existing role constraint...';
        ALTER TABLE public.users DROP CONSTRAINT users_role_check;
    END IF;

    -- Add new constraint with teacher role
    RAISE NOTICE 'Adding new role constraint with teacher...';
    ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'admin', 'teacher'));
END $$;

-- Step 4: Create course_enrollments table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'course_enrollments'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Creating course_enrollments table...';

        CREATE TABLE public.course_enrollments (
          id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
          course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
          student_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
          assigned_by uuid REFERENCES public.users(id), -- admin who assigned
          assigned_at timestamp with time zone DEFAULT now(),
          is_active boolean DEFAULT true,
          created_at timestamp with time zone DEFAULT now(),
          updated_at timestamp with time zone DEFAULT now(),
          UNIQUE(course_id, student_id)
        );

        -- Enable RLS
        ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

        -- Add trigger for updated_at
        CREATE TRIGGER update_course_enrollments_updated_at
        BEFORE UPDATE ON public.course_enrollments
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

    ELSE
        RAISE NOTICE 'course_enrollments table already exists';
    END IF;
END $$;

-- Step 5: Update foreign key references ONLY if they exist with old names

-- Check and rename level_id to course_id in units table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units'
        AND column_name = 'level_id'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Renaming level_id to course_id in units table...';
        ALTER TABLE public.units RENAME COLUMN level_id TO course_id;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units'
        AND column_name = 'course_id'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'course_id already exists in units table';
    ELSE
        RAISE NOTICE 'No level_id or course_id found in units table';
    END IF;
END $$;

-- Check and rename level_id to course_id in user_progress table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_progress'
        AND column_name = 'level_id'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Renaming level_id to course_id in user_progress table...';
        ALTER TABLE public.user_progress RENAME COLUMN level_id TO course_id;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_progress'
        AND column_name = 'course_id'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'course_id already exists in user_progress table';
    ELSE
        RAISE NOTICE 'No level_id or course_id found in user_progress table';
    END IF;
END $$;

-- Step 6: Handle level_progress table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'level_progress' AND table_schema = 'public')
    AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'course_progress' AND table_schema = 'public') THEN

        RAISE NOTICE 'Renaming level_progress table to course_progress...';
        ALTER TABLE public.level_progress RENAME TO course_progress;

        -- Rename level_id column if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'course_progress'
            AND column_name = 'level_id'
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.course_progress RENAME COLUMN level_id TO course_id;
        END IF;

    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'course_progress' AND table_schema = 'public') THEN
        RAISE NOTICE 'course_progress table already exists';

        -- Still try to rename level_id column if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'course_progress'
            AND column_name = 'level_id'
            AND table_schema = 'public'
        ) THEN
            RAISE NOTICE 'Renaming level_id to course_id in course_progress table...';
            ALTER TABLE public.course_progress RENAME COLUMN level_id TO course_id;
        END IF;

    ELSE
        RAISE NOTICE 'No level_progress table found to rename';
    END IF;
END $$;

-- Step 7: Create RLS policies (drop existing ones first to avoid conflicts)

-- Teachers can view courses they are assigned to
DO $$
BEGIN
    DROP POLICY IF EXISTS "Teachers view assigned courses" ON public.courses;
    CREATE POLICY "Teachers view assigned courses" ON public.courses
    FOR SELECT USING (
        teacher_id = auth.uid() OR
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );
END $$;

-- Teachers can view enrollments for their courses
DO $$
BEGIN
    DROP POLICY IF EXISTS "Teachers view course enrollments" ON public.course_enrollments;
    CREATE POLICY "Teachers view course enrollments" ON public.course_enrollments
    FOR SELECT USING (
        course_id IN (
            SELECT id FROM public.courses WHERE teacher_id = auth.uid()
        ) OR
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );
END $$;

-- Teachers can view progress of their students
DO $$
BEGIN
    DROP POLICY IF EXISTS "Teachers view student progress" ON public.user_progress;
    CREATE POLICY "Teachers view student progress" ON public.user_progress
    FOR SELECT USING (
        user_id IN (
            SELECT ce.student_id
            FROM public.course_enrollments ce
            JOIN public.courses c ON c.id = ce.course_id
            WHERE c.teacher_id = auth.uid() AND ce.is_active = true
        ) OR
        auth.uid() = user_id OR
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );
END $$;

-- Admins can manage course enrollments
DO $$
BEGIN
    DROP POLICY IF EXISTS "Admins manage enrollments" ON public.course_enrollments;
    CREATE POLICY "Admins manage enrollments" ON public.course_enrollments
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );
END $$;

-- Step 8: Update course_progress policies if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'course_progress' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Users manage own level progress" ON public.course_progress;
        DROP POLICY IF EXISTS "Users manage own course progress" ON public.course_progress;

        CREATE POLICY "Users manage own course progress" ON public.course_progress
        FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- Step 9: Update triggers if they exist
DO $$
BEGIN
    -- Drop old trigger if it exists
    DROP TRIGGER IF EXISTS update_level_progress_updated_at ON public.course_progress;

    -- Create new trigger if course_progress table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'course_progress' AND table_schema = 'public') THEN
        CREATE TRIGGER update_course_progress_updated_at
        BEFORE UPDATE ON public.course_progress
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
    END IF;
END $$;

COMMENT ON TABLE public.courses IS 'Courses (formerly levels) that students can enroll in';
COMMENT ON TABLE public.course_enrollments IS 'Student enrollments in courses, managed by admins';
COMMENT ON COLUMN public.courses.teacher_id IS 'Teacher assigned to this course';

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '=== MIGRATION COMPLETED ===';
    RAISE NOTICE 'Please verify the following:';
    RAISE NOTICE '1. courses table exists with teacher_id column';
    RAISE NOTICE '2. course_enrollments table created';
    RAISE NOTICE '3. Foreign keys updated to use course_id';
    RAISE NOTICE '4. RLS policies created for teacher access';
    RAISE NOTICE '5. User role constraint includes teacher';
END $$;