-- =================================================================
-- Supabase Database Setup Script for Language Learning App
-- =================================================================
-- This script creates the complete database schema for your language learning platform
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================
-- CORE TABLES
-- =================================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  current_level integer DEFAULT 1,
  xp integer DEFAULT 0,
  streak_count integer DEFAULT 0,
  last_activity_date date,
  total_practice_time integer DEFAULT 0, -- in minutes
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- LEVELS table - Main learning levels (Beginner, Intermediate, Advanced, etc.)
CREATE TABLE public.levels (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  description text,
  level_number integer NOT NULL UNIQUE, -- 1, 2, 3, etc.
  difficulty_label text NOT NULL, -- 'Beginner', 'Intermediate', 'Advanced'
  color_theme text DEFAULT 'blue', -- for UI theming
  unlock_requirement integer DEFAULT 0, -- XP required to unlock
  is_active boolean DEFAULT true,
  thumbnail_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- UNITS table - Learning units within each level
CREATE TABLE public.units (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  level_id uuid REFERENCES public.levels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  unit_number integer NOT NULL, -- 1, 2, 3 within the level
  color_theme text DEFAULT 'blue',
  unlock_requirement integer DEFAULT 0, -- XP or previous unit completion
  is_active boolean DEFAULT true,
  thumbnail_url text,
  estimated_duration integer, -- in minutes for entire unit
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(level_id, unit_number)
);

-- SESSIONS table - Individual learning sessions within units
CREATE TABLE public.sessions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  session_number integer NOT NULL, -- 1, 2, 3 within the unit
  session_type text DEFAULT 'mixed' CHECK (session_type IN ('vocabulary', 'grammar', 'pronunciation', 'listening', 'mixed')),
  difficulty_level integer DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  xp_reward integer DEFAULT 50,
  unlock_requirement text, -- JSON string for complex unlock requirements
  is_active boolean DEFAULT true,
  thumbnail_url text,
  estimated_duration integer, -- in minutes
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(unit_id, session_number)
);

-- EXERCISES table - Individual exercises within sessions
CREATE TABLE public.exercises (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  exercise_type text NOT NULL CHECK (exercise_type IN ('flashcard', 'pronunciation', 'audio_flashcard', 'video', 'quiz', 'multiple_choice', 'listening', 'speaking')),
  content jsonb NOT NULL, -- exercise-specific content
  image_urls text[], -- optional images for the exercise
  difficulty_level integer DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  xp_reward integer DEFAULT 10,
  order_index integer NOT NULL,
  is_active boolean DEFAULT true,
  estimated_duration integer, -- in minutes
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(session_id, order_index)
);

-- =================================================================
-- PROGRESS TRACKING TABLES
-- =================================================================

-- USER PROGRESS table - Track progress across all exercises
CREATE TABLE public.user_progress (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  level_id uuid REFERENCES public.levels(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'locked')),
  score integer,
  max_score integer,
  attempts integer DEFAULT 0,
  time_spent integer DEFAULT 0, -- in seconds
  first_attempt_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

-- LEVEL PROGRESS table - Track overall level completion
CREATE TABLE public.level_progress (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  level_id uuid REFERENCES public.levels(id) ON DELETE CASCADE,
  status text DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  units_completed integer DEFAULT 0,
  total_units integer DEFAULT 0,
  xp_earned integer DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, level_id)
);

-- UNIT PROGRESS table - Track unit completion
CREATE TABLE public.unit_progress (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  status text DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  sessions_completed integer DEFAULT 0,
  total_sessions integer DEFAULT 0,
  xp_earned integer DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, unit_id)
);

-- SESSION PROGRESS table - Track session completion
CREATE TABLE public.session_progress (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  status text DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  exercises_completed integer DEFAULT 0,
  total_exercises integer DEFAULT 0,
  xp_earned integer DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, session_id)
);

-- QUESTION ATTEMPTS table - Track individual question attempts for retry functionality
CREATE TABLE public.question_attempts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE,
  question_id text NOT NULL, -- identifier for specific question within exercise
  selected_answer text,
  correct_answer text,
  is_correct boolean NOT NULL,
  attempt_number integer DEFAULT 1,
  response_time integer, -- in milliseconds
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- =================================================================
-- GAMIFICATION TABLES
-- =================================================================

-- ACHIEVEMENTS table
CREATE TABLE public.achievements (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  description text,
  icon text,
  criteria jsonb NOT NULL, -- achievement criteria
  xp_reward integer DEFAULT 0,
  badge_color text DEFAULT 'blue',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- USER ACHIEVEMENTS table
CREATE TABLE public.user_achievements (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id uuid REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- GAME SESSIONS table for multiplayer features
CREATE TABLE public.game_sessions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE,
  player1_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  player2_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'cancelled')),
  current_turn uuid REFERENCES public.users(id),
  game_data jsonb, -- game-specific data
  winner_id uuid REFERENCES public.users(id),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- =================================================================
