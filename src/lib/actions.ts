'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getTodayIST, istDayBounds, istRangeBounds } from '@/lib/date'
import { Task, Workout, Exercise, WorkoutSet, CardioLog, ActivityType, SetType } from '@/types/database'

const TASK_COLS = 'id, user_id, title, priority, is_completed, created_at, updated_at'
const WORKOUT_COLS = 'id, user_id, date, notes, created_at, updated_at'
const EXERCISE_COLS = 'id, workout_id, name, notes, created_at, updated_at'
const SET_COLS = 'id, exercise_id, weight, reps, is_completed, set_type, created_at, updated_at'
const CARDIO_COLS = 'id, user_id, date, activity_type, duration_minutes, distance_km, steps, notes, created_at'

async function getAuth() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Unauthorized')
  return { user: session.user, supabase }
}

export async function getTodayTasks() {
  const { user, supabase } = await getAuth()
  const { startUtc, endUtc } = istDayBounds(getTodayIST())

  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_COLS)
    .eq('user_id', user.id)
    .gte('created_at', startUtc)
    .lte('created_at', endUtc)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Task[]) || []
}

export async function getTasks(filter: 'all' | 'active' | 'completed' = 'all') {
  const { user, supabase } = await getAuth()
  let query = supabase.from('tasks').select(TASK_COLS).eq('user_id', user.id)

  if (filter === 'active') query = query.eq('is_completed', false)
  else if (filter === 'completed') query = query.eq('is_completed', true)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return (data as Task[]) || []
}

export async function addTask(title: string, priority: 'low' | 'medium' | 'high' = 'medium') {
  const { user, supabase } = await getAuth()

  const { data, error } = await supabase
    .from('tasks')
    .insert([{ user_id: user.id, title, priority, is_completed: false }])
    .select(TASK_COLS)
    .single()

  if (error) throw error
  return (data as Task) || null
}

export async function toggleTaskComplete(id: string, isCompleted: boolean) {
  const { user, supabase } = await getAuth()

  const { data, error } = await supabase
    .from('tasks')
    .update({ is_completed: !isCompleted })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(TASK_COLS)
    .single()

  if (error) throw error
  return (data as Task) || null
}

export async function deleteTask(id: string) {
  const { user, supabase } = await getAuth()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}

export async function getTodayWorkout() {
  const { user, supabase } = await getAuth()

  const { data, error } = await supabase
    .from('workouts')
    .select(WORKOUT_COLS)
    .eq('user_id', user.id)
    .eq('date', getTodayIST())
    .maybeSingle()

  if (error) throw error
  return (data as Workout) || null
}

export async function getInitialGymData(limit = 30) {
  const { user, supabase } = await getAuth()
  const today = getTodayIST()

  const [workoutsResult, namesResult] = await Promise.all([
    supabase
      .from('workouts')
      .select(`${WORKOUT_COLS}, exercises(${EXERCISE_COLS}, sets(${SET_COLS}))`)
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(limit),
    supabase
      .from('exercises')
      .select(`name, workouts!inner(user_id)`)
      .eq('workouts.user_id', user.id)
      .order('name', { ascending: true }),
  ])

  if (workoutsResult.error) throw workoutsResult.error
  if (namesResult.error) throw namesResult.error

  const workouts = (workoutsResult.data as Workout[]) || []

  const seen = new Set<string>()
  const exerciseNames: string[] = []
  for (const row of (namesResult.data as { name: string }[]) || []) {
    if (row.name && !seen.has(row.name)) {
      seen.add(row.name)
      exerciseNames.push(row.name)
    }
  }

  const uniqueNames = Array.from(
    new Set(workouts.flatMap(w => (w.exercises || []).map((e: Exercise) => e.name)))
  )

  let prevData = new Map<string, { exerciseName: string; sets: { weight: number | null; reps: number | null; set_type: SetType }[]; date: string | null }>()

  if (uniqueNames.length > 0) {
    const { data: prevRows, error: prevError } = await supabase
      .from('exercises')
      .select(`name, workouts!inner(date, user_id), sets(weight, reps, set_type, is_completed)`)
      .eq('workouts.user_id', user.id)
      .in('name', uniqueNames)
      .neq('workouts.date', today)
      .order('date', { foreignTable: 'workouts', ascending: false })

    if (!prevError && prevRows) {
      const result = new Map<string, { exerciseName: string; sets: { weight: number | null; reps: number | null; set_type: SetType }[]; date: string | null }>()
      for (const row of prevRows as { name: string; workouts: { date: string } | { date: string }[]; sets?: { weight: number | null; reps: number | null; set_type: SetType; is_completed: boolean }[] }[]) {
        if (result.has(row.name)) continue
        const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts
        const sets = (row.sets || [])
          .filter(s => s.is_completed)
          .map(s => ({ weight: s.weight, reps: s.reps, set_type: s.set_type }))
        result.set(row.name, { exerciseName: row.name, sets, date: workout?.date ?? null })
      }
      prevData = result
    }
  }

  return { workouts, exerciseNames, prevData }
}

