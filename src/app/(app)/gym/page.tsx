import { redirect } from 'next/navigation'
import { getInitialGymData } from '@/lib/actions'
import { Workout } from '@/types/database'
import { SetType } from '@/types/database'
import GymClient from './GymClient'

export const dynamic = 'force-dynamic'

export default async function GymPage() {
  let workouts: Workout[] = []
  let exerciseNames: string[] = []
  let prevData: Map<string, { exerciseName: string; sets: { weight: number | null; reps: number | null; set_type: SetType }[]; date: string | null }> = new Map()

  try {
    const data = await getInitialGymData()
    workouts      = data.workouts
    exerciseNames = data.exerciseNames
    prevData      = data.prevData
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') redirect('/')
  }

  // Maps can't be serialised as JSON props — convert to plain array of entries
  const prevEntries = Array.from(prevData.entries())

  return (
    <GymClient
      initialWorkouts={workouts}
      initialExerciseNames={exerciseNames}
      initialPrevEntries={prevEntries}
    />
  )
}
