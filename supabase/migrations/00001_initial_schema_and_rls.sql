-- Enable uuid-ossp extension if not already installed (for generating UUIDs if needed)
-- Note: Supabase projects already have this extension enabled in the auth schema, but it's safe to include.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can only see and update their own profile
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Tasks table
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Tasks policies: users can only manage their own tasks
CREATE POLICY "Users can view their own tasks" ON public.tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks" ON public.tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" ON public.tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" ON public.tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Workouts table
CREATE TABLE public.workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- Workouts policies: users can only manage their own workouts
CREATE POLICY "Users can view their own workouts" ON public.workouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workouts" ON public.workouts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts" ON public.workouts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts" ON public.workouts
    FOR DELETE USING (auth.uid() = user_id);

-- Exercise sets table (with cascade delete on workouts)
CREATE TABLE public.exercise_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE NOT NULL,
    exercise_name TEXT NOT NULL,
    weight DECIMAL(5,2),
    reps INTEGER,
    set_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.exercise_sets ENABLE ROW LEVEL SECURITY;

-- Exercise sets policies: users can only manage sets for their own workouts (via user_id on workouts)
CREATE POLICY "Users can view their own exercise sets" ON public.exercise_sets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workouts
            WHERE workouts.id = exercise_sets.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert exercise sets for their own workouts" ON public.exercise_sets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workouts
            WHERE workouts.id = exercise_sets.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update exercise sets for their own workouts" ON public.exercise_sets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.workouts
            WHERE workouts.id = exercise_sets.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete exercise sets for their own workouts" ON public.exercise_sets
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.workouts
            WHERE workouts.id = exercise_sets.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

-- Optional: Updated at triggers to automatically update the updated_at column
-- If you want the database to handle updated_at, uncomment the following:

-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
--     CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
--     FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
--   END IF;
--   IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tasks_updated_at') THEN
--     CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
--     FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
--   END IF;
--   IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workouts_updated_at') THEN
--     CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON public.workouts
--     FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
--   END IF;
--   IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_exercise_sets_updated_at') THEN
--     CREATE TRIGGER update_exercise_sets_updated_at BEFORE UPDATE ON public.exercise_sets
--     FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
--   END IF;
-- END $$;