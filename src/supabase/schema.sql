-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  level integer default 1,
  xp integer default 0,
  streak_count integer default 0,
  last_activity_date date,
  total_practice_time integer default 0, -- in minutes
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Levels table
create table public.levels (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  level_number integer not null,
  difficulty_label text not null,
  color_theme text default 'blue',
  unlock_requirement integer default 0, -- XP required to unlock
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Units table
create table public.units (
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

-- Sessions table
create table public.sessions (
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

-- Exercises table
create table public.exercises (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.sessions(id) on delete cascade,
  title text not null,
  exercise_type text not null check (exercise_type in ('flashcard', 'pronunciation', 'audio_flashcard', 'video')),
  content jsonb not null, -- exercise-specific content
  image_url text, -- optional image for the exercise
  difficulty_level integer default 1 check (difficulty_level between 1 and 5),
  xp_reward integer default 10,
  order_index integer not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- User Progress table
create table public.user_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade,
  status text default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  score integer,
  max_score integer,
  attempts integer default 0,
  time_spent integer default 0, -- in seconds
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, exercise_id)
);


-- Achievements table
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

-- User Achievements table
create table public.user_achievements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  achievement_id uuid references public.achievements(id) on delete cascade,
  earned_at timestamp with time zone default now(),
  unique(user_id, achievement_id)
);

-- Game Sessions table (for two-player games)
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
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.game_sessions enable row level security;

-- RLS Policies
-- Users can read their own data and admins can read all
create policy "Users can read own data" on public.users for select using (auth.uid() = id);
create policy "Admins can read all users" on public.users for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Levels are readable by all authenticated users
create policy "Levels are readable by authenticated users" on public.levels for select using (auth.role() = 'authenticated');

-- Units are readable by all authenticated users
create policy "Units are readable by authenticated users" on public.units for select using (auth.role() = 'authenticated');

-- Sessions are readable by all authenticated users
create policy "Sessions are readable by authenticated users" on public.sessions for select using (auth.role() = 'authenticated');

-- Exercises are readable by all authenticated users
create policy "Exercises are readable by authenticated users" on public.exercises for select using (auth.role() = 'authenticated');

-- User progress - users can manage their own progress
create policy "Users can manage own progress" on public.user_progress for all using (auth.uid() = user_id);


-- Functions and Triggers
-- Update updated_at timestamp
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
