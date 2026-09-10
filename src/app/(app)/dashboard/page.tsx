import { redirect } from 'next/navigation'
import { getDashboardData } from '@/lib/actions'
import { utcToIstDate } from '@/lib/date'
import DashboardClient from '@/components/dashboard/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  let tasks: { id: string; is_completed: boolean }[] = []
  let workout: { exercises?: { id: string }[] } | null = null
  let weeklyTasks: { id: string; is_completed: boolean; created_at: string }[] = []

  try {
    const data = await getDashboardData()
    tasks = data.tasks
    workout = data.workout
    weeklyTasks = data.weeklyTasks
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return redirect('/')
    console.error('Error loading dashboard data:', error)
  }

  const completed = tasks.filter(t => t.is_completed).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const weeklyCompleted = weeklyTasks.length
  const exerciseCount = workout?.exercises?.length ?? 0

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const buckets = new Map<string, number>()
  for (const t of weeklyTasks) {
    const key = utcToIstDate(t.created_at)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    const key = utcToIstDate(d.toISOString())
    const dow = new Date(key + 'T12:00:00Z').getUTCDay()
    return { name: days[dow], number: buckets.get(key) ?? 0 }
  })

  return (
    <DashboardClient
      completed={completed}
      total={total}
      pct={pct}
      weeklyCompleted={weeklyCompleted}
      chartData={chartData}
      hasWorkout={!!workout}
      exerciseCount={exerciseCount}
    />
  )
}
