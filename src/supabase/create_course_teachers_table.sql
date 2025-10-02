-- Create junction table for many-to-many relationship between courses and teachers
CREATE TABLE IF NOT EXISTS course_teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, teacher_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_course_teachers_course_id ON course_teachers(course_id);
CREATE INDEX IF NOT EXISTS idx_course_teachers_teacher_id ON course_teachers(teacher_id);

-- Enable RLS
ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view course teachers"
  ON course_teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage course teachers"
  ON course_teachers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Migrate existing teacher assignments from courses table
INSERT INTO course_teachers (course_id, teacher_id)
SELECT id, teacher_id
FROM courses
WHERE teacher_id IS NOT NULL
ON CONFLICT (course_id, teacher_id) DO NOTHING;
