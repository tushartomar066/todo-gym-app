-- Performance indexes. Idempotent, safe to re-run.
-- Every hot query in actions.ts filters by user_id and orders by date/created_at.
-- These indexes turn full scans into index range scans on Supabase free tier.

CREATE INDEX IF NOT EXISTS tasks_user_created_idx
  ON public.tasks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tasks_user_completed_idx
  ON public.tasks (user_id, is_completed);

CREATE INDEX IF NOT EXISTS workouts_user_date_idx
  ON public.workouts (user_id, date DESC);

CREATE INDEX IF NOT EXISTS exercises_workout_idx
  ON public.exercises (workout_id);

CREATE INDEX IF NOT EXISTS exercises_name_idx
  ON public.exercises (name);

CREATE INDEX IF NOT EXISTS sets_exercise_idx
  ON public.sets (exercise_id);

CREATE INDEX IF NOT EXISTS sets_exercise_completed_idx
  ON public.sets (exercise_id, is_completed)
  WHERE is_completed = true;

CREATE INDEX IF NOT EXISTS cardio_user_date_idx
  ON public.cardio_logs (user_id, date DESC, created_at DESC);
