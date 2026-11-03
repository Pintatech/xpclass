-- Emergency switch for the Exercise Bank lock.
-- Everyone reads every exercise and folder again, like before the lock; folder grants are kept.
-- Teachers can again create and edit in any folder. Students and guests still cannot write.
-- To lock again, run lock_exercise_folder_access.sql.
CREATE OR REPLACE FUNCTION public.exercise_bank_lock_enabled()
RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';
