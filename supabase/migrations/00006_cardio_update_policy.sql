-- Add missing UPDATE policy on cardio_logs.
-- Run this in Supabase SQL Editor.

CREATE POLICY "cardio_update_own" ON public.cardio_logs
  FOR UPDATE USING (auth.uid() = user_id);
