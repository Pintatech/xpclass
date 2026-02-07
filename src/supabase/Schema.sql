-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  icon text,
  criteria jsonb NOT NULL,
  xp_reward integer DEFAULT 0,
  badge_color text DEFAULT 'blue'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  badge_image_url text,
  badge_image_alt text DEFAULT 'Achievement Badge'::text,
  criteria_type text DEFAULT 'exercise_completed'::text,
  criteria_value integer DEFAULT 1,
  criteria_period text DEFAULT 'all_time'::text,
  CONSTRAINT achievements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.avatars (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  image_url text NOT NULL,
  unlock_xp integer NOT NULL DEFAULT 0,
  description text,
  tier text NOT NULL CHECK (tier = ANY (ARRAY['default'::text, 'bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text, 'diamond'::text])),
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT avatars_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cohort_members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cohort_id uuid,
  student_id uuid,
  joined_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cohort_members_pkey PRIMARY KEY (id),
  CONSTRAINT cohort_members_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id),
  CONSTRAINT cohort_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id)
);
CREATE TABLE public.cohorts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  created_by uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cohorts_pkey PRIMARY KEY (id),
  CONSTRAINT cohorts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.course_enrollments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  course_id uuid,
  student_id uuid,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id),
  CONSTRAINT course_enrollments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id)
);
CREATE TABLE public.course_progress (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  course_id uuid,
  status text DEFAULT 'locked'::text CHECK (status = ANY (ARRAY['locked'::text, 'available'::text, 'in_progress'::text, 'completed'::text])),
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  units_completed integer DEFAULT 0,
  total_units integer DEFAULT 0,
  xp_earned integer DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_progress_pkey PRIMARY KEY (id),
  CONSTRAINT level_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT level_progress_level_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.course_teachers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_teachers_pkey PRIMARY KEY (id),
  CONSTRAINT course_teachers_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_teachers_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  level_number integer NOT NULL UNIQUE,
  difficulty_label text NOT NULL,
  color_theme text DEFAULT 'blue'::text,
  unlock_requirement integer DEFAULT 0,
  is_active boolean DEFAULT true,
  thumbnail_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  teacher_id uuid,
  chest_enabled boolean DEFAULT false,
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id)
);
CREATE TABLE public.daily_quests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  quest_date date NOT NULL,
  status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'completed'::text, 'claimed'::text])),
  reward_xp integer DEFAULT 10,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_quests_pkey PRIMARY KEY (id),
  CONSTRAINT daily_quests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT daily_quests_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.exercise_assignments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  exercise_id uuid,
  session_id uuid,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exercise_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_assignments_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT exercise_assignments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.exercise_folders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  parent_folder_id uuid,
  description text,
  color text DEFAULT 'blue'::text,
  icon text DEFAULT 'folder'::text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exercise_folders_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES public.exercise_folders(id)
);
CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid,
  title text NOT NULL,
  exercise_type text NOT NULL CHECK (exercise_type = ANY (ARRAY['flashcard'::text, 'pronunciation'::text, 'fill_blank'::text, 'video'::text, 'quiz'::text, 'multiple_choice'::text, 'listening'::text, 'speaking'::text, 'drag_drop'::text, 'dropdown'::text, 'ai_fill_blank'::text, 'image_hotspot'::text])),
  content jsonb NOT NULL,
  image_urls ARRAY,
  difficulty_level integer DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  xp_reward integer DEFAULT 10,
  order_index integer NOT NULL,
  is_active boolean DEFAULT true,
  estimated_duration integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  folder_id uuid,
  is_in_bank boolean DEFAULT false,
  tags ARRAY,
  category text,
  description text,
  CONSTRAINT exercises_pkey PRIMARY KEY (id),
  CONSTRAINT exercises_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT exercises_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.exercise_folders(id)
);
CREATE TABLE public.individual_exercise_assignments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  due_date timestamp with time zone,
  status text NOT NULL DEFAULT 'assigned'::text CHECK (status = ANY (ARRAY['assigned'::text, 'in_progress'::text, 'completed'::text])),
  completed_at timestamp with time zone,
  score integer CHECK (score >= 0 AND score <= 100),
  notes text,
  priority text DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT individual_exercise_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT individual_exercise_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT individual_exercise_assignments_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT individual_exercise_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id)
);
CREATE TABLE public.question_attempts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  exercise_id uuid,
  exercise_type text,
  question_id text NOT NULL,
  selected_answer text,
  correct_answer text,
  is_correct boolean NOT NULL,
  attempt_number integer DEFAULT 1,
  response_time integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT question_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT question_attempts_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.session_progress (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  session_id uuid,
  status text DEFAULT 'locked'::text CHECK (status = ANY (ARRAY['locked'::text, 'available'::text, 'in_progress'::text, 'completed'::text])),
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  exercises_completed integer DEFAULT 0,
  total_exercises integer DEFAULT 0,
  xp_earned integer DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT session_progress_pkey PRIMARY KEY (id),
  CONSTRAINT session_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT session_progress_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  unit_id uuid,
  title text NOT NULL,
  description text,
  session_number integer NOT NULL,
  session_type text DEFAULT 'mixed'::text CHECK (session_type = ANY (ARRAY['vocabulary'::text, 'grammar'::text, 'pronunciation'::text, 'listening'::text, 'mixed'::text])),
  difficulty_level integer DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  xp_reward integer DEFAULT 50,
  unlock_requirement text,
  is_active boolean DEFAULT true,
  thumbnail_url text,
  estimated_duration integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT site_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.student_levels (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  level_number integer NOT NULL UNIQUE,
  xp_required integer NOT NULL,
  badge_name text NOT NULL,
  badge_tier text NOT NULL CHECK (badge_tier = ANY (ARRAY['bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text, 'diamond'::text])),
  badge_icon text,
  badge_color text NOT NULL,
  badge_description text,
  title_unlocked text,
  perks_unlocked jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_levels_pkey PRIMARY KEY (id)
);
CREATE TABLE public.student_levels_backup (
  id uuid,
  level_number integer,
  xp_required integer,
  badge_name text,
  badge_tier text,
  badge_icon text,
  badge_color text,
  badge_description text,
  title_unlocked text,
  perks_unlocked jsonb,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
CREATE TABLE public.unit_reward_claims (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  xp_awarded integer NOT NULL CHECK (xp_awarded >= 5 AND xp_awarded <= 20),
  claimed_at timestamp with time zone DEFAULT now(),
  full_name text,
  CONSTRAINT unit_reward_claims_pkey PRIMARY KEY (id),
  CONSTRAINT unit_reward_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT unit_reward_claims_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.units (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  course_id uuid,
  title text NOT NULL,
  description text,
  unit_number integer NOT NULL,
  color_theme text DEFAULT 'blue'::text,
  unlock_requirement integer DEFAULT 0,
  is_active boolean DEFAULT true,
  thumbnail_url text,
  estimated_duration integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT units_pkey PRIMARY KEY (id),
  CONSTRAINT units_level_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.user_achievements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  achievement_id uuid,
  earned_at timestamp with time zone DEFAULT now(),
  claimed_at timestamp with time zone,
  xp_claimed integer DEFAULT 0,
  CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id)
);
CREATE TABLE public.user_progress (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  course_id uuid,
  unit_id uuid,
  session_id uuid,
  exercise_id uuid,
  status text DEFAULT 'not_started'::text CHECK (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'attempted'::text])),
  score integer,
  max_score integer,
  attempts integer DEFAULT 0,
  time_spent integer DEFAULT 0,
  first_attempt_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  question_index integer DEFAULT 0,
  xp_earned integer DEFAULT 0,
  full_name text,
  exercise_title text,
  CONSTRAINT user_progress_pkey PRIMARY KEY (id),
  CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_progress_level_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT user_progress_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT user_progress_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT user_progress_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'teacher'::text])),
  current_level integer DEFAULT 1,
  xp integer DEFAULT 0,
  streak_count integer DEFAULT 0,
  last_activity_date date,
  total_practice_time integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  level integer DEFAULT 1,
  username text UNIQUE,
  gems integer DEFAULT 0,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.session_reward_claims (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  full_name text,
  xp_awarded integer NOT NULL DEFAULT 0,
  gems_awarded integer DEFAULT 0,
  claimed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT session_reward_claims_pkey PRIMARY KEY (id),
  CONSTRAINT session_reward_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT session_reward_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.shop_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  price integer NOT NULL,
  image_url text,
  item_data jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shop_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_purchases (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  purchased_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT user_purchases_user_id_item_id_key UNIQUE (user_id, item_id),
  CONSTRAINT user_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_purchases_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.shop_items(id)
);
CREATE TABLE public.weekly_xp_tracking (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  total_xp integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weekly_xp_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_xp_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- ====================================
-- DAILY CHALLENGE SYSTEM
-- ====================================

-- Add gem_reward column to achievements table (if not exists)
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS gem_reward integer DEFAULT 0;

-- Daily Challenges Table
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  challenge_date date NOT NULL,
  difficulty_level text NOT NULL,
  exercise_id uuid NOT NULL,
  base_xp_reward integer DEFAULT 50,
  base_gem_reward integer DEFAULT 5,
  top1_achievement_id uuid,
  top2_achievement_id uuid,
  top3_achievement_id uuid,
  is_active boolean DEFAULT true,
  winners_awarded boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT daily_challenges_date_level_key UNIQUE (challenge_date, difficulty_level),
  CONSTRAINT daily_challenges_difficulty_level_check CHECK (difficulty_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text])),
  CONSTRAINT daily_challenges_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT daily_challenges_top1_achievement_id_fkey FOREIGN KEY (top1_achievement_id) REFERENCES public.achievements(id),
  CONSTRAINT daily_challenges_top2_achievement_id_fkey FOREIGN KEY (top2_achievement_id) REFERENCES public.achievements(id),
  CONSTRAINT daily_challenges_top3_achievement_id_fkey FOREIGN KEY (top3_achievement_id) REFERENCES public.achievements(id)
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_date_level ON public.daily_challenges(challenge_date DESC, difficulty_level);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_active ON public.daily_challenges(is_active, challenge_date);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_locked ON public.daily_challenges(is_locked, challenge_date);

-- Daily Challenge Participations Table
CREATE TABLE IF NOT EXISTS public.daily_challenge_participations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  score integer NOT NULL,
  time_spent integer NOT NULL,
  attempts integer DEFAULT 1,
  completed_at timestamp with time zone DEFAULT now(),
  base_reward_claimed boolean DEFAULT false,
  rank_calculated integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_challenge_participations_pkey PRIMARY KEY (id),
  CONSTRAINT daily_challenge_participations_unique UNIQUE (challenge_id, user_id),
  CONSTRAINT daily_challenge_participations_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  CONSTRAINT daily_challenge_participations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT daily_challenge_participations_score_check CHECK (score >= 0 AND score <= 100),
  CONSTRAINT daily_challenge_participations_attempts_check CHECK (attempts >= 1 AND attempts <= 3)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participations_ranking ON public.daily_challenge_participations(challenge_id, score DESC, time_spent ASC);
CREATE INDEX IF NOT EXISTS idx_challenge_participations_user ON public.daily_challenge_participations(user_id, completed_at DESC);

-- Daily Challenge Individual Attempts Table
-- Tracks each individual attempt with its own timing and score
CREATE TABLE IF NOT EXISTS public.daily_challenge_attempts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  participation_id uuid NOT NULL,
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 3),
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  started_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone NOT NULL,
  time_spent integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_challenge_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT daily_challenge_attempts_participation_id_fkey
    FOREIGN KEY (participation_id) REFERENCES public.daily_challenge_participations(id) ON DELETE CASCADE,
  CONSTRAINT daily_challenge_attempts_challenge_id_fkey
    FOREIGN KEY (challenge_id) REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  CONSTRAINT daily_challenge_attempts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT daily_challenge_attempts_unique
    UNIQUE (challenge_id, user_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_participation
  ON public.daily_challenge_attempts(participation_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_ranking
  ON public.daily_challenge_attempts(challenge_id, score DESC, time_spent ASC);

-- Add columns to daily_challenge_participations to reference best attempt
ALTER TABLE public.daily_challenge_participations
  ADD COLUMN IF NOT EXISTS best_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS first_attempt_at timestamp with time zone;

-- Add foreign key constraint for best_attempt_id (must be added after column creation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'daily_challenge_participations_best_attempt_id_fkey'
  ) THEN
    ALTER TABLE public.daily_challenge_participations
      ADD CONSTRAINT daily_challenge_participations_best_attempt_id_fkey
        FOREIGN KEY (best_attempt_id) REFERENCES public.daily_challenge_attempts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_participations_best_attempt
  ON public.daily_challenge_participations(best_attempt_id);

-- One-time migration: Create attempt records from existing participations
-- This creates a single attempt record for each existing participation
DO $$
DECLARE
  participation_rec RECORD;
  new_attempt_id uuid;
  migration_count integer := 0;
BEGIN
  FOR participation_rec IN
    SELECT id, challenge_id, user_id, score, time_spent, completed_at, created_at
    FROM daily_challenge_participations
    WHERE best_attempt_id IS NULL  -- Only migrate unmigrated records
  LOOP
    -- Create one attempt record representing their known best attempt
    INSERT INTO daily_challenge_attempts (
      participation_id, challenge_id, user_id, attempt_number,
      score, started_at, completed_at, time_spent, created_at
    ) VALUES (
      participation_rec.id,
      participation_rec.challenge_id,
      participation_rec.user_id,
      1,  -- Assume their first/best attempt
      participation_rec.score,
      participation_rec.completed_at - (participation_rec.time_spent || ' seconds')::interval,
      participation_rec.completed_at,
      participation_rec.time_spent,
      participation_rec.created_at
    )
    RETURNING id INTO new_attempt_id;

    -- Link participation to this attempt
    UPDATE daily_challenge_participations
    SET
      best_attempt_id = new_attempt_id,
      first_attempt_at = participation_rec.completed_at - (participation_rec.time_spent || ' seconds')::interval
    WHERE id = participation_rec.id;

    migration_count := migration_count + 1;
  END LOOP;

  RAISE NOTICE 'Migration complete: % participation records migrated to attempts', migration_count;
END $$;

-- Achievement records for daily challenges
-- Beginner Level (Levels 1-10)
INSERT INTO public.achievements (title, description, icon, criteria_type, criteria_value, xp_reward, gem_reward, badge_color, is_active, criteria)
VALUES
('Beginner Champion', 'Hạng 1 Daily Challenge (Beginner)', 'Crown', 'daily_challenge_rank_1_beginner', 1, 80, 15, 'yellow', true, '{"type": "daily_challenge_rank_1_beginner", "value": 1}'::jsonb),
('Beginner Runner-up', 'Hạng 2 Daily Challenge (Beginner)', 'Medal', 'daily_challenge_rank_2_beginner', 2, 60, 12, 'silver', true, '{"type": "daily_challenge_rank_2_beginner", "value": 2}'::jsonb),
('Beginner Elite', 'Hạng 3 Daily Challenge (Beginner)', 'Trophy', 'daily_challenge_rank_3_beginner', 3, 40, 8, 'orange', true, '{"type": "daily_challenge_rank_3_beginner", "value": 3}'::jsonb)
ON CONFLICT DO NOTHING;

-- Intermediate Level (Levels 11-20)
INSERT INTO public.achievements (title, description, icon, criteria_type, criteria_value, xp_reward, gem_reward, badge_color, is_active, criteria)
VALUES
('Intermediate Champion', 'Hạng 1 Daily Challenge (Intermediate)', 'Crown', 'daily_challenge_rank_1_intermediate', 1, 120, 20, 'yellow', true, '{"type": "daily_challenge_rank_1_intermediate", "value": 1}'::jsonb),
('Intermediate Runner-up', 'Hạng 2 Daily Challenge (Intermediate)', 'Medal', 'daily_challenge_rank_2_intermediate', 2, 90, 15, 'silver', true, '{"type": "daily_challenge_rank_2_intermediate", "value": 2}'::jsonb),
('Intermediate Elite', 'Hạng 3 Daily Challenge (Intermediate)', 'Trophy', 'daily_challenge_rank_3_intermediate', 3, 60, 12, 'orange', true, '{"type": "daily_challenge_rank_3_intermediate", "value": 3}'::jsonb)
ON CONFLICT DO NOTHING;

-- Advanced Level (Levels 21-30)
INSERT INTO public.achievements (title, description, icon, criteria_type, criteria_value, xp_reward, gem_reward, badge_color, is_active, criteria)
VALUES
('Advanced Champion', 'Hạng 1 Daily Challenge (Advanced)', 'Crown', 'daily_challenge_rank_1_advanced', 1, 160, 25, 'yellow', true, '{"type": "daily_challenge_rank_1_advanced", "value": 1}'::jsonb),
('Advanced Runner-up', 'Hạng 2 Daily Challenge (Advanced)', 'Medal', 'daily_challenge_rank_2_advanced', 2, 120, 20, 'silver', true, '{"type": "daily_challenge_rank_2_advanced", "value": 2}'::jsonb),
('Advanced Elite', 'Hạng 3 Daily Challenge (Advanced)', 'Trophy', 'daily_challenge_rank_3_advanced', 3, 80, 16, 'orange', true, '{"type": "daily_challenge_rank_3_advanced", "value": 3}'::jsonb)
ON CONFLICT DO NOTHING;

-- ====================================
-- RPC FUNCTIONS FOR DAILY CHALLENGES
-- ====================================

-- Function: Get today's challenge for user based on their level
CREATE OR REPLACE FUNCTION get_user_daily_challenge(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  vietnam_today date;
  user_difficulty text;
  user_level_num integer;
  challenge_record record;
  user_participation record;
  result json;
BEGIN
  -- Get today's date in Vietnam timezone
  vietnam_today := (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

  -- Get user's current level number directly from users table
  SELECT current_level INTO user_level_num
  FROM users
  WHERE id = p_user_id;

  -- Determine difficulty based on level number
  IF user_level_num IS NULL OR user_level_num <= 10 THEN
    user_difficulty := 'beginner'; -- Levels 1-10
  ELSIF user_level_num <= 20 THEN
    user_difficulty := 'intermediate'; -- Levels 11-20
  ELSE
    user_difficulty := 'advanced'; -- Levels 21-30
  END IF;

  -- Get today's challenge for user's difficulty
  SELECT * INTO challenge_record
  FROM daily_challenges
  WHERE challenge_date = vietnam_today
    AND difficulty_level = user_difficulty
    AND is_active = true
  LIMIT 1;

  IF challenge_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No challenge available');
  END IF;

  -- Check user participation
  SELECT * INTO user_participation
  FROM daily_challenge_participations
  WHERE challenge_id = challenge_record.id AND user_id = p_user_id;

  -- Build result with exercise details
  SELECT json_build_object(
    'success', true,
    'challenge_id', challenge_record.id,
    'difficulty_level', challenge_record.difficulty_level,
    'exercise_id', challenge_record.exercise_id,
    'exercise_title', e.title,
    'exercise_type', e.exercise_type,
    'base_xp_reward', challenge_record.base_xp_reward,
    'base_gem_reward', challenge_record.base_gem_reward,
    'is_locked', challenge_record.is_locked,
    'winners_awarded', challenge_record.winners_awarded,
    'participated', (user_participation IS NOT NULL),
    'user_score', user_participation.score,
    'user_rank', (
      -- Calculate rank dynamically instead of using cached rank_calculated
      CASE
        WHEN user_participation.score >= 75 THEN
          (SELECT COUNT(*) + 1
           FROM daily_challenge_participations dcp
           WHERE dcp.challenge_id = challenge_record.id
             AND dcp.score >= 75
             AND (dcp.score > user_participation.score
               OR (dcp.score = user_participation.score
                 AND dcp.time_spent < user_participation.time_spent)))
        ELSE NULL
      END
    ),
    'user_time', user_participation.time_spent,
    'attempts_used', COALESCE(user_participation.attempts, 0),
    'max_attempts', 3,
    'session_id', e.session_id
  ) INTO result
  FROM exercises e
  WHERE e.id = challenge_record.exercise_id;

  RETURN result;
END;
$$;

-- Function: Record challenge participation with 3-attempt limit (tracks all attempts, rewards only 75%+)
CREATE OR REPLACE FUNCTION record_challenge_participation(
  p_challenge_id uuid,
  p_user_id uuid,
  p_score integer,
  p_time_spent integer,
  p_started_at timestamp with time zone DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_record record;
  existing_participation record;
  participation_id uuid;
  user_rank integer;
  base_xp integer;
  base_gems integer;
  attempts_used integer;
  new_attempt_id uuid;
  is_passing boolean;
BEGIN
  -- Check if score passes minimum threshold
  is_passing := p_score >= 75;

  -- Get challenge details
  SELECT * INTO challenge_record
  FROM daily_challenges
  WHERE id = p_challenge_id AND is_active = true;

  IF challenge_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Challenge not found');
  END IF;

  -- Check if challenge is locked
  IF challenge_record.is_locked = true THEN
    RETURN json_build_object('success', false, 'error', 'Challenge is locked. Winners have been awarded.');
  END IF;

  -- Check user role
  IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND role IN ('teacher', 'admin')) THEN
    RETURN json_build_object('success', false, 'error', 'Only students can participate');
  END IF;

  -- Check existing participation
  SELECT * INTO existing_participation
  FROM daily_challenge_participations
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

  -- Enforce 3 attempt limit
  IF existing_participation IS NOT NULL AND existing_participation.attempts >= 3 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Maximum 3 attempts reached',
      'attempts_used', existing_participation.attempts
    );
  END IF;

  attempts_used := COALESCE(existing_participation.attempts, 0) + 1;

  -- Insert or update participation (track all attempts, but only update score if passing)
  INSERT INTO daily_challenge_participations (
    challenge_id, user_id, score, time_spent, attempts, completed_at
  ) VALUES (
    p_challenge_id, p_user_id, p_score, p_time_spent, attempts_used, NOW()
  )
  ON CONFLICT (challenge_id, user_id)
  DO UPDATE SET
    score = CASE
      WHEN EXCLUDED.score >= 75 THEN GREATEST(daily_challenge_participations.score, EXCLUDED.score)
      ELSE daily_challenge_participations.score
    END,
    time_spent = CASE
      WHEN EXCLUDED.score >= 75 AND EXCLUDED.score > daily_challenge_participations.score THEN EXCLUDED.time_spent
      WHEN EXCLUDED.score >= 75 AND EXCLUDED.score = daily_challenge_participations.score THEN
        LEAST(daily_challenge_participations.time_spent, EXCLUDED.time_spent)
      ELSE daily_challenge_participations.time_spent
    END,
    attempts = attempts_used,
    completed_at = NOW()
  RETURNING id INTO participation_id;

  -- Calculate rank using the participation's best score (not current attempt score)
  -- Re-read the participation after UPSERT to get the actual best score/time
  DECLARE
    best_score integer;
    best_time integer;
  BEGIN
    SELECT dcp.score, dcp.time_spent INTO best_score, best_time
    FROM daily_challenge_participations dcp
    WHERE dcp.id = participation_id;

    IF best_score >= 75 THEN
      SELECT COUNT(*) + 1 INTO user_rank
      FROM daily_challenge_participations
      WHERE challenge_id = p_challenge_id
        AND user_id != p_user_id
        AND score >= 75
        AND (score > best_score OR (score = best_score AND time_spent < best_time));

      -- Update cached rank
      UPDATE daily_challenge_participations
      SET rank_calculated = user_rank
      WHERE id = participation_id;
    ELSE
      user_rank := NULL;
    END IF;
  END;

  -- Insert individual attempt record (all attempts tracked)
  INSERT INTO daily_challenge_attempts (
    participation_id, challenge_id, user_id, attempt_number,
    score, started_at, completed_at, time_spent
  ) VALUES (
    participation_id,
    p_challenge_id,
    p_user_id,
    attempts_used,
    p_score,
    COALESCE(p_started_at, NOW() - (p_time_spent || ' seconds')::interval),
    NOW(),
    p_time_spent
  ) RETURNING id INTO new_attempt_id;

  -- Determine if this is the new best attempt (only for passing scores)
  IF is_passing AND (
     existing_participation IS NULL OR
     p_score > existing_participation.score OR
     (p_score = existing_participation.score AND p_time_spent < existing_participation.time_spent)
  ) THEN
    -- Update participation to point to this attempt as best
    UPDATE daily_challenge_participations
    SET best_attempt_id = new_attempt_id
    WHERE id = participation_id;
  END IF;

  -- Set first_attempt_at if this is the first attempt
  IF attempts_used = 1 THEN
    UPDATE daily_challenge_participations
    SET first_attempt_at = COALESCE(p_started_at, NOW() - (p_time_spent || ' seconds')::interval)
    WHERE id = participation_id;
  END IF;

  -- Award base rewards (only on first PASSING attempt with score >= 75%)
  IF is_passing AND attempts_used = 1 THEN
    UPDATE users
    SET xp = xp + challenge_record.base_xp_reward,
        gems = gems + challenge_record.base_gem_reward
    WHERE id = p_user_id;

    UPDATE daily_challenge_participations
    SET base_reward_claimed = true
    WHERE id = participation_id;

    base_xp := challenge_record.base_xp_reward;
    base_gems := challenge_record.base_gem_reward;
  ELSIF is_passing AND existing_participation IS NOT NULL AND existing_participation.score < 75 THEN
    -- First time passing (after previous failed attempts)
    UPDATE users
    SET xp = xp + challenge_record.base_xp_reward,
        gems = gems + challenge_record.base_gem_reward
    WHERE id = p_user_id;

    UPDATE daily_challenge_participations
    SET base_reward_claimed = true
    WHERE id = participation_id;

    base_xp := challenge_record.base_xp_reward;
    base_gems := challenge_record.base_gem_reward;
  ELSE
    base_xp := 0;
    base_gems := 0;
  END IF;

  RETURN json_build_object(
    'success', true,
    'is_passing', is_passing,
    'rank', user_rank,
    'score', p_score,
    'xp_awarded', base_xp,
    'gems_awarded', base_gems,
    'attempts_used', attempts_used,
    'attempts_remaining', 3 - attempts_used,
    'attempt_id', new_attempt_id
  );
END;
$$;

-- Function: Get leaderboard for a challenge
CREATE OR REPLACE FUNCTION get_daily_challenge_leaderboard(
  p_challenge_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  rank integer,
  user_id uuid,
  full_name text,
  avatar_url text,
  active_frame_ratio text,
  score integer,
  time_spent integer,
  attempts integer,
  xp integer,
  level integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY dcp.score DESC, dcp.time_spent ASC)::integer AS rank,
    u.id AS user_id,
    u.full_name,
    u.avatar_url,
    u.active_frame_ratio,
    dcp.score,
    dcp.time_spent,
    dcp.attempts,
    u.xp,
    u.level
  FROM daily_challenge_participations dcp
  JOIN users u ON dcp.user_id = u.id
  WHERE dcp.challenge_id = p_challenge_id
    AND dcp.score >= 75
    AND u.role = 'user'
  ORDER BY dcp.score DESC, dcp.time_spent ASC
  LIMIT p_limit;
END;
$$;

-- Function: Get all attempts for a user's challenge participation
CREATE OR REPLACE FUNCTION get_user_challenge_attempts(
  p_challenge_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  attempt_number integer,
  score integer,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  time_spent integer,
  is_best boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  best_attempt_id_var uuid;
BEGIN
  -- Get the best attempt ID
  SELECT best_attempt_id INTO best_attempt_id_var
  FROM daily_challenge_participations
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

  RETURN QUERY
  SELECT
    dca.attempt_number,
    dca.score,
    dca.started_at,
    dca.completed_at,
    dca.time_spent,
    (dca.id = best_attempt_id_var) AS is_best
  FROM daily_challenge_attempts dca
  WHERE dca.challenge_id = p_challenge_id
    AND dca.user_id = p_user_id
  ORDER BY dca.attempt_number ASC;
END;
$$;

-- Function: Award top performers (called by cron daily at 00:05)
CREATE OR REPLACE FUNCTION award_daily_challenge_winners()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yesterday_date date;
  challenge_rec record;
  top1_user_id uuid;
  top2_user_id uuid;
  top3_user_id uuid;
  top1_xp integer;
  top1_gems integer;
  top2_xp integer;
  top2_gems integer;
  top3_xp integer;
  top3_gems integer;
  results json[];
BEGIN
  yesterday_date := ((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 day')::date;

  -- Process each difficulty level's challenge
  FOR challenge_rec IN
    SELECT id, difficulty_level, top1_achievement_id, top2_achievement_id, top3_achievement_id
    FROM daily_challenges
    WHERE challenge_date = yesterday_date AND is_active = true AND winners_awarded = false
  LOOP
    -- Get top 1 user
    SELECT user_id INTO top1_user_id
    FROM daily_challenge_participations
    WHERE challenge_id = challenge_rec.id AND score >= 75
    ORDER BY score DESC, time_spent ASC
    LIMIT 1;

    -- Get top 2 user (excluding top 1)
    SELECT user_id INTO top2_user_id
    FROM daily_challenge_participations
    WHERE challenge_id = challenge_rec.id
      AND score >= 75
      AND user_id != COALESCE(top1_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY score DESC, time_spent ASC
    LIMIT 1;

    -- Get top 3 user (excluding top 1 and top 2)
    SELECT user_id INTO top3_user_id
    FROM daily_challenge_participations
    WHERE challenge_id = challenge_rec.id
      AND score >= 75
      AND user_id != COALESCE(top1_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND user_id != COALESCE(top2_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY score DESC, time_spent ASC
    LIMIT 1;

    -- Award top 1
    IF top1_user_id IS NOT NULL AND challenge_rec.top1_achievement_id IS NOT NULL THEN
      -- Get achievement rewards
      SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
      INTO top1_xp, top1_gems
      FROM achievements
      WHERE id = challenge_rec.top1_achievement_id;

      -- Insert achievement record
      INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
      VALUES (top1_user_id, challenge_rec.top1_achievement_id, NOW(), NOW(), top1_xp);

      -- Award XP and gems
      UPDATE users
      SET xp = xp + top1_xp,
          gems = gems + top1_gems
      WHERE id = top1_user_id;

      results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 1, 'user_id', top1_user_id, 'xp', top1_xp, 'gems', top1_gems));
    END IF;

    -- Award top 2
    IF top2_user_id IS NOT NULL AND challenge_rec.top2_achievement_id IS NOT NULL THEN
      -- Get achievement rewards
      SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
      INTO top2_xp, top2_gems
      FROM achievements
      WHERE id = challenge_rec.top2_achievement_id;

      -- Insert achievement record
      INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
      VALUES (top2_user_id, challenge_rec.top2_achievement_id, NOW(), NOW(), top2_xp);

      -- Award XP and gems
      UPDATE users
      SET xp = xp + top2_xp,
          gems = gems + top2_gems
      WHERE id = top2_user_id;

      results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 2, 'user_id', top2_user_id, 'xp', top2_xp, 'gems', top2_gems));
    END IF;

    -- Award top 3
    IF top3_user_id IS NOT NULL AND challenge_rec.top3_achievement_id IS NOT NULL THEN
      -- Get achievement rewards
      SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
      INTO top3_xp, top3_gems
      FROM achievements
      WHERE id = challenge_rec.top3_achievement_id;

      -- Insert achievement record
      INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
      VALUES (top3_user_id, challenge_rec.top3_achievement_id, NOW(), NOW(), top3_xp);

      -- Award XP and gems
      UPDATE users
      SET xp = xp + top3_xp,
          gems = gems + top3_gems
      WHERE id = top3_user_id;

      results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 3, 'user_id', top3_user_id, 'xp', top3_xp, 'gems', top3_gems));
    END IF;

    -- Mark challenge as awarded AND locked
    UPDATE daily_challenges
    SET winners_awarded = true,
        is_locked = true
    WHERE id = challenge_rec.id;
  END LOOP;

  RETURN json_build_object('success', true, 'awarded', results);
END;
$$
);

-- ====================================
-- PET SYSTEM
-- ====================================

-- Pets catalog (all available pets)
CREATE TABLE IF NOT EXISTS public.pets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  info text,  -- Animal type/species (e.g., "Cat", "Dragon", "Hamster") for AI prompts
  description text,
  image_url text,
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  evolution_stages jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pets_pkey PRIMARY KEY (id)
);

-- Add info column to pets table (if not exists)
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS info text;

-- User's owned pets
CREATE TABLE IF NOT EXISTS public.user_pets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  nickname text,
  level integer DEFAULT 1,
  xp integer DEFAULT 0,
  happiness integer DEFAULT 100 CHECK (happiness >= 0 AND happiness <= 100),
  energy integer DEFAULT 100 CHECK (energy >= 0 AND energy <= 100),
  evolution_stage integer DEFAULT 0,
  is_active boolean DEFAULT false,
  obtained_at timestamp with time zone DEFAULT now(),
  last_fed_at timestamp with time zone,
  last_played_at timestamp with time zone,
  CONSTRAINT user_pets_pkey PRIMARY KEY (id),
  CONSTRAINT user_pets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_pets_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id)
);

