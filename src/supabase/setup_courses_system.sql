-- =================================================================
-- Complete Setup Script for Course-Based Teacher-Student System
-- =================================================================
-- This script will set up your database for the course-teacher-student system

-- Step 1: Create courses table (renamed from levels)
DO $$
BEGIN
    -- First check if levels table exists and rename it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'levels' AND table_schema = 'public') THEN
        RAISE NOTICE 'Renaming levels table to courses...';
        ALTER TABLE public.levels RENAME TO courses;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courses' AND table_schema = 'public') THEN
        RAISE NOTICE 'Creating new courses table...';
        CREATE TABLE public.courses (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            title text NOT NULL,
            description text,
            level_number integer NOT NULL UNIQUE,
            difficulty_label text NOT NULL DEFAULT 'Beginner',
            color_theme text DEFAULT 'blue',
            unlock_requirement integer DEFAULT 0,
            is_active boolean DEFAULT true,
            thumbnail_url text,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );

        -- Enable RLS
        ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

        -- Add basic policy
        CREATE POLICY "Courses readable by authenticated users" ON public.courses
        FOR SELECT USING (auth.role() = 'authenticated');

        -- Add trigger for updated_at
        CREATE TRIGGER update_courses_updated_at
        BEFORE UPDATE ON public.courses
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
    ELSE
        RAISE NOTICE 'Courses table already exists';
    END IF;
END $$;

-- Step 2: Add teacher_id column to courses if it doesn't exist
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
        RAISE NOTICE 'teacher_id column already exists in courses';
    END IF;
END $$;

-- Step 3: Update user roles to include teacher
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_role_check'
        AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT users_role_check;
    END IF;

    -- Add new constraint with teacher role
    ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'admin', 'teacher'));

    RAISE NOTICE 'User roles updated to include teacher';
END $$;

-- Step 4: Update units table to reference course_id instead of level_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units' AND column_name = 'level_id' AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Renaming level_id to course_id in units table...';
        ALTER TABLE public.units RENAME COLUMN level_id TO course_id;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units' AND column_name = 'course_id' AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Units table already references course_id';
    ELSE
        RAISE NOTICE 'Warning: Units table structure unexpected';
    END IF;
END $$;

-- Step 5: Update user_progress table if it has level_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_progress' AND column_name = 'level_id' AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Renaming level_id to course_id in user_progress table...';
        ALTER TABLE public.user_progress RENAME COLUMN level_id TO course_id;
    END IF;
END $$;

-- Step 6: Handle level_progress table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'level_progress' AND table_schema = 'public') THEN
        RAISE NOTICE 'Renaming level_progress to course_progress...';
        ALTER TABLE public.level_progress RENAME TO course_progress;

        -- Rename level_id column if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'course_progress' AND column_name = 'level_id' AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.course_progress RENAME COLUMN level_id TO course_id;
        END IF;
    END IF;
END $$;

-- Step 7: Create course_enrollments table for student assignments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'course_enrollments' AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Creating course_enrollments table...';

        CREATE TABLE public.course_enrollments (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
            student_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
            assigned_by uuid REFERENCES public.users(id),
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

        RAISE NOTICE 'Course enrollments table created';
    ELSE
        RAISE NOTICE 'Course enrollments table already exists';
    END IF;
END $$;

-- Step 8: Create RLS policies for teacher access
DO $$
BEGIN
    -- Teachers can view courses they are assigned to
    DROP POLICY IF EXISTS "Teachers view assigned courses" ON public.courses;
    CREATE POLICY "Teachers view assigned courses" ON public.courses
    FOR SELECT USING (
        teacher_id = auth.uid() OR
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );

    -- Teachers can view enrollments for their courses
    DROP POLICY IF EXISTS "Teachers view course enrollments" ON public.course_enrollments;
    CREATE POLICY "Teachers view course enrollments" ON public.course_enrollments
    FOR SELECT USING (
        course_id IN (
            SELECT id FROM public.courses WHERE teacher_id = auth.uid()
        ) OR
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );

    -- Admins can manage course enrollments
    DROP POLICY IF EXISTS "Admins manage enrollments" ON public.course_enrollments;
    CREATE POLICY "Admins manage enrollments" ON public.course_enrollments
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );

    -- Teachers can view progress of their students
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

    RAISE NOTICE 'RLS policies created for teacher access';
END $$;

-- Step 9: Add sample course data if courses table is empty
DO $$
DECLARE
    course_count integer;
BEGIN
    SELECT COUNT(*) INTO course_count FROM public.courses;

    IF course_count = 0 THEN
        RAISE NOTICE 'Adding sample course data...';

        INSERT INTO public.courses (title, description, level_number, difficulty_label, color_theme, unlock_requirement)
        VALUES
        ('Spanish Beginner', 'Start your Spanish journey with basic vocabulary and grammar', 1, 'Beginner', 'green', 0),
        ('Spanish Intermediate', 'Build on your foundation with more complex conversations', 2, 'Intermediate', 'blue', 500),
        ('Spanish Advanced', 'Master advanced Spanish concepts and fluency', 3, 'Advanced', 'purple', 1500),
        ('French Beginner', 'Learn the basics of French language', 4, 'Beginner', 'orange', 0),
        ('English Grammar', 'Master English grammar rules and usage', 5, 'Intermediate', 'red', 750);

        RAISE NOTICE 'Sample course data added';
    ELSE
        RAISE NOTICE 'Courses table already has data (% courses)', course_count;
    END IF;
END $$;

-- Step 10: Update triggers for renamed tables
DO $$
BEGIN
    -- Update course_progress triggers if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'course_progress' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS update_level_progress_updated_at ON public.course_progress;
        DROP TRIGGER IF EXISTS update_course_progress_updated_at ON public.course_progress;

        CREATE TRIGGER update_course_progress_updated_at
        BEFORE UPDATE ON public.course_progress
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
    END IF;
END $$;

-- Final verification and summary
DO $$
DECLARE
    courses_count integer;
    enrollments_count integer;
    teachers_count integer;
BEGIN
    -- Count data
    SELECT COUNT(*) INTO courses_count FROM public.courses;
    SELECT COUNT(*) INTO enrollments_count FROM public.course_enrollments;
    SELECT COUNT(*) INTO teachers_count FROM public.users WHERE role = 'teacher';

    RAISE NOTICE '=== SETUP COMPLETED SUCCESSFULLY ===';
    RAISE NOTICE 'Database now has:';
    RAISE NOTICE '✅ courses table with % courses', courses_count;
    RAISE NOTICE '✅ course_enrollments table with % enrollments', enrollments_count;
    RAISE NOTICE '✅ Teacher role support (% teachers found)', teachers_count;
    RAISE NOTICE '✅ RLS policies for teacher access';
    RAISE NOTICE '✅ Units table references course_id';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Create teacher accounts: UPDATE users SET role = ''teacher'' WHERE email = ''teacher@example.com''';
    RAISE NOTICE '2. Assign teachers to courses via admin interface';
    RAISE NOTICE '3. Enroll students in courses via admin interface';
    RAISE NOTICE '4. Teachers can now view student progress!';
END $$;