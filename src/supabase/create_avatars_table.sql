-- Create Avatars Table for XP-based Avatar Selection
-- This table stores avatars that users can unlock based on their XP

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.avatars;

-- Create avatars table
CREATE TABLE public.avatars (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL, -- "Default", "Rookie", "Scholar", etc.
  image_url text NOT NULL, -- URL to avatar image
  unlock_xp integer NOT NULL DEFAULT 0, -- XP required to unlock this avatar
  description text, -- Description of the avatar
  tier text NOT NULL CHECK (tier IN ('default', 'bronze', 'silver', 'gold', 'platinum', 'diamond')),
  
  -- Metadata
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false, -- Only one default avatar
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- Create policy for reading avatars (all authenticated users can read)
CREATE POLICY "Avatars readable by authenticated users"
ON public.avatars FOR SELECT
USING (auth.role() = 'authenticated');

-- Create policy for managing avatars (only admins can modify)
CREATE POLICY "Avatars manageable by admins"
ON public.avatars FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_avatars_updated_at
BEFORE UPDATE ON public.avatars
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Insert default avatars with XP requirements
INSERT INTO public.avatars (
  name,
  image_url,
  unlock_xp,
  description,
  tier,
  is_default
) VALUES
-- Default avatars (unlocked from start)
('Default', '👤', 0, 'Default avatar for new users', 'default', true),
('Smiley', '😊', 0, 'Happy face avatar', 'default', false),
('Student', '🎓', 0, 'Student cap avatar', 'default', false),

-- Bronze tier avatars (0-1999 XP)
('Rookie', '🌱', 500, 'Rookie learner avatar', 'bronze', false),
('Bookworm', '📚', 1000, 'Book lover avatar', 'bronze', false),
('Star', '⭐', 1500, 'Rising star avatar', 'bronze', false),

-- Silver tier avatars (2000-7999 XP)
('Scholar', '🎓', 2000, 'Academic scholar avatar', 'silver', false),
('Achiever', '🏆', 3500, 'Achievement unlocked avatar', 'silver', false),
('Advanced', '💪', 5500, 'Advanced learner avatar', 'silver', false),

-- Gold tier avatars (8000-21999 XP)
('Expert', '⚡', 8000, 'Expert level avatar', 'gold', false),
('Master', '👑', 11500, 'Master level avatar', 'gold', false),
('Legend', '🌟', 16000, 'Legendary learner avatar', 'gold', false),

-- Platinum tier avatars (22000-54999 XP)
('Elite', '💎', 22000, 'Elite learner avatar', 'platinum', false),
('Champion', '🏅', 30000, 'Champion avatar', 'platinum', false),
('Grandmaster', '⚔️', 40000, 'Grandmaster avatar', 'platinum', false),

-- Diamond tier avatars (55000+ XP)
('Sage', '🧙‍♂️', 55000, 'Wise sage avatar', 'diamond', false),
('Immortal', '✨', 75000, 'Immortal learner avatar', 'diamond', false),
('Transcendent', '🔮', 100000, 'Transcendent avatar', 'diamond', false);

-- Create index for performance
CREATE INDEX idx_avatars_unlock_xp ON public.avatars(unlock_xp);
CREATE INDEX idx_avatars_tier ON public.avatars(tier);
CREATE INDEX idx_avatars_is_active ON public.avatars(is_active);

-- Grant permissions
GRANT SELECT ON public.avatars TO authenticated;

-- Create function to get available avatars for user based on XP
CREATE OR REPLACE FUNCTION get_available_avatars(user_xp integer)
RETURNS TABLE(
  avatar_data json
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT row_to_json(av.*) as avatar_data
  FROM public.avatars av
  WHERE av.unlock_xp <= user_xp
    AND av.is_active = true
  ORDER BY av.unlock_xp ASC, av.name ASC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_available_avatars(integer) TO authenticated;

-- Verify data
DO $$
DECLARE
  avatar_count integer;
BEGIN
  SELECT COUNT(*) INTO avatar_count FROM public.avatars;
  RAISE NOTICE 'Avatars table created successfully! Inserted % avatars.', avatar_count;
END;
$$;
