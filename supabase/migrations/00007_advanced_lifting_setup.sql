-- Advanced Lifting Features Migration (idempotent — safe to re-run)
-- Adds set_type column for set categories and exercise notes.
-- Using ADD COLUMN IF NOT EXISTS + guard checks so re-running never errors.

-- Part 1: set_type on sets
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS set_type TEXT;

UPDATE public.sets SET set_type = 'working' WHERE set_type IS NULL;

ALTER TABLE public.sets ALTER COLUMN set_type SET DEFAULT 'working';
ALTER TABLE public.sets ALTER COLUMN set_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'set_type_check'
  ) THEN
    ALTER TABLE public.sets
      ADD CONSTRAINT set_type_check CHECK (set_type IN ('warmup', 'working', 'drop_set', 'failure'));
  END IF;
END $$;

-- Part 2: notes on exercises
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS notes TEXT;

-- Part 3: exercises RLS — allow note updates
DROP POLICY IF EXISTS exercises_update_own ON public.exercises;
CREATE POLICY "exercises_update_own" ON public.exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE workouts.id = exercises.workout_id
        AND workouts.user_id = auth.uid()
    )
  );

-- Part 4: sets RLS — allow set_type field updates
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

-- Part 5: sets RLS — allow insert with set_type
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
