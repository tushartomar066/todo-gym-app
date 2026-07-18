'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Task, Workout, Exercise, WorkoutSet, CardioLog, ActivityType, SetType } from '@/types/database'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return { user, supabase }
}

export async function getTodayTasks() {
  const { user, supabase } = await getUser()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', today)
    .lte('created_at', today + 'T23:59:59.999Z')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Task[]) || []
}

export async function getTasks(filter: 'all' | 'active' | 'completed' = 'all') {
  const { user, supabase } = await getUser()
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)

  if (filter === 'active') {
    query = query.eq('is_completed', false)
  } else if (filter === 'completed') {
    query = query.eq('is_completed', true)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  return (data as Task[]) || []
}

export async function addTask(title: string, priority: 'low' | 'medium' | 'high' = 'medium') {
  const { user, supabase } = await getUser()

  const { data, error } = await supabase
    .from('tasks')
    .insert([
      {
        user_id: user.id,
        title,
        priority,
        is_completed: false,
      },
    ])
    .select()
    .single()

  if (error) throw error
  revalidatePath('/todo')
  revalidatePath('/dashboard')
  return (data as Task) || null
}

export async function toggleTaskComplete(id: string, isCompleted: boolean) {
  const { user, supabase } = await getUser()

  const { data, error } = await supabase
    .from('tasks')
    .update({ is_completed: !isCompleted })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/todo')
  revalidatePath('/dashboard')
  return (data as Task) || null
}

export async function deleteTask(id: string) {
  const { user, supabase } = await getUser()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/todo')
  revalidatePath('/dashboard')
}

export async function getTasksForLast7Days() {
  const { user, supabase } = await getUser()
  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const start = sevenDaysAgo.toISOString().split('T')[0]
  const end = today.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', start)
    .lte('created_at', end + 'T23:59:59.999Z')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as Task[]) || []
}

export async function getTodayWorkout() {
  const { user, supabase } = await getUser()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }
  return (data as Workout) || null
}

