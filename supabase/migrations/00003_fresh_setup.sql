-- Run this in Supabase SQL Editor (fresh project — no existing data).
-- Creates all tables with correct columns and RLS from the start.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== PROFILES ====================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ==================== TASKS ====================

CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) NOT NULL,
  title        TEXT NOT NULL,
  priority     TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  is_completed BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== WORKOUTS ====================

CREATE TABLE IF NOT EXISTS public.workouts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES auth.users(id) NOT NULL,
  date       DATE NOT NULL,
  notes      TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT workouts_user_date_unique UNIQUE (user_id, date)
);

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workouts_select_own" ON public.workouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "workouts_insert_own" ON public.workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workouts_update_own" ON public.workouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "workouts_delete_own" ON public.workouts
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== EXERCISES ====================

CREATE TABLE IF NOT EXISTS public.exercises (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

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

-- ==================== SETS ====================

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
