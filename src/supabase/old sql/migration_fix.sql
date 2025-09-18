-- Migration script to fix existing database
-- This script handles existing tables and adds missing columns

-- Check if image_urls column exists in exercises table, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'exercises' 
        AND column_name = 'image_urls'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises ADD COLUMN image_urls text[];
        RAISE NOTICE 'Added image_urls column to exercises table';
    ELSE
        RAISE NOTICE 'image_urls column already exists in exercises table';
    END IF;
END $$;

-- Check if levels table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'levels' AND table_schema = 'public') THEN
        CREATE TABLE public.levels (
            id uuid default uuid_generate_v4() primary key,
            title text not null,
            description text,
            level_number integer not null,
            difficulty_label text not null,
            color_theme text default 'blue',
            unlock_requirement integer default 0,
            is_active boolean default true,
            created_at timestamp with time zone default now(),
            updated_at timestamp with time zone default now()
        );
        RAISE NOTICE 'Created levels table';
    ELSE
        RAISE NOTICE 'Levels table already exists';
    END IF;
END $$;

-- Check if units table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'units' AND table_schema = 'public') THEN
        CREATE TABLE public.units (
            id uuid default uuid_generate_v4() primary key,
            level_id uuid references public.levels(id) on delete cascade,
            title text not null,
            description text,
            unit_number integer not null,
            color_theme text,
            is_active boolean default true,
            created_at timestamp with time zone default now(),
            updated_at timestamp with time zone default now()
        );
        RAISE NOTICE 'Created units table';
    ELSE
        RAISE NOTICE 'Units table already exists';
    END IF;
END $$;

-- Check if sessions table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions' AND table_schema = 'public') THEN
        CREATE TABLE public.sessions (
            id uuid default uuid_generate_v4() primary key,
            unit_id uuid references public.units(id) on delete cascade,
            title text not null,
            description text,
            session_number integer not null,
            color_theme text,
            xp_reward integer default 50,
            is_active boolean default true,
            created_at timestamp with time zone default now(),
            updated_at timestamp with time zone default now()
        );
        RAISE NOTICE 'Created sessions table';
    ELSE
        RAISE NOTICE 'Sessions table already exists';
    END IF;
END $$;

-- Update exercises table to reference session_id instead of section_id if needed
DO $$
BEGIN
    -- Check if exercises table has section_id column
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'exercises' 
        AND column_name = 'section_id'
        AND table_schema = 'public'
    ) THEN
        -- Check if session_id column doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'exercises' 
            AND column_name = 'session_id'
            AND table_schema = 'public'
        ) THEN
            -- Add session_id column
            ALTER TABLE public.exercises ADD COLUMN session_id uuid;
            RAISE NOTICE 'Added session_id column to exercises table';
        END IF;
    END IF;
END $$;

-- Update existing exercises with invalid types first
DO $$
BEGIN
    -- Update old exercise types to valid ones
    UPDATE public.exercises 
    SET exercise_type = 'flashcard'
    WHERE exercise_type IN ('song', 'karaoke', 'snake_ladder', 'two_player');
    
    IF FOUND THEN
        RAISE NOTICE 'Updated old exercise types to flashcard';
    END IF;
END $$;

-- Update exercise_type constraint to remove old types
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'exercises_exercise_type_check' 
        AND table_name = 'exercises'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.exercises DROP CONSTRAINT exercises_exercise_type_check;
        RAISE NOTICE 'Dropped existing exercise_type constraint';
    END IF;
    
    -- Add new constraint
    ALTER TABLE public.exercises ADD CONSTRAINT exercises_exercise_type_check 
    CHECK (exercise_type IN ('flashcard', 'audio_flashcard', 'video', 'multiple_choice'));
    RAISE NOTICE 'Added new exercise_type constraint';
END $$;

-- Enable RLS on new tables if not already enabled
DO $$
BEGIN
    -- Enable RLS on levels
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_class 
        WHERE relname = 'levels' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Enabled RLS on levels table';
    END IF;
    
    -- Enable RLS on units
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_class 
        WHERE relname = 'units' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Enabled RLS on units table';
    END IF;
    
    -- Enable RLS on sessions
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_class 
        WHERE relname = 'sessions' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Enabled RLS on sessions table';
    END IF;
