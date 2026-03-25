CREATE TABLE IF NOT EXISTS student_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES users(id) NOT NULL,
  report_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
