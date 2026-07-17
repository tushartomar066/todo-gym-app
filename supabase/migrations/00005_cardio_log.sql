-- Add cardio_logs table for tracking runs, walks, steps, warmups, etc.
-- Run this in Supabase SQL Editor.

CREATE TABLE public.cardio_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES auth.users(id) NOT NULL,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_type    TEXT NOT NULL CHECK (activity_type IN ('run', 'walk', 'warmup', 'cycle', 'other')),
  duration_minutes DECIMAL(6, 1) NOT NULL,
  distance_km      DECIMAL(6, 3),
  steps            INTEGER,
  notes            TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cardio_select_own" ON public.cardio_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cardio_insert_own" ON public.cardio_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cardio_delete_own" ON public.cardio_logs
  FOR DELETE USING (auth.uid() = user_id);
