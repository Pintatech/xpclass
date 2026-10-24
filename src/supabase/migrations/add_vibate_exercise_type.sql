-- Allow exercise_type = 'vibate' (list copied from the live constraint, plus vibate).

ALTER TABLE public.exercises DROP CONSTRAINT exercises_exercise_type_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_exercise_type_check
  CHECK (exercise_type = ANY ('{ai_fill_blank,drag_drop,dropdown,fill_blank,flashcard,image_hotspot,listening,multiple_choice,pdf_worksheet,pronunciation,quiz,speaking,speaking_assessment,video,video_upload,face_filter_video,vibate}'::text[]));