-- ROW LEVEL SECURITY (RLS)
-- =================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- RLS POLICIES
-- =================================================================

-- Users can read their own data
CREATE POLICY "Users can read own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all users" ON public.users FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
-- Admins can manage all users
CREATE POLICY "Admins can manage all users" ON public.users FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Content is readable by all authenticated users
CREATE POLICY "Content readable by authenticated users" ON public.levels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Content readable by authenticated users" ON public.units FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Content readable by authenticated users" ON public.sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Content readable by authenticated users" ON public.exercises FOR SELECT USING (auth.role() = 'authenticated');

-- Achievements readable by all authenticated users
CREATE POLICY "Achievements readable by authenticated users" ON public.achievements FOR SELECT USING (auth.role() = 'authenticated');

-- Progress - users can manage their own progress
CREATE POLICY "Users manage own progress" ON public.user_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own level progress" ON public.level_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own unit progress" ON public.unit_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own session progress" ON public.session_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own question attempts" ON public.question_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own achievements" ON public.user_achievements FOR ALL USING (auth.uid() = user_id);

-- Game sessions - users can participate in their own games
CREATE POLICY "Users can access their game sessions" ON public.game_sessions FOR ALL USING (
  auth.uid() = player1_id OR auth.uid() = player2_id
);

-- =================================================================
-- FUNCTIONS AND TRIGGERS
-- =================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_levels_updated_at BEFORE UPDATE ON public.levels FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON public.user_progress FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_level_progress_updated_at BEFORE UPDATE ON public.level_progress FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_unit_progress_updated_at BEFORE UPDATE ON public.unit_progress FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_session_progress_updated_at BEFORE UPDATE ON public.session_progress FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_question_attempts_updated_at BEFORE UPDATE ON public.question_attempts FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- =================================================================
-- SAMPLE DATA
-- =================================================================

-- Insert sample levels
INSERT INTO public.levels (id, title, description, level_number, difficulty_label, color_theme, unlock_requirement) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Cơ bản', 'Học các từ vựng và cấu trúc cơ bản nhất để bắt đầu giao tiếp', 1, 'Beginner', 'green', 0),
('550e8400-e29b-41d4-a716-446655440002', 'Trung cấp', 'Phát triển kỹ năng giao tiếp và hiểu biết sâu hơn', 2, 'Intermediate', 'blue', 500),
('550e8400-e29b-41d4-a716-446655440003', 'Nâng cao', 'Hoàn thiện kỹ năng ngôn ngữ và giao tiếp phức tạp', 3, 'Advanced', 'purple', 1500);

-- Insert sample units for Level 1 (Cơ bản)
INSERT INTO public.units (id, level_id, title, description, unit_number, color_theme, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'Giới thiệu bản thân', 'Học cách chào hỏi và giới thiệu về bản thân', 1, 'green', 45),
('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'Gia đình', 'Từ vựng về gia đình và mối quan hệ', 2, 'green', 60),
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'Số đếm và thời gian', 'Học cách đếm số và nói về thời gian', 3, 'green', 50);