CREATE INDEX IF NOT EXISTS idx_user_pets_user ON public.user_pets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pets_active ON public.user_pets(user_id) WHERE is_active = true;

-- ====================================
-- RPC FUNCTIONS FOR PET SYSTEM
-- ====================================

-- Function: Get user's active pet with full details
CREATE OR REPLACE FUNCTION get_active_pet(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  pet_record record;
  bonuses json;
BEGIN
  SELECT
    up.*,
    p.name as pet_name,
    p.info as pet_info,
    p.description as pet_description,
    p.image_url as pet_image_url,
    p.rarity,
    p.evolution_stages
  INTO pet_record
  FROM user_pets up
  JOIN pets p ON up.pet_id = p.id
  WHERE up.user_id = p_user_id AND up.is_active = true
  LIMIT 1;

  IF pet_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No active pet');
  END IF;

  SELECT json_agg(json_build_object(
    'bonus_type', pb.bonus_type,
    'bonus_value', pb.bonus_value,
    'description', pb.description
  ))
  INTO bonuses
  FROM pet_bonuses pb
  WHERE pb.pet_id = pet_record.pet_id
    AND pet_record.happiness >= pb.min_happiness;

  RETURN json_build_object(
    'success', true,
    'pet', json_build_object(
      'id', pet_record.id,
      'pet_id', pet_record.pet_id,
      'nickname', pet_record.nickname,
      'name', pet_record.pet_name,
      'info', pet_record.pet_info,
      'description', pet_record.pet_description,
      'image_url', pet_record.pet_image_url,
      'rarity', pet_record.rarity,
      'happiness', pet_record.happiness,
      'energy', pet_record.energy,
      'level', pet_record.level,
      'xp', pet_record.xp,
      'evolution_stage', pet_record.evolution_stage,
      'evolution_stages', pet_record.evolution_stages,
      'last_fed_at', pet_record.last_fed_at,
      'last_played_at', pet_record.last_played_at
    ),
    'bonuses', COALESCE(bonuses, '[]'::json)
  );
END;
$$;

-- Function: Set active pet
CREATE OR REPLACE FUNCTION set_active_pet(p_user_id uuid, p_user_pet_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM user_pets
    WHERE id = p_user_pet_id AND user_id = p_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Pet not found');
  END IF;

  -- Deactivate all user's pets
  UPDATE user_pets
  SET is_active = false, updated_at = now()
  WHERE user_id = p_user_id;

  -- Activate selected pet
  UPDATE user_pets
  SET is_active = true, updated_at = now()
  WHERE id = p_user_pet_id;

  RETURN json_build_object('success', true);
END;
$$;

-- ====================================
-- INVENTORY & CRAFTING SYSTEM
-- ====================================

-- Collectible Items catalog (admin-defined)
CREATE TABLE IF NOT EXISTS public.collectible_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  image_url text,
  item_type text NOT NULL CHECK (item_type IN ('fragment', 'card', 'material')),
  set_name text,
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic')),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT collectible_items_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_collectible_items_type ON public.collectible_items(item_type);
CREATE INDEX IF NOT EXISTS idx_collectible_items_set ON public.collectible_items(set_name);

-- User Inventory (what each student owns)
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  obtained_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT user_inventory_user_item_key UNIQUE (user_id, item_id),
  CONSTRAINT user_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.collectible_items(id)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON public.user_inventory(user_id);

-- Chests (admin-defined with loot tables)
CREATE TABLE IF NOT EXISTS public.chests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  image_url text,
  chest_type text NOT NULL DEFAULT 'standard' CHECK (chest_type IN ('standard', 'premium', 'event')),
  loot_table jsonb NOT NULL DEFAULT '[]'::jsonb,
  guaranteed_items jsonb DEFAULT '[]'::jsonb,
  items_per_open integer NOT NULL DEFAULT 3,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chests_pkey PRIMARY KEY (id)
);

-- User Chests (earned but possibly not yet opened)
CREATE TABLE IF NOT EXISTS public.user_chests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  chest_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'milestone',
  source_ref text,
  earned_at timestamp with time zone DEFAULT now(),
  opened_at timestamp with time zone,
  items_received jsonb,
  CONSTRAINT user_chests_pkey PRIMARY KEY (id),
  CONSTRAINT user_chests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_chests_chest_id_fkey FOREIGN KEY (chest_id) REFERENCES public.chests(id)
);

