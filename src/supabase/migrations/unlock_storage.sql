-- Undo lock_storage.sql: drop its "rls storage:" policies, put back the storage policies it dropped, and give the 6
-- buckets their old size and type limits.
-- WARNING: anyone holding the anon key can then list every student video, report attachment, class photo and avatar
-- again, and any signed-in user can upload anything and delete class photos. Safe to run twice.

BEGIN;

-- If a table is busy for more than 10 seconds, stop instead of making the app wait. Nothing changes; run it again.
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  p record;
  role_list text;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'rls storage: %'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;

  IF to_regclass('public.security_lock_policies') IS NOT NULL THEN
    FOR p IN
      SELECT s.* FROM public.security_lock_policies s
      WHERE s.dropped_by = 'lock_storage' AND s.table_name = 'storage.objects'
    LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = p.policy_name) THEN
        SELECT string_agg(CASE WHEN x::text = 'public' THEN 'PUBLIC' ELSE quote_ident(x::text) END, ', ')
          INTO role_list
          FROM unnest(p.roles) AS x;
        EXECUTE format('CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s%s%s',
          p.policy_name, p.permissive, p.cmd, role_list,
          CASE WHEN p.qual IS NOT NULL THEN format(' USING (%s)', p.qual) ELSE '' END,
          CASE WHEN p.with_check IS NOT NULL THEN format(' WITH CHECK (%s)', p.with_check) ELSE '' END);
      END IF;
    END LOOP;
    DELETE FROM public.security_lock_policies WHERE dropped_by = 'lock_storage';
  END IF;

  IF to_regclass('public.security_lock_buckets') IS NOT NULL THEN
    UPDATE storage.buckets b
    SET file_size_limit = s.file_size_limit, allowed_mime_types = s.allowed_mime_types
    FROM public.security_lock_buckets s
    WHERE s.bucket_id = b.id AND s.recorded_by = 'lock_storage';
    DELETE FROM public.security_lock_buckets WHERE recorded_by = 'lock_storage';
  END IF;
END;
$$;

COMMIT;