export interface PersonalRecord {
  exerciseName: string
  weight: number
  reps: number
  date: string
}

export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  const { user, supabase } = await getAuth()

  const { data, error } = await supabase
    .from('sets')
    .select(`weight, reps, exercises!inner(name, workouts!inner(date, user_id))`)
    .eq('exercises.workouts.user_id', user.id)
    .not('weight', 'is', null)
    .eq('is_completed', true)

  if (error) throw error
  if (!data) return []

  const prMap = new Map<string, PersonalRecord>()

  for (const row of data as { weight: number; reps: number | null; exercises: { name: string; workouts: { date: string } | { date: string }[] } | { name: string; workouts: { date: string } | { date: string }[] }[] }[]) {
    const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises
    if (!ex) continue
    const wo = Array.isArray(ex.workouts) ? ex.workouts[0] : ex.workouts
    if (!wo) continue

    const name = ex.name
    const weight = row.weight
    const reps = row.reps ?? 0
    const date = wo.date

    const existing = prMap.get(name)
    if (!existing || weight > existing.weight || (weight === existing.weight && reps > existing.reps)) {
      prMap.set(name, { exerciseName: name, weight, reps, date })
    }
  }

  return Array.from(prMap.values()).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))
}

export async function addExercise(name: string) {
  const { user, supabase } = await getAuth()

  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .upsert({ user_id: user.id, date: getTodayIST() }, { onConflict: 'user_id,date', ignoreDuplicates: false })
    .select('id')
    .single()

  if (workoutError || !workout) throw new Error('Could not create workout')

  const { data, error } = await supabase
    .from('exercises')
    .insert([{ workout_id: workout.id, name }])
    .select(EXERCISE_COLS)
    .single()

  if (error) throw error
  return (data as Exercise) || null
}

export async function addSet(exerciseId: string, weight: number, reps: number, setType: SetType = 'working') {
  const { supabase } = await getAuth()

  const { data, error } = await supabase
    .from('sets')
    .insert([{ exercise_id: exerciseId, weight, reps, set_type: setType, is_completed: false }])
    .select(SET_COLS)
    .single()

  if (error) throw error
  return (data as WorkoutSet) || null
}

export async function updateExerciseNotes(exerciseId: string, notes: string | null) {
  const { supabase } = await getAuth()

  const { error } = await supabase
    .from('exercises')
    .update({ notes: notes?.trim() || null })
    .eq('id', exerciseId)

  if (error) throw error
}

export async function getPreviousExerciseDataBatch(exerciseNames: string[]) {
  const { user, supabase } = await getAuth()
  const today = getTodayIST()

  if (exerciseNames.length === 0) return new Map()

  const { data, error } = await supabase
    .from('exercises')
    .select(`name, workouts!inner(date, user_id), sets(weight, reps, set_type, is_completed)`)
    .eq('workouts.user_id', user.id)
    .in('name', exerciseNames)
    .neq('workouts.date', today)
    .order('date', { foreignTable: 'workouts', ascending: false })

  if (error) throw error
  if (!data) return new Map()

  const result = new Map<string, { exerciseName: string; sets: { weight: number | null; reps: number | null; set_type: SetType }[]; date: string | null }>()

  for (const row of data as { name: string; workouts: { date: string } | { date: string }[]; sets?: { weight: number | null; reps: number | null; set_type: SetType; is_completed: boolean }[] }[]) {
    if (result.has(row.name)) continue
    const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts
    if (!workout) continue

    const sets = (row.sets || [])
      .filter(s => s.is_completed)
      .map(s => ({ weight: s.weight, reps: s.reps, set_type: s.set_type }))

    result.set(row.name, { exerciseName: row.name, sets, date: workout.date })
  }

  return result
}