CREATE INDEX IF NOT EXISTS idx_user_chests_user_unopened ON public.user_chests(user_id) WHERE opened_at IS NULL;

-- Recipes (crafting/exchange definitions)
CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  result_type text NOT NULL CHECK (result_type IN ('cosmetic', 'xp', 'gems', 'item')),
  result_shop_item_id uuid,
  result_item_id uuid,
  result_xp integer DEFAULT 0,
  result_gems integer DEFAULT 0,
  result_image_url text,
  result_data jsonb DEFAULT '{}'::jsonb,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  max_crafts_per_user integer,
  result_quantity integer DEFAULT 1 CHECK (result_quantity >= 1),
  success_rate integer DEFAULT 100 CHECK (success_rate >= 0 AND success_rate <= 100),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_result_shop_item_fkey FOREIGN KEY (result_shop_item_id) REFERENCES public.shop_items(id),
  CONSTRAINT recipes_result_item_fkey FOREIGN KEY (result_item_id) REFERENCES public.collectible_items(id)
);

-- Add success_rate column if not exists (for existing tables)
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS success_rate integer DEFAULT 100 CHECK (success_rate >= 0 AND success_rate <= 100);

-- Add result_quantity column if not exists (for existing tables)
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS result_quantity integer DEFAULT 1 CHECK (result_quantity >= 1);

