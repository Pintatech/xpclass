-- Create courses table if it doesn't exist
-- This handles the case where levels table never existed or was already renamed

-- First, check if courses table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'courses' AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Creating courses table...';

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
            teacher_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );

        -- Enable RLS
        ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY "Content readable by authenticated users" ON public.courses
        FOR SELECT USING (auth.role() = 'authenticated');

        CREATE POLICY "Teachers view assigned courses" ON public.courses
        FOR SELECT USING (
            teacher_id = auth.uid() OR
            auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
        );

        -- Add trigger for updated_at
        CREATE TRIGGER update_courses_updated_at
        BEFORE UPDATE ON public.courses
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

        RAISE NOTICE 'Courses table created successfully';
    ELSE
        RAISE NOTICE 'Courses table already exists';
    END IF;
END $$;

-- Update user roles constraint to include teacher if not already done
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

-- Create course_enrollments table if it doesn't exist
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

        -- Create policies
        CREATE POLICY "Teachers view course enrollments" ON public.course_enrollments
        FOR SELECT USING (
            course_id IN (
                SELECT id FROM public.courses WHERE teacher_id = auth.uid()
            ) OR
            auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
        );

        CREATE POLICY "Admins manage enrollments" ON public.course_enrollments
        FOR ALL USING (
            auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
        );

        -- Add trigger for updated_at
        CREATE TRIGGER update_course_enrollments_updated_at
        BEFORE UPDATE ON public.course_enrollments
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

        RAISE NOTICE 'Course enrollments table created successfully';
    ELSE
        RAISE NOTICE 'Course enrollments table already exists';
    END IF;
END $$;

-- Check and update units table foreign key
DO $$
BEGIN
    -- Check if units table references course_id or level_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units' AND column_name = 'level_id' AND table_schema = 'public'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'courses' AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Renaming level_id to course_id in units table...';
        ALTER TABLE public.units RENAME COLUMN level_id TO course_id;
        RAISE NOTICE 'Units table updated to reference course_id';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units' AND column_name = 'course_id' AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Units table already references course_id';
    ELSE
        RAISE NOTICE 'Units table structure needs manual review';
    END IF;
END $$;

-- Add some sample course data if the table is empty
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courses' AND table_schema = 'public') THEN
        -- Check if courses table is empty
        IF NOT EXISTS (SELECT 1 FROM public.courses LIMIT 1) THEN
            RAISE NOTICE 'Adding sample course data...';

            INSERT INTO public.courses (title, description, level_number, difficulty_label, color_theme, unlock_requirement)
            VALUES
            ('Beginner Course', 'Start your learning journey with basic concepts', 1, 'Beginner', 'green', 0),
            ('Intermediate Course', 'Build on your foundation with more complex topics', 2, 'Intermediate', 'blue', 500),
            ('Advanced Course', 'Master advanced concepts and techniques', 3, 'Advanced', 'purple', 1500);

            RAISE NOTICE 'Sample course data added';
        ELSE
            RAISE NOTICE 'Courses table already has data';
        END IF;
    END IF;
END $$;

RAISE NOTICE '=== SETUP COMPLETED ===';
RAISE NOTICE 'Your database now has:';
RAISE NOTICE '1. courses table (with teacher assignments)';
RAISE NOTICE '2. course_enrollments table (for student assignments)';
RAISE NOTICE '3. Updated user roles (including teacher)';
RAISE NOTICE '4. Updated units table to reference courses';