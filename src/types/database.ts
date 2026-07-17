export interface User {
  id: string
  email: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  priority: 'low' | 'medium' | 'high'
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface Workout {
  id: string
  user_id: string
  date: string
  notes: string | null
  created_at: string
  updated_at: string
  exercises?: Exercise[]
}

export interface Exercise {
  id: string
  workout_id: string
  name: string
  created_at: string
  updated_at: string
  sets?: WorkoutSet[]
}

export type ActivityType = 'run' | 'walk' | 'warmup' | 'cycle' | 'other'

export interface CardioLog {
  id: string
  user_id: string
  date: string
  activity_type: ActivityType
  duration_minutes: number
  distance_km: number | null
  steps: number | null
  notes: string | null
  created_at: string
}

export interface WorkoutSet {
  id: string
  exercise_id: string
  weight: number | null
  reps: number | null
  is_completed: boolean
  created_at: string
  updated_at: string
}
