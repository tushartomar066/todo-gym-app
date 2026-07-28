-- Migration: Fix schema to match application code
-- Adds missing columns to tasks, creates exercises/sets tables with RLS,
-- and adds unique constraint on workouts(user_id, date) to prevent duplicates.

-- ==================== TASKS ====================

-- The initial migration used `completed` but the app code uses `is_completed`.
-- Add the new column, migrate data, and keep `completed` for one release cycle
-- so any in-flight reads don't break before a full deploy.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high'));

-- Migrate existing completion state into the new column
UPDATE public.tasks SET is_completed = completed WHERE is_completed IS DISTINCT FROM completed;

-- ==================== WORKOUTS unique constraint ====================
-- Prevents two concurrent startWorkout() calls from creating duplicate rows.
ALTER TABLE public.workouts
  DROP CONSTRAINT IF EXISTS workouts_user_date_unique;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_user_date_unique UNIQUE (user_id, date);

-- ==================== EXERCISES table ====================

CREATE TABLE IF NOT EXISTS public.exercises (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id  UUID REFERENCES public.workouts(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Users can only see exercises belonging to their own workouts
CREATE POLICY "exercises_select_own" ON public.exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE workouts.id = exercises.workout_id
        AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "exercises_insert_own" ON public.exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE workouts.id = exercises.workout_id
        AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "exercises_update_own" ON public.exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE workouts.id = exercises.workout_id
        AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "exercises_delete_own" ON public.exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE workouts.id = exercises.workout_id
        AND workouts.user_id = auth.uid()
    )
  );

-- ==================== SETS table ====================

CREATE TABLE IF NOT EXISTS public.sets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id  UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  weight       DECIMAL(6, 2),
  reps         INTEGER,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;

-- Users can only see sets belonging to their own exercises/workouts
CREATE POLICY "sets_select_own" ON public.sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.exercises e
      JOIN public.workouts w ON w.id = e.workout_id
      WHERE e.id = sets.exercise_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "sets_insert_own" ON public.sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exercises e
      JOIN public.workouts w ON w.id = e.workout_id
      WHERE e.id = sets.exercise_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "sets_update_own" ON public.sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.exercises e
      JOIN public.workouts w ON w.id = e.workout_id
      WHERE e.id = sets.exercise_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "sets_delete_own" ON public.sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.exercises e
      JOIN public.workouts w ON w.id = e.workout_id
      WHERE e.id = sets.exercise_id
        AND w.user_id = auth.uid()
    )
  );
