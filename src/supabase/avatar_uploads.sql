-- Avatar uploads table for user-submitted avatars with admin approval
CREATE TABLE IF NOT EXISTS avatar_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id)
);

-- Index for quick lookups
CREATE INDEX idx_avatar_uploads_user_id ON avatar_uploads(user_id);
CREATE INDEX idx_avatar_uploads_status ON avatar_uploads(status);

-- RLS policies
ALTER TABLE avatar_uploads ENABLE ROW LEVEL SECURITY;

-- Users can view their own uploads
CREATE POLICY "Users can view own avatar uploads"
  ON avatar_uploads FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all uploads
CREATE POLICY "Admins can view all avatar uploads"
  ON avatar_uploads FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can insert their own uploads
CREATE POLICY "Users can upload avatars"
  ON avatar_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any upload (approve/reject)
CREATE POLICY "Admins can update avatar uploads"
  ON avatar_uploads FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can delete their own pending uploads
CREATE POLICY "Users can delete own pending uploads"
  ON avatar_uploads FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

-- Storage bucket (run in Supabase dashboard > Storage)
-- CREATE BUCKET user-avatars WITH public = true;
-- Storage policies:
-- Allow authenticated users to upload to their own folder
-- Allow public read access
