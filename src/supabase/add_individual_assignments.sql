-- Individual Exercise Assignments
-- This table allows teachers/admins to assign exercises to specific students

-- Create the individual_exercise_assignments table
CREATE TABLE IF NOT EXISTS individual_exercise_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed')),
  completed_at TIMESTAMP WITH TIME ZONE,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  notes TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_individual_assignments_user_id ON individual_exercise_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_individual_assignments_exercise_id ON individual_exercise_assignments(exercise_id);
CREATE INDEX IF NOT EXISTS idx_individual_assignments_assigned_by ON individual_exercise_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_individual_assignments_status ON individual_exercise_assignments(status);
CREATE INDEX IF NOT EXISTS idx_individual_assignments_due_date ON individual_exercise_assignments(due_date);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_individual_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_individual_assignments_updated_at
  BEFORE UPDATE ON individual_exercise_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_individual_assignments_updated_at();

-- Enable Row Level Security
ALTER TABLE individual_exercise_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Students can view their own assignments
CREATE POLICY "Students can view their own assignments"
  ON individual_exercise_assignments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Teachers and admins can view all assignments
CREATE POLICY "Teachers and admins can view all assignments"
  ON individual_exercise_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('teacher', 'admin')
    )
  );

-- Teachers and admins can create assignments
CREATE POLICY "Teachers and admins can create assignments"
  ON individual_exercise_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('teacher', 'admin')
    )
  );

-- Teachers and admins can update assignments they created
CREATE POLICY "Teachers and admins can update their assignments"
  ON individual_exercise_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('teacher', 'admin')
    )
  );

-- Students can update status and completion of their own assignments
CREATE POLICY "Students can update their assignment status"
  ON individual_exercise_assignments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Teachers and admins can delete assignments
CREATE POLICY "Teachers and admins can delete assignments"
  ON individual_exercise_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('teacher', 'admin')
    )
  );

-- Create a view for easier querying with related data
CREATE OR REPLACE VIEW individual_assignments_with_details AS
SELECT
  ia.*,
  e.title as exercise_title,
  e.exercise_type,
  e.difficulty_level,
  e.xp_reward,
  e.estimated_duration,
  u.full_name as student_name,
  u.email as student_email,
  a.full_name as assigned_by_name,
  a.email as assigned_by_email
FROM individual_exercise_assignments ia
LEFT JOIN exercises e ON ia.exercise_id = e.id
LEFT JOIN users u ON ia.user_id = u.id
LEFT JOIN users a ON ia.assigned_by = a.id;

-- Grant permissions on the view
GRANT SELECT ON individual_assignments_with_details TO authenticated;

-- Comment on table
COMMENT ON TABLE individual_exercise_assignments IS 'Stores individual exercise assignments from teachers to specific students';
COMMENT ON COLUMN individual_exercise_assignments.status IS 'assigned: newly assigned, in_progress: student started, completed: student finished';
COMMENT ON COLUMN individual_exercise_assignments.priority IS 'Indicates urgency: low, medium, high';
COMMENT ON COLUMN individual_exercise_assignments.notes IS 'Optional notes from teacher for the student';