-- User Crafts log
CREATE TABLE IF NOT EXISTS public.user_crafts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  recipe_id uuid NOT NULL,
  crafted_at timestamp with time zone DEFAULT now(),
  result_data jsonb,
  CONSTRAINT user_crafts_pkey PRIMARY KEY (id),
  CONSTRAINT user_crafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_crafts_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id)
);

CREATE INDEX IF NOT EXISTS idx_user_crafts_user ON public.user_crafts(user_id);

-- Drop Config (global drop rate settings)
CREATE TABLE IF NOT EXISTS public.drop_config (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT drop_config_pkey PRIMARY KEY (id)
);

-- Seed default drop config
INSERT INTO public.drop_config (config_key, config_value, description) VALUES
('exercise_drop_rate', '{"base_chance": 0.30, "rarity_weights": {"common": 60, "uncommon": 25, "rare": 12, "epic": 3}}', 'Chance of item drop on exercise completion (score >= 75%). Rarity weights for which item drops.'),
('milestone_chests', '{"session_complete": "standard", "streak_7": "standard", "streak_30": "premium", "challenge_win_top3": "standard"}', 'Which chest type to award for each milestone type.')
ON CONFLICT (config_key) DO NOTHING;

-- ====================================
-- RPC FUNCTIONS FOR INVENTORY SYSTEM
-- ====================================

