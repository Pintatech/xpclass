-- Folder shortcuts on the teacher dashboard.
-- Admins pick Exercise Bank folders; every teacher sees the same buttons.
CREATE TABLE IF NOT EXISTS public.teacher_folder_shortcuts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  folder_id uuid NOT NULL,
  label text NOT NULL CHECK (char_length(btrim(label)) > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teacher_folder_shortcuts_pkey PRIMARY KEY (id),
  -- Deleting a folder also deletes its shortcuts
  CONSTRAINT teacher_folder_shortcuts_folder_id_fkey FOREIGN KEY (folder_id)
    REFERENCES public.exercise_folders(id) ON DELETE CASCADE
);

ALTER TABLE public.teacher_folder_shortcuts ENABLE ROW LEVEL SECURITY;

-- Teachers and admins can read
DROP POLICY IF EXISTS "teacher_folder_shortcuts_select" ON public.teacher_folder_shortcuts;
CREATE POLICY "teacher_folder_shortcuts_select" ON public.teacher_folder_shortcuts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);

-- Only admins can add, edit or delete
DROP POLICY IF EXISTS "teacher_folder_shortcuts_insert" ON public.teacher_folder_shortcuts;
CREATE POLICY "teacher_folder_shortcuts_insert" ON public.teacher_folder_shortcuts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "teacher_folder_shortcuts_update" ON public.teacher_folder_shortcuts;
CREATE POLICY "teacher_folder_shortcuts_update" ON public.teacher_folder_shortcuts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "teacher_folder_shortcuts_delete" ON public.teacher_folder_shortcuts;
CREATE POLICY "teacher_folder_shortcuts_delete" ON public.teacher_folder_shortcuts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