-- Insert sample units for Level 2 (Trung cấp)
INSERT INTO public.units (id, level_id, title, description, unit_number, color_theme, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440002', 'Mua sắm', 'Giao tiếp khi mua sắm và hỏi giá cả', 1, 'blue', 75),
('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440002', 'Du lịch', 'Từ vựng và cụm từ khi đi du lịch', 2, 'blue', 90),
('550e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440002', 'Ăn uống', 'Gọi món và nói về đồ ăn', 3, 'blue', 80);

-- Insert sample sessions for Unit 1.1 (Giới thiệu bản thân)
INSERT INTO public.sessions (id, unit_id, title, description, session_number, session_type, difficulty_level, xp_reward, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440011', 'Chào hỏi cơ bản', 'Học cách chào hỏi trong các tình huống khác nhau', 1, 'vocabulary', 1, 50, 15),
('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440011', 'Nói về tuổi và quê quán', 'Học cách nói về thông tin cá nhân cơ bản', 2, 'mixed', 2, 60, 20),
('550e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440011', 'Nghề nghiệp', 'Từ vựng về các nghề nghiệp phổ biến', 3, 'vocabulary', 2, 55, 18);

-- Insert sample sessions for Unit 1.2 (Gia đình)
INSERT INTO public.sessions (id, unit_id, title, description, session_number, session_type, difficulty_level, xp_reward, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440012', 'Thành viên gia đình', 'Từ vựng về các thành viên trong gia đình', 1, 'vocabulary', 1, 50, 15),
('550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440012', 'Miêu tả ngoại hình', 'Học cách miêu tả ngoại hình của người khác', 2, 'mixed', 2, 65, 25),
('550e8400-e29b-41d4-a716-446655440043', '550e8400-e29b-41d4-a716-446655440012', 'Hoạt động gia đình', 'Nói về các hoạt động cùng gia đình', 3, 'listening', 3, 70, 22);

-- Insert sample exercises for Session 1.1.1 (Chào hỏi cơ bản)
INSERT INTO public.exercises (id, session_id, title, exercise_type, content, difficulty_level, xp_reward, order_index, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440061', '550e8400-e29b-41d4-a716-446655440031', 'Flashcard Chào hỏi', 'flashcard',
'{"cards": [
  {"front": "Hello", "back": "Xin chào", "pronunciation": "/həˈloʊ/", "example": "Hello, how are you?"},
  {"front": "Good morning", "back": "Chào buổi sáng", "pronunciation": "/ɡʊd ˈmɔːrnɪŋ/", "example": "Good morning, teacher!"},
  {"front": "Good afternoon", "back": "Chào buổi chiều", "pronunciation": "/ɡʊd ˌæftərˈnuːn/", "example": "Good afternoon, everyone!"},
  {"front": "Good evening", "back": "Chào buổi tối", "pronunciation": "/ɡʊd ˈiːvnɪŋ/", "example": "Good evening, sir!"},
  {"front": "Goodbye", "back": "Tạm biệt", "pronunciation": "/ɡʊdˈbaɪ/", "example": "Goodbye, see you tomorrow!"}
]}', 1, 10, 1, 5),

('550e8400-e29b-41d4-a716-446655440062', '550e8400-e29b-41d4-a716-446655440031', 'Luyện phát âm chào hỏi', 'pronunciation',
'{"words": [
  {"text": "Hello", "pronunciation": "/həˈloʊ/", "audio_url": null},
  {"text": "Hi", "pronunciation": "/haɪ/", "audio_url": null},
  {"text": "Good morning", "pronunciation": "/ɡʊd ˈmɔːrnɪŋ/", "audio_url": null},
  {"text": "How are you?", "pronunciation": "/haʊ ɑːr juː/", "audio_url": null}
]}', 2, 15, 2, 8),

('550e8400-e29b-41d4-a716-446655440063', '550e8400-e29b-41d4-a716-446655440031', 'Trắc nghiệm chào hỏi', 'multiple_choice',
'{"questions": [
  {"id": "q1", "question": "What does \"Hello\" mean in Vietnamese?", "options": ["Xin chào", "Tạm biệt", "Cảm ơn", "Xin lỗi"], "correct_answer": 0, "explanation": "Hello means Xin chào in Vietnamese. It is the most common greeting used in both formal and informal situations."},
  {"id": "q2", "question": "How do you say \"Good morning\" in Vietnamese?", "options": ["Chào buổi tối", "Chào buổi chiều", "Chào buổi sáng", "Tạm biệt"], "correct_answer": 2, "explanation": "Good morning is Chào buổi sáng in Vietnamese. Buổi sáng specifically means morning time."}
]}', 1, 15, 3, 10);

-- Insert sample achievements
INSERT INTO public.achievements (id, title, description, icon, criteria, xp_reward, badge_color) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'First Steps', 'Hoàn thành exercise đầu tiên', '🎯', '{"type": "exercise_completed", "count": 1}', 50, 'green'),
('660e8400-e29b-41d4-a716-446655440002', 'Learning Streak', 'Học 3 ngày liên tiếp', '🔥', '{"type": "daily_streak", "count": 3}', 100, 'orange'),
('660e8400-e29b-41d4-a716-446655440003', 'Pronunciation Master', 'Hoàn thành 10 bài phát âm', '🎤', '{"type": "pronunciation_completed", "count": 10}', 200, 'red'),
('660e8400-e29b-41d4-a716-446655440004', 'Vocabulary Builder', 'Học 50 từ vựng mới', '📚', '{"type": "vocabulary_learned", "count": 50}', 150, 'blue'),
('660e8400-e29b-41d4-a716-446655440005', 'Level Complete', 'Hoàn thành một level', '🏆', '{"type": "level_completed", "count": 1}', 500, 'gold');

-- =================================================================
-- SCRIPT COMPLETE
-- =================================================================
-- This script creates a complete database schema for your language learning app.
-- It includes all tables, relationships, security policies, triggers, and sample data.
-- After running this script, your Supabase database will be ready for your application.