export async function toggleSetComplete(id: string, currentIsCompleted: boolean) {
  const { supabase } = await getAuth()

  const { data, error } = await supabase
    .from('sets')
    .update({ is_completed: !currentIsCompleted })
    .eq('id', id)
    .select(SET_COLS)
    .single()

  if (error) throw error
  return (data as WorkoutSet) || null
}

export async function deleteSet(setId: string) {
  const { supabase } = await getAuth()

  const { error } = await supabase.from('sets').delete().eq('id', setId)
  if (error) throw error
}

export async function deleteExercise(exerciseId: string) {
  const { supabase } = await getAuth()

  const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
  if (error) throw error
}

export async function addExerciseToDate(name: string, date: string) {
  const { user, supabase } = await getAuth()

  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .upsert({ user_id: user.id, date }, { onConflict: 'user_id,date', ignoreDuplicates: false })
    .select('id')
    .single()

  if (workoutError || !workout) throw new Error('Could not create workout')

  const { data, error } = await supabase
    .from('exercises')
    .insert([{ workout_id: workout.id, name }])
    .select(EXERCISE_COLS)
    .single()

  if (error) throw error
  return data as Exercise
}

export async function markAllSetsComplete(workoutId: string) {
  const { user, supabase } = await getAuth()

  const { data: exercises, error: exErr } = await supabase
    .from('exercises')
    .select('id, workouts!inner(user_id)')
    .eq('workout_id', workoutId)
    .eq('workouts.user_id', user.id)

  if (exErr) throw exErr
  const exIds = (exercises as { id: string }[]).map(e => e.id)
  if (exIds.length === 0) return

  const { error } = await supabase.from('sets').update({ is_completed: true }).in('exercise_id', exIds)
  if (error) throw error
  revalidatePath('/gym')
}

export async function deleteWorkout(workoutId: string) {
  const { supabase } = await getAuth()

  const { error } = await supabase.from('workouts').delete().eq('id', workoutId)
  if (error) throw error
}

export async function getDashboardData() {
  const { user, supabase } = await getAuth()
  const today = getTodayIST()
  const { startUtc: todayStart, endUtc: todayEnd } = istDayBounds(today)

  const sevenDaysAgo = new Date(Date.now() - 6 * 86400000)
  const weekStartIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(sevenDaysAgo)
  const { startUtc: weekStart } = istRangeBounds(weekStartIst, today)

  const [
    { data: tasks, error: tasksError },
    { data: workout, error: workoutError },
    { data: weeklyTasks, error: weeklyError },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, is_completed')
      .eq('user_id', user.id)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd),
    supabase
      .from('workouts')
      .select('id, exercises(id)')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('id, is_completed, created_at')
      .eq('user_id', user.id)
      .gte('created_at', weekStart)
      .lte('created_at', todayEnd)
      .eq('is_completed', true)
      .order('created_at', { ascending: true }),
  ])

  if (tasksError) throw tasksError
  if (workoutError) throw workoutError
  if (weeklyError) throw weeklyError

  return {
    tasks: (tasks as Pick<Task, 'id' | 'is_completed'>[]) || [],
    workout: (workout as (Workout & { exercises?: { id: string }[] }) | null) || null,
    weeklyTasks: (weeklyTasks as Pick<Task, 'id' | 'is_completed' | 'created_at'>[]) || [],
  }
}

export async function getCardioLogs(): Promise<CardioLog[]> {
  const { user, supabase } = await getAuth()

  const { data, error } = await supabase
    .from('cardio_logs')
    .select(CARDIO_COLS)
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
  const { user, supabase } = await getAuth()

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
    .select(CARDIO_COLS)
    .single()

  if (error) throw error
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
  const { user, supabase } = await getAuth()

  const update: Record<string, unknown> = {}
  if (patch.activity_type !== undefined) update.activity_type = patch.activity_type
  if (patch.duration_minutes !== undefined) update.duration_minutes = patch.duration_minutes
  if (patch.date !== undefined) update.date = patch.date
  if (patch.distance_km !== undefined) update.distance_km = patch.distance_km
  if (patch.steps !== undefined) update.steps = patch.steps
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null

  const { data, error } = await supabase
    .from('cardio_logs')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(CARDIO_COLS)
    .single()

  if (error) throw error
  return data as CardioLog
}

export async function deleteCardioLog(id: string): Promise<void> {
  const { user, supabase } = await getAuth()

  const { error } = await supabase
    .from('cardio_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}
