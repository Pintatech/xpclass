-- Migration: Extract equipment columns from users into user_equipment table
-- This reduces the users table from 30 to ~21 columns

-- 1. Create user_equipment table (1:1 with users)
CREATE TABLE IF NOT EXISTS public.user_equipment (
  user_id uuid NOT NULL,
  active_title text,
  active_frame_ratio text,
  hide_frame boolean DEFAULT false,
  active_background_url text,
  active_bowl_url text,
  active_spaceship_url text,
  active_spaceship_laser text,
  active_hammer_url text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_equipment_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_equipment_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- 2. Migrate existing data
INSERT INTO public.user_equipment (
  user_id, active_title, active_frame_ratio, hide_frame,
  active_background_url, active_bowl_url,
  active_spaceship_url, active_spaceship_laser, active_hammer_url
)
SELECT
  id, active_title, active_frame_ratio, COALESCE(hide_frame, false),
  active_background_url, active_bowl_url,
  active_spaceship_url, active_spaceship_laser, active_hammer_url
FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 3. Drop columns from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS active_title;
ALTER TABLE public.users DROP COLUMN IF EXISTS active_frame_ratio;
ALTER TABLE public.users DROP COLUMN IF EXISTS hide_frame;
ALTER TABLE public.users DROP COLUMN IF EXISTS active_background_url;
ALTER TABLE public.users DROP COLUMN IF EXISTS active_bowl_url;
ALTER TABLE public.users DROP COLUMN IF EXISTS active_spaceship_url;
ALTER TABLE public.users DROP COLUMN IF EXISTS active_spaceship_laser;
ALTER TABLE public.users DROP COLUMN IF EXISTS active_hammer_url;

-- 4. Enable RLS
ALTER TABLE public.user_equipment ENABLE ROW LEVEL SECURITY;

-- Users can read any equipment (for leaderboards, profiles, etc.)
CREATE POLICY "Anyone can view user equipment"
  ON public.user_equipment FOR SELECT
  USING (true);

-- Users can only update their own equipment
CREATE POLICY "Users can update own equipment"
  ON public.user_equipment FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own equipment row
CREATE POLICY "Users can insert own equipment"
  ON public.user_equipment FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Auto-create equipment row for new users
CREATE OR REPLACE FUNCTION public.create_user_equipment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_equipment (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_equipment ON public.users;
CREATE TRIGGER on_user_created_equipment
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_equipment();

-- 6. Update the daily challenge leaderboard RPC to join user_equipment
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
    ue.active_frame_ratio,
    dcp.score,
    dcp.time_spent,
    dcp.attempts,
    u.xp,
    u.level
  FROM daily_challenge_participations dcp
  JOIN users u ON u.id = dcp.user_id
  LEFT JOIN user_equipment ue ON ue.user_id = u.id
  WHERE dcp.challenge_id = p_challenge_id
  ORDER BY dcp.score DESC, dcp.time_spent ASC
  LIMIT p_limit;
END;
$$;

-- 7. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_equipment_user_id ON public.user_equipment(user_id);