-- Function: Roll for item drop on exercise completion
CREATE OR REPLACE FUNCTION roll_exercise_drop(p_user_id uuid, p_exercise_id uuid, p_score integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_record record;
  base_chance float;
  rarity_weights jsonb;
  total_weight integer;
  roll float;
  rarity_roll float;
  selected_rarity text;
  cumulative_weight integer;
  rarity_key text;
  rarity_value integer;
  selected_item record;
  included_items jsonb;
  has_include_filter boolean;
BEGIN
  -- No drop if score below 75%
  IF p_score < 75 THEN
    RETURN json_build_object('dropped', false);
  END IF;

  -- Get drop config
  SELECT config_value INTO config_record
  FROM drop_config
  WHERE config_key = 'exercise_drop_rate';

  IF config_record IS NULL THEN
    RETURN json_build_object('dropped', false);
  END IF;

  base_chance := (config_record.config_value->>'base_chance')::float;
  rarity_weights := config_record.config_value->'rarity_weights';
  included_items := COALESCE(config_record.config_value->'included_items', '[]'::jsonb);
  has_include_filter := jsonb_array_length(included_items) > 0;

  -- Roll for drop
  roll := random();
  IF roll > base_chance THEN
    RETURN json_build_object('dropped', false);
  END IF;

  -- Calculate total weight
  total_weight := 0;
  FOR rarity_key, rarity_value IN SELECT * FROM jsonb_each_text(rarity_weights)
  LOOP
    total_weight := total_weight + rarity_value::integer;
  END LOOP;

  -- Roll for rarity
  rarity_roll := random() * total_weight;
  cumulative_weight := 0;
  selected_rarity := 'common';

  FOR rarity_key, rarity_value IN SELECT * FROM jsonb_each_text(rarity_weights)
  LOOP
    cumulative_weight := cumulative_weight + rarity_value::integer;
    IF rarity_roll <= cumulative_weight THEN
      selected_rarity := rarity_key;
      EXIT;
    END IF;
  END LOOP;

  -- Pick a random active item of that rarity (filtered by included_items if set)
  SELECT * INTO selected_item
  FROM collectible_items
  WHERE is_active = true AND rarity = selected_rarity
    AND (NOT has_include_filter OR (included_items ? id::text))
  ORDER BY random()
  LIMIT 1;

  IF selected_item IS NULL THEN
    -- Fallback to any active item (filtered by included_items if set)
    SELECT * INTO selected_item
    FROM collectible_items
    WHERE is_active = true
      AND (NOT has_include_filter OR (included_items ? id::text))
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF selected_item IS NULL THEN
    RETURN json_build_object('dropped', false);
  END IF;

  -- Add to user inventory
  INSERT INTO user_inventory (user_id, item_id, quantity)
  VALUES (p_user_id, selected_item.id, 1)
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET quantity = user_inventory.quantity + 1, updated_at = now();

  RETURN json_build_object(
    'dropped', true,
    'item', json_build_object(
      'id', selected_item.id,
      'name', selected_item.name,
      'image_url', selected_item.image_url,
      'rarity', selected_item.rarity,
      'item_type', selected_item.item_type,
      'set_name', selected_item.set_name
    )
  );
END;
$$;

-- Function: Open a chest
CREATE OR REPLACE FUNCTION open_chest(p_user_id uuid, p_user_chest_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chest_record record;
  user_chest_record record;
  loot_entry jsonb;
  guaranteed_entry jsonb;
  total_weight integer;
  roll float;
  cumulative_weight integer;
  selected_item_id uuid;
  drop_qty integer;
  received_items jsonb := '[]'::jsonb;
  i integer;
BEGIN
  -- Verify ownership and unopened status
  SELECT uc.*, c.loot_table, c.guaranteed_items, c.items_per_open, c.name as chest_name
  INTO user_chest_record
  FROM user_chests uc
  JOIN chests c ON uc.chest_id = c.id
  WHERE uc.id = p_user_chest_id AND uc.user_id = p_user_id AND uc.opened_at IS NULL;

  IF user_chest_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Chest not found or already opened');
  END IF;

  -- Process guaranteed items
  IF user_chest_record.guaranteed_items IS NOT NULL AND jsonb_array_length(user_chest_record.guaranteed_items) > 0 THEN
    FOR guaranteed_entry IN SELECT * FROM jsonb_array_elements(user_chest_record.guaranteed_items)
    LOOP
      selected_item_id := (guaranteed_entry->>'item_id')::uuid;
      drop_qty := COALESCE((guaranteed_entry->>'quantity')::integer, 1);

      INSERT INTO user_inventory (user_id, item_id, quantity)
      VALUES (p_user_id, selected_item_id, drop_qty)
      ON CONFLICT (user_id, item_id)
      DO UPDATE SET quantity = user_inventory.quantity + drop_qty, updated_at = now();

      received_items := received_items || jsonb_build_object('item_id', selected_item_id, 'quantity', drop_qty, 'source', 'guaranteed');
    END LOOP;
  END IF;

  -- Process random loot draws
  IF user_chest_record.loot_table IS NOT NULL AND jsonb_array_length(user_chest_record.loot_table) > 0 THEN
    -- Calculate total weight
    total_weight := 0;
    FOR loot_entry IN SELECT * FROM jsonb_array_elements(user_chest_record.loot_table)
    LOOP
      total_weight := total_weight + COALESCE((loot_entry->>'weight')::integer, 1);
    END LOOP;

    -- Draw items
    FOR i IN 1..user_chest_record.items_per_open
    LOOP
      roll := random() * total_weight;
      cumulative_weight := 0;

      FOR loot_entry IN SELECT * FROM jsonb_array_elements(user_chest_record.loot_table)
      LOOP
        cumulative_weight := cumulative_weight + COALESCE((loot_entry->>'weight')::integer, 1);
        IF roll <= cumulative_weight THEN
          selected_item_id := (loot_entry->>'item_id')::uuid;
          drop_qty := COALESCE((loot_entry->>'min_qty')::integer, 1);
          IF (loot_entry->>'max_qty') IS NOT NULL THEN
            drop_qty := drop_qty + floor(random() * ((loot_entry->>'max_qty')::integer - drop_qty + 1))::integer;
          END IF;

          INSERT INTO user_inventory (user_id, item_id, quantity)
          VALUES (p_user_id, selected_item_id, drop_qty)
          ON CONFLICT (user_id, item_id)
          DO UPDATE SET quantity = user_inventory.quantity + drop_qty, updated_at = now();

          received_items := received_items || jsonb_build_object('item_id', selected_item_id, 'quantity', drop_qty, 'source', 'random');
          EXIT;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Mark chest as opened
  UPDATE user_chests
  SET opened_at = now(), items_received = received_items
  WHERE id = p_user_chest_id;

  -- Return received items with details
  RETURN json_build_object(
    'success', true,
    'chest_name', user_chest_record.chest_name,
    'items', (
      SELECT json_agg(json_build_object(
        'item_id', ri->>'item_id',
        'quantity', (ri->>'quantity')::integer,
        'source', ri->>'source',
        'name', ci.name,
        'image_url', ci.image_url,
        'rarity', ci.rarity,
        'item_type', ci.item_type
      ))
      FROM jsonb_array_elements(received_items) ri
      JOIN collectible_items ci ON ci.id = (ri->>'item_id')::uuid
    )
  );
END;
$$;

-- Function: Craft a recipe (with success rate - on failure lose 1 ingredient, common first)
CREATE OR REPLACE FUNCTION craft_recipe(p_user_id uuid, p_recipe_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipe_record record;
  ingredient jsonb;
  ingredient_item_id uuid;
  ingredient_qty integer;
  user_qty integer;
  crafts_count integer;
  result_item_name text;
  roll_result float;
  craft_success boolean;
  lost_item_record record;
  rarity_order text[] := ARRAY['common', 'uncommon', 'rare', 'epic', 'legendary'];
  r text;
  found_item boolean := false;
BEGIN
  -- Get recipe
  SELECT * INTO recipe_record
  FROM recipes
  WHERE id = p_recipe_id AND is_active = true;

  IF recipe_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Recipe not found or inactive');
  END IF;

  -- Check max crafts limit
  IF recipe_record.max_crafts_per_user IS NOT NULL THEN
    SELECT COUNT(*) INTO crafts_count
    FROM user_crafts
    WHERE user_id = p_user_id AND recipe_id = p_recipe_id;

    IF crafts_count >= recipe_record.max_crafts_per_user THEN
      RETURN json_build_object('success', false, 'error', 'Maximum crafts reached for this recipe');
    END IF;
  END IF;

  -- Verify all ingredients
  FOR ingredient IN SELECT * FROM jsonb_array_elements(recipe_record.ingredients)
  LOOP
    ingredient_item_id := (ingredient->>'item_id')::uuid;
    ingredient_qty := (ingredient->>'quantity')::integer;

    SELECT COALESCE(quantity, 0) INTO user_qty
    FROM user_inventory
    WHERE user_id = p_user_id AND item_id = ingredient_item_id;

    IF user_qty < ingredient_qty THEN
      RETURN json_build_object('success', false, 'error', 'Not enough ingredients');
    END IF;
  END LOOP;

  -- Roll for success (success_rate is 0-100, default 100)
  roll_result := random() * 100;
  craft_success := roll_result < COALESCE(recipe_record.success_rate, 100);

  IF NOT craft_success THEN
    -- FAILURE: Lose 1 item from ingredients, prioritizing common → uncommon → rare → epic → legendary
    -- Find the lowest rarity ingredient to lose
    FOREACH r IN ARRAY rarity_order
    LOOP
      IF found_item THEN EXIT; END IF;

      FOR ingredient IN SELECT * FROM jsonb_array_elements(recipe_record.ingredients)
      LOOP
        ingredient_item_id := (ingredient->>'item_id')::uuid;

        SELECT ci.* INTO lost_item_record
        FROM collectible_items ci
        WHERE ci.id = ingredient_item_id AND ci.rarity = r;

        IF lost_item_record IS NOT NULL THEN
          -- Found the lowest rarity item, deduct 1
          UPDATE user_inventory
          SET quantity = quantity - 1, updated_at = now()
          WHERE user_id = p_user_id AND item_id = ingredient_item_id;

          found_item := true;
          EXIT;
        END IF;
      END LOOP;
    END LOOP;

    -- Log failed craft attempt
    INSERT INTO user_crafts (user_id, recipe_id, result_data)
    VALUES (p_user_id, p_recipe_id, json_build_object(
      'success', false,
      'lost_item_id', lost_item_record.id,
      'lost_item_name', lost_item_record.name
    )::jsonb);

    RETURN json_build_object(
      'success', false,
      'craft_failed', true,
      'lost_item', json_build_object(
        'id', lost_item_record.id,
        'name', lost_item_record.name,
        'image_url', lost_item_record.image_url,
        'rarity', lost_item_record.rarity
      )
    );
  END IF;

  -- SUCCESS: Deduct all ingredients
  FOR ingredient IN SELECT * FROM jsonb_array_elements(recipe_record.ingredients)
  LOOP
    ingredient_item_id := (ingredient->>'item_id')::uuid;
    ingredient_qty := (ingredient->>'quantity')::integer;

    UPDATE user_inventory
    SET quantity = quantity - ingredient_qty, updated_at = now()
    WHERE user_id = p_user_id AND item_id = ingredient_item_id;
  END LOOP;

  -- Award result
  IF recipe_record.result_type = 'cosmetic' AND recipe_record.result_shop_item_id IS NOT NULL THEN
    INSERT INTO user_purchases (user_id, item_id)
    VALUES (p_user_id, recipe_record.result_shop_item_id)
    ON CONFLICT (user_id, item_id) DO NOTHING;
  ELSIF recipe_record.result_type = 'xp' AND recipe_record.result_xp > 0 THEN
    UPDATE users SET xp = xp + recipe_record.result_xp WHERE id = p_user_id;
  ELSIF recipe_record.result_type = 'gems' AND recipe_record.result_gems > 0 THEN
    UPDATE users SET gems = gems + recipe_record.result_gems WHERE id = p_user_id;
  ELSIF recipe_record.result_type = 'item' AND recipe_record.result_item_id IS NOT NULL THEN
    INSERT INTO user_inventory (user_id, item_id, quantity)
    VALUES (p_user_id, recipe_record.result_item_id, COALESCE(recipe_record.result_quantity, 1))
    ON CONFLICT (user_id, item_id)
    DO UPDATE SET quantity = user_inventory.quantity + COALESCE(recipe_record.result_quantity, 1), updated_at = now();
  END IF;

  -- Look up result item name if applicable
  IF recipe_record.result_item_id IS NOT NULL THEN
    SELECT ci.name INTO result_item_name
    FROM collectible_items ci WHERE ci.id = recipe_record.result_item_id;
  END IF;

  -- Log successful craft
  INSERT INTO user_crafts (user_id, recipe_id, result_data)
  VALUES (p_user_id, p_recipe_id, json_build_object(
    'success', true,
    'result_type', recipe_record.result_type,
    'result_xp', recipe_record.result_xp,
    'result_gems', recipe_record.result_gems,
    'result_shop_item_id', recipe_record.result_shop_item_id,
    'result_item_id', recipe_record.result_item_id
  )::jsonb);

  RETURN json_build_object(
    'success', true,
    'result_type', recipe_record.result_type,
    'result_name', recipe_record.name,
    'result_image_url', recipe_record.result_image_url,
    'result_xp', recipe_record.result_xp,
    'result_gems', recipe_record.result_gems,
    'result_item_id', recipe_record.result_item_id,
    'result_item_name', result_item_name
  );
END;
$$;

-- Function: Award a milestone chest
CREATE OR REPLACE FUNCTION award_milestone_chest(p_user_id uuid, p_milestone_type text, p_source_ref text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_record record;
  milestone_chests jsonb;
  chest_type_name text;
  chest_record record;
BEGIN
  -- Get milestone chest config
  SELECT config_value INTO config_record
  FROM drop_config
  WHERE config_key = 'milestone_chests';

  IF config_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No milestone chest config found');
  END IF;

  milestone_chests := config_record.config_value;
  chest_type_name := milestone_chests->>p_milestone_type;

  IF chest_type_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No chest configured for this milestone');
  END IF;

  -- Find an active chest of that type
  SELECT * INTO chest_record
  FROM chests
  WHERE chest_type = chest_type_name AND is_active = true
  ORDER BY random()
  LIMIT 1;

  IF chest_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No active chest found for type: ' || chest_type_name);
  END IF;

  -- Award the chest
  INSERT INTO user_chests (user_id, chest_id, source, source_ref)
  VALUES (p_user_id, chest_record.id, p_milestone_type, p_source_ref);

  RETURN json_build_object(
    'success', true,
    'chest_id', chest_record.id,
    'chest_name', chest_record.name,
    'chest_image_url', chest_record.image_url,
    'source', p_milestone_type
  );
END;
$$;

-- Function: Award chest on exercise completion (only for courses with chest_enabled = true)
CREATE OR REPLACE FUNCTION award_exercise_chest(p_user_id uuid, p_exercise_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course record;
  v_chest record;
  v_existing_chest uuid;
BEGIN
  -- Find the course for this exercise via exercise_assignments -> session -> unit -> course
  SELECT c.id AS course_id, c.chest_enabled
  INTO v_course
  FROM exercise_assignments ea
  JOIN sessions s ON s.id = ea.session_id
  JOIN units u ON u.id = s.unit_id
  JOIN courses c ON c.id = u.course_id
  WHERE ea.exercise_id = p_exercise_id
  LIMIT 1;

  IF v_course IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'exercise_not_found');
  END IF;

  -- Check if course has chest drops enabled
  IF NOT v_course.chest_enabled THEN
    RETURN json_build_object('success', false, 'reason', 'chest_not_enabled');
  END IF;

  -- Check if user already received a chest for this exercise
  SELECT id INTO v_existing_chest
  FROM user_chests
  WHERE user_id = p_user_id
    AND source = 'exercise_complete'
    AND source_ref = p_exercise_id::text;

  IF v_existing_chest IS NOT NULL THEN
    RETURN json_build_object('success', false, 'reason', 'already_awarded');
  END IF;

  -- Find an active standard chest
  SELECT * INTO v_chest
  FROM chests
  WHERE chest_type = 'standard' AND is_active = true
  ORDER BY random()
  LIMIT 1;

  IF v_chest IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'no_active_chest');
  END IF;

  -- Award the chest
  INSERT INTO user_chests (user_id, chest_id, source, source_ref)
  VALUES (p_user_id, v_chest.id, 'exercise_complete', p_exercise_id::text);

  RETURN json_build_object(
    'success', true,
    'chest_id', v_chest.id,
    'chest_name', v_chest.name,
    'chest_image_url', v_chest.image_url
  );
END;
$$;

-- Function: Award winners for a single challenge (admin trigger)
CREATE OR REPLACE FUNCTION award_single_challenge_winners(p_challenge_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_rec record;
  top1_user_id uuid;
  top2_user_id uuid;
  top3_user_id uuid;
  top1_xp integer;
  top1_gems integer;
  top2_xp integer;
  top2_gems integer;
  top3_xp integer;
  top3_gems integer;
  results json[];
BEGIN
  -- Get the challenge
  SELECT id, difficulty_level, top1_achievement_id, top2_achievement_id, top3_achievement_id, winners_awarded, is_locked
  INTO challenge_rec
  FROM daily_challenges
  WHERE id = p_challenge_id AND is_active = true;

  IF challenge_rec IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Challenge not found or inactive');
  END IF;

  IF challenge_rec.winners_awarded = true THEN
    RETURN json_build_object('success', false, 'error', 'Winners already awarded for this challenge');
  END IF;

  -- Get top 1 user
  SELECT user_id INTO top1_user_id
  FROM daily_challenge_participations
  WHERE challenge_id = challenge_rec.id AND score >= 75
  ORDER BY score DESC, time_spent ASC
  LIMIT 1;

  -- Get top 2 user (excluding top 1)
  SELECT user_id INTO top2_user_id
  FROM daily_challenge_participations
  WHERE challenge_id = challenge_rec.id
    AND score >= 75
    AND user_id != COALESCE(top1_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY score DESC, time_spent ASC
  LIMIT 1;

  -- Get top 3 user (excluding top 1 and top 2)
  SELECT user_id INTO top3_user_id
  FROM daily_challenge_participations
  WHERE challenge_id = challenge_rec.id
    AND score >= 75
    AND user_id != COALESCE(top1_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND user_id != COALESCE(top2_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY score DESC, time_spent ASC
  LIMIT 1;

  -- Award top 1
  IF top1_user_id IS NOT NULL AND challenge_rec.top1_achievement_id IS NOT NULL THEN
    -- Get achievement rewards
    SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
    INTO top1_xp, top1_gems
    FROM achievements
    WHERE id = challenge_rec.top1_achievement_id;

    -- Insert achievement record
    INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
    VALUES (top1_user_id, challenge_rec.top1_achievement_id, NOW(), NOW(), top1_xp);

    -- Award XP and gems
    UPDATE users
    SET xp = xp + top1_xp,
        gems = gems + top1_gems
    WHERE id = top1_user_id;

    results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 1, 'user_id', top1_user_id, 'xp', top1_xp, 'gems', top1_gems));
  END IF;

  -- Award top 2
  IF top2_user_id IS NOT NULL AND challenge_rec.top2_achievement_id IS NOT NULL THEN
    -- Get achievement rewards
    SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
    INTO top2_xp, top2_gems
    FROM achievements
    WHERE id = challenge_rec.top2_achievement_id;

    -- Insert achievement record
    INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
    VALUES (top2_user_id, challenge_rec.top2_achievement_id, NOW(), NOW(), top2_xp);

    -- Award XP and gems
    UPDATE users
    SET xp = xp + top2_xp,
        gems = gems + top2_gems
    WHERE id = top2_user_id;

    results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 2, 'user_id', top2_user_id, 'xp', top2_xp, 'gems', top2_gems));
  END IF;

  -- Award top 3
  IF top3_user_id IS NOT NULL AND challenge_rec.top3_achievement_id IS NOT NULL THEN
    -- Get achievement rewards
    SELECT COALESCE(xp_reward, 0), COALESCE(gem_reward, 0)
    INTO top3_xp, top3_gems
    FROM achievements
    WHERE id = challenge_rec.top3_achievement_id;

    -- Insert achievement record
    INSERT INTO user_achievements (user_id, achievement_id, earned_at, claimed_at, xp_claimed)
    VALUES (top3_user_id, challenge_rec.top3_achievement_id, NOW(), NOW(), top3_xp);

    -- Award XP and gems
    UPDATE users
    SET xp = xp + top3_xp,
        gems = gems + top3_gems
    WHERE id = top3_user_id;

    results := array_append(results, json_build_object('level', challenge_rec.difficulty_level, 'rank', 3, 'user_id', top3_user_id, 'xp', top3_xp, 'gems', top3_gems));
  END IF;

  -- Mark challenge as awarded AND locked
  UPDATE daily_challenges
  SET winners_awarded = true,
      is_locked = true
  WHERE id = p_challenge_id;

  RETURN json_build_object('success', true, 'awarded', results);
END;
$$;