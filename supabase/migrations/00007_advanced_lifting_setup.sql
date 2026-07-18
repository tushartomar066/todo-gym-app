-- Advanced Lifting Features Migration
-- Adds set_type column for different set categories and exercise notes

-- Part 1: Update sets table to support set types
ALTER TABLE public.sets
  ADD COLUMN set_type TEXT NOT NULL DEFAULT 'working',
  ADD CONSTRAINT set_type_check CHECK (set_type IN ('warmup', 'working', 'drop_set', 'failure'));

-- Part 2: Update exercises table to add notes column for equipment/position details
ALTER TABLE public.exercises
  ADD COLUMN notes TEXT NULL;

-- Part 3: Update exercises table RLS to allow note updates
DROP POLICY IF EXISTS exercises_update_own ON public.exercises;
CREATE POLICY "exercises_update_own" ON public.exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE workouts.id = exercises.workout_id
        AND workouts.user_id = auth.uid()
    )
  );

-- Part 4: Update sets table RLS to allow set_type field updates
DROP POLICY IF EXISTS sets_update_own ON public.sets;
CREATE POLICY "sets_update_own" ON public.sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.exercises e
      JOIN public.workouts w ON w.id = e.workout_id
      WHERE e.id = sets.exercise_id
        AND w.user_id = auth.uid()
    )
  );

-- Part 5: Add RLS policies for insert with set_type
DROP POLICY IF EXISTS sets_insert_own ON public.sets;
CREATE POLICY "sets_insert_own" ON public.sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exercises e
      JOIN public.workouts w ON w.id = e.workout_id
      WHERE e.id = sets.exercise_id
        AND w.user_id = auth.uid()
    )
  );

-- Part 6: Grant read access for existing policy compliance
-- (Policies for select/insert already cover the tables, no changes needed)