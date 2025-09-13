-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  current_level integer default 1,
  xp integer default 0,
  streak_count integer default 0,
  last_activity_date date,
  total_practice_time integer default 0, -- in minutes
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- LEVELS table - Main learning levels (Beginner, Intermediate, Advanced, etc.)
create table public.levels (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  level_number integer not null unique, -- 1, 2, 3, etc.
  difficulty_label text not null, -- 'Beginner', 'Intermediate', 'Advanced'
  color_theme text default 'blue', -- for UI theming
  unlock_requirement integer default 0, -- XP required to unlock
  is_active boolean default true,
  thumbnail_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- UNITS table - Learning units within each level
create table public.units (
  id uuid default uuid_generate_v4() primary key,
  level_id uuid references public.levels(id) on delete cascade,
  title text not null,
  description text,
  unit_number integer not null, -- 1, 2, 3 within the level
  color_theme text default 'blue',
  unlock_requirement integer default 0, -- XP or previous unit completion
  is_active boolean default true,
  thumbnail_url text,
  estimated_duration integer, -- in minutes for entire unit
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(level_id, unit_number)
);

-- SESSIONS table - Individual learning sessions within units
create table public.sessions (
  id uuid default uuid_generate_v4() primary key,
  unit_id uuid references public.units(id) on delete cascade,
  title text not null,
  description text,
  session_number integer not null, -- 1, 2, 3 within the unit
  session_type text default 'mixed' check (session_type in ('vocabulary', 'grammar', 'pronunciation', 'listening', 'mixed')),
  difficulty_level integer default 1 check (difficulty_level between 1 and 5),
  xp_reward integer default 50,
  unlock_requirement text, -- JSON string for complex unlock requirements
  is_active boolean default true,
  thumbnail_url text,
  estimated_duration integer, -- in minutes
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(unit_id, session_number)
);

-- EXERCISES table - Individual exercises within sessions
create table public.exercises (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.sessions(id) on delete cascade,
  title text not null,
  exercise_type text not null check (exercise_type in ('flashcard', 'pronunciation', 'audio_flashcard', 'video', 'quiz', 'listening', 'speaking')),
  content jsonb not null, -- exercise-specific content
  image_url text, -- optional image for the exercise
  difficulty_level integer default 1 check (difficulty_level between 1 and 5),
  xp_reward integer default 10,
  order_index integer not null,
  is_active boolean default true,
  estimated_duration integer, -- in minutes
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(session_id, order_index)
);

-- USER PROGRESS table - Track progress across all levels
create table public.user_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  level_id uuid references public.levels(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade,
  status text default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'locked')),
  score integer,
  max_score integer,
  attempts integer default 0,
  time_spent integer default 0, -- in seconds
  first_attempt_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, exercise_id)
);

-- LEVEL PROGRESS table - Track overall level completion
create table public.level_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  level_id uuid references public.levels(id) on delete cascade,
  status text default 'locked' check (status in ('locked', 'available', 'in_progress', 'completed')),
  progress_percentage integer default 0 check (progress_percentage between 0 and 100),
  units_completed integer default 0,
  total_units integer default 0,
  xp_earned integer default 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, level_id)
);

-- UNIT PROGRESS table - Track unit completion
create table public.unit_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  status text default 'locked' check (status in ('locked', 'available', 'in_progress', 'completed')),
  progress_percentage integer default 0 check (progress_percentage between 0 and 100),
  sessions_completed integer default 0,
  total_sessions integer default 0,
  xp_earned integer default 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, unit_id)
);

-- SESSION PROGRESS table - Track session completion
create table public.session_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  status text default 'locked' check (status in ('locked', 'available', 'in_progress', 'completed')),
  progress_percentage integer default 0 check (progress_percentage between 0 and 100),
  exercises_completed integer default 0,
  total_exercises integer default 0,
  xp_earned integer default 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, session_id)
);


-- Achievements table (unchanged)
create table public.achievements (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  icon text,
  criteria jsonb not null, -- achievement criteria
  xp_reward integer default 0,
  badge_color text default 'blue',
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- User Achievements table (unchanged)
create table public.user_achievements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  achievement_id uuid references public.achievements(id) on delete cascade,
  earned_at timestamp with time zone default now(),
  unique(user_id, achievement_id)
);

