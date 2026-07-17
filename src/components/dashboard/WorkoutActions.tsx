'use client'

import { useRouter } from 'next/navigation'

export default function WorkoutActions({ hasWorkout }: { hasWorkout: boolean }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push('/gym')}
      className={`mt-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200
        active:scale-95
        ${hasWorkout
          ? 'bg-emerald-600 hover:bg-emerald-500 hover:brightness-110 hover:shadow-lg hover:shadow-emerald-500/20'
          : 'bg-gray-700 hover:bg-gray-600 hover:brightness-110'
        }`}
    >
      {hasWorkout ? 'View Workout' : 'Go to Gym'}
    </button>
  )
}
