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