END $$;

-- Create RLS policies for new tables
-- Levels policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE tablename = 'levels' 
        AND policyname = 'Levels are readable by authenticated users'
    ) THEN
        CREATE POLICY "Levels are readable by authenticated users" 
        ON public.levels FOR SELECT 
        USING (auth.role() = 'authenticated');
        RAISE NOTICE 'Created RLS policy for levels table';
    END IF;
END $$;

-- Units policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE tablename = 'units' 
        AND policyname = 'Units are readable by authenticated users'
    ) THEN
        CREATE POLICY "Units are readable by authenticated users" 
        ON public.units FOR SELECT 
        USING (auth.role() = 'authenticated');
        RAISE NOTICE 'Created RLS policy for units table';
    END IF;
END $$;

-- Sessions policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE tablename = 'sessions' 
        AND policyname = 'Sessions are readable by authenticated users'
    ) THEN
        CREATE POLICY "Sessions are readable by authenticated users" 
        ON public.sessions FOR SELECT 
        USING (auth.role() = 'authenticated');
        RAISE NOTICE 'Created RLS policy for sessions table';
    END IF;
END $$;

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language plpgsql;

-- Add triggers for new tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'update_levels_updated_at'
    ) THEN
        CREATE TRIGGER update_levels_updated_at 
        BEFORE UPDATE ON public.levels 
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
        RAISE NOTICE 'Created trigger for levels table';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'update_units_updated_at'
    ) THEN
        CREATE TRIGGER update_units_updated_at 
        BEFORE UPDATE ON public.units 
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
        RAISE NOTICE 'Created trigger for units table';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'update_sessions_updated_at'
    ) THEN
        CREATE TRIGGER update_sessions_updated_at 
        BEFORE UPDATE ON public.sessions 
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
        RAISE NOTICE 'Created trigger for sessions table';
    END IF;
END $$;

-- Insert sample data if tables are empty
DO $$
BEGIN
    -- Insert sample levels if none exist
    IF NOT EXISTS (SELECT 1 FROM public.levels LIMIT 1) THEN
        INSERT INTO public.levels (id, title, description, level_number, difficulty_label, color_theme, unlock_requirement) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'Cơ bản', 'Học các từ vựng và cấu trúc cơ bản', 1, 'Beginner', 'green', 0),
        ('550e8400-e29b-41d4-a716-446655440002', 'Trung cấp', 'Phát triển kỹ năng giao tiếp', 2, 'Intermediate', 'blue', 500),
        ('550e8400-e29b-41d4-a716-446655440003', 'Nâng cao', 'Hoàn thiện kỹ năng ngôn ngữ', 3, 'Advanced', 'purple', 1500);
        RAISE NOTICE 'Inserted sample levels data';
    END IF;
    
    -- Insert sample units if none exist
    IF NOT EXISTS (SELECT 1 FROM public.units LIMIT 1) THEN
        INSERT INTO public.units (id, level_id, title, description, unit_number, color_theme) VALUES
        ('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'Giới thiệu bản thân', 'Học cách giới thiệu bản thân và chào hỏi', 1, 'green'),
        ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'Gia đình', 'Từ vựng về các thành viên trong gia đình', 2, 'blue');
        RAISE NOTICE 'Inserted sample units data';
    END IF;
    
    -- Insert sample sessions if none exist
    IF NOT EXISTS (SELECT 1 FROM public.sessions LIMIT 1) THEN
        INSERT INTO public.sessions (id, unit_id, title, description, session_number, color_theme, xp_reward) VALUES
        ('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440011', 'Chào hỏi cơ bản', 'Học các cách chào hỏi thông dụng', 1, 'green', 50),
        ('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440011', 'Nói về tuổi và quê quán', 'Học cách nói về tuổi tác và nơi ở', 2, 'blue', 50);
        RAISE NOTICE 'Inserted sample sessions data';
    END IF;
END $$;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
END $$;