export async function getTodayWorkoutWithDetails() {
  const { user, supabase } = await getUser()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('workouts')
    .select(`
      *,
      exercises (
        *,
        sets (
          *
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }
  return (data as Workout) || null
}

export async function getAllWorkoutsWithDetails() {
  const { user, supabase } = await getUser()

  const { data, error } = await supabase
    .from('workouts')
    .select(`
      *,
      exercises (
        *,
        sets (
          *
        )
      )
    `)
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (error) throw error
  return (data as Workout[]) || []
}

export interface PersonalRecord {
  exerciseName: string
  weight: number
  reps: number
  date: string
}

export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  const { user, supabase } = await getUser()

  const { data, error } = await supabase
    .from('sets')
    .select(`
      weight,
      reps,
      exercises!inner (
        name,
        workouts!inner (
          date,
          user_id
        )
      )
    `)
    .eq('exercises.workouts.user_id', user.id)
    .not('weight', 'is', null)

  if (error) throw error
  if (!data) return []

  const prMap = new Map<string, PersonalRecord>()

  for (const row of data as any[]) {
    const name: string  = row.exercises.name
    const weight: number = row.weight
    const reps: number   = row.reps ?? 0
    const date: string   = row.exercises.workouts.date

    const existing = prMap.get(name)
    if (
      !existing ||
      weight > existing.weight ||
      (weight === existing.weight && reps > existing.reps)
    ) {
      prMap.set(name, { exerciseName: name, weight, reps, date })
    }
  }

  return Array.from(prMap.values()).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))
}

export async function startWorkout() {
  const { user, supabase } = await getUser()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('workouts')
    .upsert(
      { user_id: user.id, date: today },
      { onConflict: 'user_id,date', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) throw error
  revalidatePath('/gym')
  revalidatePath('/dashboard')
  return (data as Workout) || null
}

export async function addExercise(name: string) {
  const { user, supabase } = await getUser()
  const today = new Date().toISOString().split('T')[0]

  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .upsert(
      { user_id: user.id, date: today },
      { onConflict: 'user_id,date', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (workoutError || !workout) throw new Error('Could not create workout')

  const { data, error } = await supabase
    .from('exercises')
    .insert([{ workout_id: workout.id, name }])
    .select()
    .single()

  if (error) throw error
  revalidatePath('/gym')
  return (data as Exercise) || null
}

export async function addSet(
  exerciseId: string,
  weight: number,
  reps: number,
  setType: SetType = 'working',
) {
  const { user, supabase } = await getUser()

  const { data: exercise, error: exerciseError } = await supabase
    .from('exercises')
    .select('id, workout_id, workouts!inner(user_id)')
    .eq('id', exerciseId)
    .single()

  if (exerciseError || !exercise) {
    throw new Error('Exercise not found')
  }

  const workouts = exercise.workouts as unknown as { user_id: string } | { user_id: string }[]
  const workoutUserId = Array.isArray(workouts)
    ? workouts[0]?.user_id
    : workouts?.user_id

  if (!workoutUserId) throw new Error('Exercise not found')
  if (workoutUserId !== user.id) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('sets')
    .insert([{ exercise_id: exerciseId, weight, reps, set_type: setType, is_completed: false }])
    .select()
    .single()

  if (error) throw error
  revalidatePath('/gym')
  return (data as WorkoutSet) || null
}

export async function updateExerciseNotes(exerciseId: string, notes: string | null) {
  const { user, supabase } = await getUser()

  const { data: exercise, error: exerciseError } = await supabase
    .from('exercises')
    .select('id, workout_id, workouts!inner(user_id)')
    .eq('id', exerciseId)
    .single()

  if (exerciseError || !exercise) {
    throw new Error('Exercise not found')
  }

  const workouts = exercise.workouts as unknown as { user_id: string } | { user_id: string }[]
  const workoutUserId = Array.isArray(workouts)
    ? workouts[0]?.user_id
    : workouts?.user_id

  if (!workoutUserId) throw new Error('Exercise not found')
  if (workoutUserId !== user.id) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('exercises')
    .update({ notes: notes?.trim() || null })
    .eq('id', exerciseId)

  if (error) throw error
  revalidatePath('/gym')
}

export async function getPreviousExerciseData(exerciseName: string): Promise<{
  exerciseName: string
  sets: { weight: number | null; reps: number | null; set_type: SetType }[]
  date: string | null
} | null> {
  const { user, supabase } = await getUser()

  // Find the most recent PAST workout that contains an exercise with this name.
  // Today's workout (if any) is excluded so we surface the *previous* session.
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('exercises')
    .select(`
      name,
      notes,
      workout_id,
      workouts!inner (
        date,
        user_id
      ),
      sets (
        weight,
        reps,
        set_type,
        is_completed
      )
    `)
    .eq('workouts.user_id', user.id)
    .eq('name', exerciseName)
    .neq('workouts.date', today)
    .order('date', { foreignTable: 'workouts', ascending: false })
    .limit(1)

  if (error) throw error
  if (!data || data.length === 0) return null

  const latest = data[0] as any
  const sets = (latest.sets as any[] | undefined)
    ?.filter((s) => s.is_completed)
    ?.map((s) => ({ weight: s.weight, reps: s.reps, set_type: s.set_type as SetType }))
    ?? []

  return {
    exerciseName: latest.name,
    sets,
    date: latest.workouts?.date ?? null,
  }
}

export async function getUniqueExerciseNames(): Promise<string[]> {
  const { user, supabase } = await getUser()

  const { data, error } = await supabase
    .from('exercises')
    .select(`
      name,
      workouts!inner ( user_id )
    `)
    .eq('workouts.user_id', user.id)
    .order('name', { ascending: true })

  if (error) throw error
  if (!data) return []

  // Deduplicate by name (Supabase returns one row per exercise row).
  const seen = new Set<string>()
  const names: string[] = []
  for (const row of data as any[]) {
    const name: string = row.name
    if (name && !seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

export async function toggleSetComplete(id: string) {
  const { user, supabase } = await getUser()

  const { data: set, error: setError } = await supabase
    .from('sets')
    .select('id, is_completed, exercises!inner(workout_id, workouts!inner(user_id))')
    .eq('id', id)
    .single()

  if (setError || !set) {
    throw new Error('Set not found')
  }

  const exercises = set.exercises as unknown as
    | { workout_id: string; workouts: { user_id: string } | { user_id: string }[] }
    | { workout_id: string; workouts: { user_id: string } | { user_id: string }[] }[]

  const exerciseObj = Array.isArray(exercises) ? exercises[0] : exercises
  const workouts = exerciseObj?.workouts
  const workoutUserId = Array.isArray(workouts)
    ? workouts[0]?.user_id
    : workouts?.user_id

  if (!workoutUserId) throw new Error('Set not found')
  if (workoutUserId !== user.id) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('sets')
    .update({ is_completed: !set.is_completed })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/gym')
  return (data as WorkoutSet) || null
}

export async function completeWorkout(workoutId: string) {
  const { user, supabase } = await getUser()

  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .single()

  if (workoutError || !workout) {
    throw new Error('Workout not found or unauthorized')
  }

  revalidatePath('/gym')
  revalidatePath('/dashboard')
  return (workout as Workout) || null
}

export async function getDashboardData() {
  const { user, supabase } = await getUser()
  const today = new Date().toISOString().split('T')[0]

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', today)
    .lte('created_at', today + 'T23:59:59.999Z')

  if (tasksError) throw tasksError

  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  if (workoutError && workoutError.code !== 'PGRST116') {
    throw workoutError
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const weekStart = sevenDaysAgo.toISOString().split('T')[0]

  const { data: weeklyTasks, error: weeklyError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', weekStart)
    .lte('created_at', today + 'T23:59:59.999Z')
    .order('created_at', { ascending: true })

  if (weeklyError) throw weeklyError

  return {
    tasks: (tasks as Task[]) || [],
    workout: (workout as Workout) || null,
    weeklyTasks: (weeklyTasks as Task[]) || [],
  }
}

export async function getCardioLogs(): Promise<CardioLog[]> {
  const { user, supabase } = await getUser()

  const { data, error } = await supabase
    .from('cardio_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as CardioLog[]) || []
}

export async function addCardioLog(
  activity_type: ActivityType,
  duration_minutes: number,
  date: string,
  distance_km?: number | null,
  steps?: number | null,
  notes?: string | null,
): Promise<CardioLog> {
  const { user, supabase } = await getUser()

  const { data, error } = await supabase
    .from('cardio_logs')
    .insert([{
      user_id: user.id,
      activity_type,
      duration_minutes,
      date,
      distance_km: distance_km ?? null,
      steps: steps ?? null,
      notes: notes?.trim() || null,
    }])
    .select()
    .single()

  if (error) throw error
  revalidatePath('/cardio')
  return data as CardioLog
}

export async function updateCardioLog(
  id: string,
  patch: {
    activity_type?: ActivityType
    duration_minutes?: number
    date?: string
    distance_km?: number | null
    steps?: number | null
    notes?: string | null
  },
): Promise<CardioLog> {
  const { user, supabase } = await getUser()

  const { data, error } = await supabase
    .from('cardio_logs')
    .update({
      ...patch,
      notes: patch.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/cardio')
  return data as CardioLog
}

export async function deleteCardioLog(id: string): Promise<void> {
  const { user, supabase } = await getUser()

  const { error } = await supabase
    .from('cardio_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/cardio')
}
