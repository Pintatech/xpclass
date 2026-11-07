-- Step 3 of the lock: storage (the files behind the app: videos, photos, avatars, report attachments).
--
-- Found 2026-11-07 (security_check.sql sections 14 and 15):
--   - every bucket is public and only user-avatars has a size limit (5 MB); no bucket limits the file type;
--   - "SELECT to public" policies on exercise-videos, report-attachments, lesson-photos, user-avatars, exercise-files and
--     course-backgrounds let anyone holding the anon key, no login, LIST every file: the students' videos (named by
--     user id), the bug-report screenshots, the class photos;
--   - any signed-in user (anyone, since sign-up is open) can upload any file of any size to exercise-videos,
--     exercise-files, course-backgrounds, lesson-photos and report-attachments, and delete every class photo.
--
-- How the app uses storage (checked in src/): only upload, getPublicUrl and remove; it never lists a bucket.
--   course-backgrounds   admins (CourseManagement) and teachers (EditUnitModal) upload course/unit pictures
--   exercise-files       teachers and admins upload pictures, audio and PDFs from the exercise editors
--   lesson-photos        teachers upload and remove class photos (ClassPerformanceView, HomeworkReportView)
--   exercise-videos      students upload to <their id>/... (video exercise, Vibate) and speaking/<their id>/...;
--                        a student removes their own Vibate videos
--   report-attachments   any user attaches a file to a report, under <their id>/...
--   user-avatars         a student uploads to <their id>/... and removes their own; admins approve (re-upload
--                        compressed) and remove (AvatarApproval)
--
-- After this file:
--   - nobody lists a bucket without being allowed to: students see only their own folder, teachers and admins what they
--     manage. Files still open from their public link, so every picture, video and attachment in the app shows as today;
--   - course-backgrounds, exercise-files, lesson-photos: only teachers and admins upload, replace or delete;
--   - exercise-videos: a student uploads and deletes only in their own folder; teachers and admins read and delete any;
--   - report-attachments: a student uploads only in their own folder; admins manage all;
--   - user-avatars: a student uploads and deletes only in their own folder; admins manage all;
--   - size limits: avatars 5 MB (as now), pictures 20 MB, report attachments 50 MB (the report form allows 50),
--     exercise files 50 MB, videos 100 MB (the video exercise allows 50 by default). Type limits: pictures only in
--     user-avatars, course-backgrounds and lesson-photos; pictures and videos in report-attachments.
-- Not changed: the buckets stay public, so whoever has a file's exact link can still open it. Links contain the user
-- id and a timestamp, so they cannot be guessed now that listing is closed. Making videos private needs signed links
-- in the app (a code change). Buckets the app does not upload to (event, inventory-assets, pet-assets, real-image,
-- shop-assets, ui-assets) have no policies, so the API cannot list or change them; they are left as they are.
-- Unaffected: the Supabase dashboard and the service role.
--
-- Every policy it drops and every bucket setting it changes is recorded for the undo. Safe to run twice.
-- Undo: unlock_storage.sql.
-- The last result: the 6 buckets with their new limits, then only "rls storage:" policies on storage.objects.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.security_lock_policies (
  table_name text NOT NULL,
  policy_name text NOT NULL,
  permissive text NOT NULL,
  roles name[] NOT NULL,
  cmd text NOT NULL,
  qual text,
  with_check text,
  dropped_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, policy_name)
);
ALTER TABLE public.security_lock_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_lock_policies FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.security_lock_buckets (
  bucket_id text PRIMARY KEY,
  file_size_limit bigint,
  allowed_mime_types text[],
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_lock_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_lock_buckets FROM PUBLIC, anon, authenticated;

-- 1. Keep a copy of every policy on storage.objects for the 6 buckets the app uses, then drop them. Policies that
--    mention no bucket at all, or only other buckets, are left alone.
INSERT INTO public.security_lock_policies (table_name, policy_name, permissive, roles, cmd, qual, with_check, dropped_by)
SELECT 'storage.objects', p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check, 'lock_storage'
FROM pg_policies p
WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
  AND p.policyname NOT LIKE 'rls storage: %'
  AND concat(p.qual, ' ', p.with_check) ~ '''(course-backgrounds|exercise-files|exercise-videos|lesson-photos|report-attachments|user-avatars)'''
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname LIKE 'rls storage: %'
           OR concat(qual, ' ', with_check) ~ '''(course-backgrounds|exercise-files|exercise-videos|lesson-photos|report-attachments|user-avatars)''')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END;
