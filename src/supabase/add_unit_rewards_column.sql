-- Create dedicated table for unit reward claims
-- This is better than JSONB for scalability, analytics, and data integrity

CREATE TABLE IF NOT EXISTS unit_reward_claims (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  full_name TEXT,
  xp_awarded INT NOT NULL CHECK (xp_awarded >= 5 AND xp_awarded <= 20),
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, unit_id)
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_unit_reward_claims_user_id ON unit_reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_unit_reward_claims_unit_id ON unit_reward_claims(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_reward_claims_claimed_at ON unit_reward_claims(claimed_at);

-- Add comment for documentation
COMMENT ON TABLE unit_reward_claims IS 'Tracks unit completion reward claims with XP awarded and timestamp';

-- Enable Row Level Security
ALTER TABLE unit_reward_claims ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own claims
CREATE POLICY "Users can view own reward claims" ON unit_reward_claims
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own claims
CREATE POLICY "Users can insert own reward claims" ON unit_reward_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all claims
CREATE POLICY "Admins can view all reward claims" ON unit_reward_claims
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Clean up: Remove old JSONB column from users table if it exists
-- Run this AFTER migrating any existing data
-- ALTER TABLE users DROP COLUMN IF EXISTS unit_rewards_claimed;
