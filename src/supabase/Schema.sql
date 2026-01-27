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