-- Game Sessions table (unchanged)
create table public.game_sessions (
  id uuid default uuid_generate_v4() primary key,
  exercise_id uuid references public.exercises(id) on delete cascade,
  player1_id uuid references public.users(id) on delete cascade,
  player2_id uuid references public.users(id) on delete cascade,
  status text default 'waiting' check (status in ('waiting', 'active', 'completed', 'cancelled')),
  current_turn uuid references public.users(id),
  game_data jsonb, -- game-specific data
  winner_id uuid references public.users(id),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.levels enable row level security;
alter table public.units enable row level security;
alter table public.sessions enable row level security;
alter table public.exercises enable row level security;
alter table public.user_progress enable row level security;
alter table public.level_progress enable row level security;
alter table public.unit_progress enable row level security;
alter table public.session_progress enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.game_sessions enable row level security;

-- RLS Policies
-- Users can read their own data
create policy "Users can read own data" on public.users for select using (auth.uid() = id);
create policy "Admins can read all users" on public.users for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Content is readable by all authenticated users
create policy "Content readable by authenticated users" on public.levels for select using (auth.role() = 'authenticated');
create policy "Content readable by authenticated users" on public.units for select using (auth.role() = 'authenticated');  
create policy "Content readable by authenticated users" on public.sessions for select using (auth.role() = 'authenticated');
create policy "Content readable by authenticated users" on public.exercises for select using (auth.role() = 'authenticated');

-- Progress - users can manage their own progress
create policy "Users manage own progress" on public.user_progress for all using (auth.uid() = user_id);
create policy "Users manage own level progress" on public.level_progress for all using (auth.uid() = user_id);
create policy "Users manage own unit progress" on public.unit_progress for all using (auth.uid() = user_id);
create policy "Users manage own session progress" on public.session_progress for all using (auth.uid() = user_id);


-- Functions and Triggers
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_users_updated_at before update on public.users for each row execute procedure public.update_updated_at_column();
create trigger update_levels_updated_at before update on public.levels for each row execute procedure public.update_updated_at_column();
create trigger update_units_updated_at before update on public.units for each row execute procedure public.update_updated_at_column();
create trigger update_sessions_updated_at before update on public.sessions for each row execute procedure public.update_updated_at_column();
create trigger update_exercises_updated_at before update on public.exercises for each row execute procedure public.update_updated_at_column();
create trigger update_user_progress_updated_at before update on public.user_progress for each row execute procedure public.update_updated_at_column();
create trigger update_level_progress_updated_at before update on public.level_progress for each row execute procedure public.update_updated_at_column();
create trigger update_unit_progress_updated_at before update on public.unit_progress for each row execute procedure public.update_updated_at_column();
create trigger update_session_progress_updated_at before update on public.session_progress for each row execute procedure public.update_updated_at_column();

-- Sample data for testing
INSERT INTO public.levels (id, title, description, level_number, difficulty_label, color_theme, unlock_requirement) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Cơ bản', 'Học các từ vựng và cấu trúc cơ bản', 1, 'Beginner', 'green', 0),
('550e8400-e29b-41d4-a716-446655440002', 'Trung cấp', 'Phát triển kỹ năng giao tiếp', 2, 'Intermediate', 'blue', 500),
('550e8400-e29b-41d4-a716-446655440003', 'Nâng cao', 'Hoàn thiện kỹ năng ngôn ngữ', 3, 'Advanced', 'purple', 1500);

INSERT INTO public.units (id, level_id, title, description, unit_number, color_theme) VALUES
('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'Giới thiệu bản thân', 'Học cách chào hỏi và giới thiệu', 1, 'green'),
('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'Gia đình', 'Từ vựng về gia đình và quan hệ', 2, 'green'),
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002', 'Mua sắm', 'Giao tiếp khi mua sắm', 1, 'blue'),
('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440002', 'Du lịch', 'Từ vựng và cụm từ du lịch', 2, 'blue');

INSERT INTO public.sessions (id, unit_id, title, description, session_number, session_type, xp_reward) VALUES
('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440011', 'Chào hỏi cơ bản', 'Học cách chào hỏi trong các tình huống khác nhau', 1, 'vocabulary', 50),
('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440011', 'Nói về tuổi và quê quán', 'Học cách nói về thông tin cá nhân', 2, 'mixed', 60),
('550e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440012', 'Thành viên gia đình', 'Từ vựng về các thành viên trong gia đình', 1, 'vocabulary', 50);

INSERT INTO public.exercises (id, session_id, title, exercise_type, content, difficulty_level, xp_reward, order_index) VALUES
('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440021', 'Flashcard chào hỏi', 'flashcard', '{"cards": [{"front": "Hello", "back": "Xin chào", "pronunciation": "/həˈloʊ/"}, {"front": "Good morning", "back": "Chào buổi sáng", "pronunciation": "/ɡʊd ˈmɔːrnɪŋ/"}]}', 1, 10, 1),
('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440021', 'Luyện phát âm chào hỏi', 'pronunciation', '{"words": [{"text": "Hello", "pronunciation": "/həˈloʊ/"}, {"text": "Hi", "pronunciation": "/haɪ/"}]}', 2, 15, 2),
('550e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440022', 'Flashcard Tuổi tác 2', 'flashcard', '{"cards": [{"front": "How old are you?", "back": "Bạn bao nhiêu tuổi?", "pronunciation": "/haʊ oʊld ɑːr juː/", "example": "How old are you? I am 25 years old."}]}', 2, 20, 1);
