-- ================================================================
-- Cohorts Schema: cohorts and cohort_members with RLS and policies
-- ================================================================

-- Create cohorts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'cohorts' AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Creating cohorts table...';

        CREATE TABLE public.cohorts (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            name text NOT NULL,
            description text,
            created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
            is_active boolean DEFAULT true,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );

        -- RLS
        ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

        -- Basic policies: admins full access; teachers can view cohorts they created
        CREATE POLICY "Admins select cohorts" ON public.cohorts
        FOR SELECT USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR created_by = auth.uid());

        CREATE POLICY "Admins insert cohorts" ON public.cohorts
        FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR created_by = auth.uid());

        CREATE POLICY "Admins update cohorts" ON public.cohorts
        FOR UPDATE USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR created_by = auth.uid())
        WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR created_by = auth.uid());

        CREATE POLICY "Admins delete cohorts" ON public.cohorts
        FOR DELETE USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR created_by = auth.uid());

        -- Trigger for updated_at
        IF EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
        ) THEN
            CREATE TRIGGER update_cohorts_updated_at
            BEFORE UPDATE ON public.cohorts
            FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
        END IF;
    END IF;
END $$;

-- Create cohort_members table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'cohort_members' AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Creating cohort_members table...';

        CREATE TABLE public.cohort_members (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            cohort_id uuid REFERENCES public.cohorts(id) ON DELETE CASCADE,
            student_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
            joined_at timestamp with time zone DEFAULT now(),
            is_active boolean DEFAULT true,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now(),
            UNIQUE (cohort_id, student_id)
        );

        -- RLS
        ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;

        -- Policies: admins full; creators of cohort can manage
        CREATE POLICY "Admins select cohort_members" ON public.cohort_members
        FOR SELECT USING (
            auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR
            cohort_id IN (SELECT id FROM public.cohorts WHERE created_by = auth.uid())
        );

        CREATE POLICY "Admins insert cohort_members" ON public.cohort_members
        FOR INSERT WITH CHECK (
            auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR
            cohort_id IN (SELECT id FROM public.cohorts WHERE created_by = auth.uid())
        );

        CREATE POLICY "Admins update cohort_members" ON public.cohort_members
        FOR UPDATE USING (
            auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR
            cohort_id IN (SELECT id FROM public.cohorts WHERE created_by = auth.uid())
        ) WITH CHECK (
            auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR
            cohort_id IN (SELECT id FROM public.cohorts WHERE created_by = auth.uid())
        );

        CREATE POLICY "Admins delete cohort_members" ON public.cohort_members
        FOR DELETE USING (
            auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin') OR
            cohort_id IN (SELECT id FROM public.cohorts WHERE created_by = auth.uid())
        );

        -- Trigger for updated_at
        IF EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
        ) THEN
            CREATE TRIGGER update_cohort_members_updated_at
            BEFORE UPDATE ON public.cohort_members
            FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
        END IF;
    END IF;
END $$;

-- Optional helper view for members with user info
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_name = 'v_cohort_members_detailed' AND table_schema = 'public'
    ) THEN
        CREATE VIEW public.v_cohort_members_detailed AS
        SELECT cm.id,
               cm.cohort_id,
               cm.student_id,
               u.full_name,
               u.email,
               u.xp,
               cm.joined_at,
               cm.is_active
        FROM public.cohort_members cm
        JOIN public.users u ON u.id = cm.student_id;
    END IF;
END $$;
