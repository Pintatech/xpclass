-- Add avatar system with XP-based unlocks

-- Create avatars table
CREATE TABLE public.avatars (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  image_url text not null,
  unlock_xp integer default 0, -- XP required to unlock this avatar
  category text default 'basic' check (category in ('basic', 'bronze', 'silver', 'gold', 'platinum', 'special')),
  description text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- Enable RLS
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- Avatars are readable by all authenticated users
CREATE POLICY "Avatars are readable by authenticated users" ON public.avatars FOR SELECT USING (auth.role() = 'authenticated');

-- Insert default avatars with XP requirements
INSERT INTO public.avatars (name, image_url, unlock_xp, category, description) VALUES
-- Basic avatars (0 XP - available to everyone)
('Default Avatar', '👤', 0, 'basic', 'The default avatar for new learners'),
('Student', '🧑‍🎓', 0, 'basic', 'A dedicated student avatar'),
('Book Lover', '📚', 0, 'basic', 'For those who love learning'),

-- Bronze tier (100-500 XP)
('Star Student', '⭐', 100, 'bronze', 'Unlock at 100 XP'),
('Fire Learner', '🔥', 200, 'bronze', 'For students on fire with learning'),
('Trophy Winner', '🏆', 300, 'bronze', 'Achievement unlocked at 300 XP'),
('Rocket Learner', '🚀', 400, 'bronze', 'Sky-high progress at 400 XP'),
('Diamond Mind', '💎', 500, 'bronze', 'Precious knowledge at 500 XP'),

-- Silver tier (600-1200 XP)
('Crown Scholar', '👑', 600, 'silver', 'Royal learner at 600 XP'),
('Lightning Fast', '⚡', 800, 'silver', 'Quick learner at 800 XP'),
('Magical Mind', '🧙‍♂️', 1000, 'silver', 'Wizardry in learning at 1000 XP'),
('Superhero', '🦸‍♀️', 1200, 'silver', 'Learning superhero at 1200 XP'),

-- Gold tier (1500-3000 XP)
('Golden Eagle', '🦅', 1500, 'gold', 'Soar high at 1500 XP'),
('Dragon Master', '🐉', 2000, 'gold', 'Master of knowledge at 2000 XP'),
('Phoenix Rising', '🔥🦅', 2500, 'gold', 'Rise from challenges at 2500 XP'),
('Galaxy Explorer', '🌟', 3000, 'gold', 'Explore the universe of knowledge'),

-- Platinum tier (4000+ XP)
('Platinum Master', '💫', 4000, 'platinum', 'Elite learner status'),
('Legendary Scholar', '🏛️', 5000, 'platinum', 'Legendary dedication to learning'),
('Infinity Learner', '♾️', 6000, 'platinum', 'Boundless knowledge seeker'),

-- Special achievements
('Language Ninja', '🥷', 1000, 'special', 'Master of multiple skills'),
('Time Traveler', '⏰', 1500, 'special', 'Consistent daily learner'),
('Knowledge Vault', '🔐', 2000, 'special', 'Keeper of vast knowledge');