$$;

-- 2. New policies. (storage.foldername(name))[1] is the first folder of the file path.

-- Pictures and exercise files: teachers and admins only.
CREATE POLICY "rls storage: teachers and admins manage lesson files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id IN ('course-backgrounds', 'exercise-files', 'lesson-photos')
         AND ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user())))
  WITH CHECK (bucket_id IN ('course-backgrounds', 'exercise-files', 'lesson-photos')
              AND ((SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user())));

-- Student videos: <user id>/... (video exercise, Vibate) or speaking/<user id>/... (speaking exercise).
CREATE POLICY "rls storage: students upload their own videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exercise-videos'
              AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text
                   OR ((storage.foldername(name))[1] = 'speaking' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text)));
CREATE POLICY "rls storage: own videos, teachers and admins all" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'exercise-videos'
         AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text
              OR ((storage.foldername(name))[1] = 'speaking' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text)
              OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user())));
CREATE POLICY "rls storage: delete own videos, teachers and admins any" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'exercise-videos'
         AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text
              OR ((storage.foldername(name))[1] = 'speaking' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text)
              OR (SELECT public.is_teacher_user()) OR (SELECT public.is_admin_user())));

-- Report attachments and avatars: <user id>/...; admins manage everything in both.
CREATE POLICY "rls storage: upload to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('report-attachments', 'user-avatars')
              AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "rls storage: see own folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('report-attachments', 'user-avatars')
         AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "rls storage: delete own avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "rls storage: admins manage avatars and attachments" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id IN ('report-attachments', 'user-avatars') AND (SELECT public.is_admin_user()))
  WITH CHECK (bucket_id IN ('report-attachments', 'user-avatars') AND (SELECT public.is_admin_user()));

-- 3. Size and type limits, keeping the old values for the undo.
INSERT INTO public.security_lock_buckets (bucket_id, file_size_limit, allowed_mime_types, recorded_by)
SELECT b.id, b.file_size_limit, b.allowed_mime_types, 'lock_storage'
FROM storage.buckets b
WHERE b.id IN ('course-backgrounds', 'exercise-files', 'exercise-videos', 'lesson-photos', 'report-attachments', 'user-avatars')
ON CONFLICT DO NOTHING;

UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/*'] WHERE id = 'user-avatars';
UPDATE storage.buckets SET file_size_limit = 20971520, allowed_mime_types = ARRAY['image/*'] WHERE id IN ('course-backgrounds', 'lesson-photos');
UPDATE storage.buckets SET file_size_limit = 52428800, allowed_mime_types = ARRAY['image/*', 'video/*'] WHERE id = 'report-attachments';
UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'exercise-files';
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'exercise-videos';

COMMIT;

-- Check. Expected: 6 bucket rows with the limits above, then 8 policy rows, all starting with "rls storage:".
SELECT 'bucket' AS kind, b.id AS name,
       concat('public=', b.public, ' | max MB=', round(b.file_size_limit / 1048576.0),
              ' | types=', coalesce(array_to_string(b.allowed_mime_types, ','), 'any')) AS info
FROM storage.buckets b
WHERE b.id IN ('course-backgrounds', 'exercise-files', 'exercise-videos', 'lesson-photos', 'report-attachments', 'user-avatars')
UNION ALL
SELECT 'policy', p.policyname, p.cmd || ' to ' || array_to_string(p.roles, ',')
FROM pg_policies p
WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
ORDER BY 1, 2;
