import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardData } from '@/lib/actions'
import { Task, Workout } from '@/types/database'
import DashboardClient from '@/components/dashboard/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  let tasks: Task[] = []
  let workout: Workout | null = null
  let weeklyTasks: Task[] = []

  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return redirect('/')

    const data = await getDashboardData()
    tasks       = data.tasks
    workout     = data.workout
    weeklyTasks = data.weeklyTasks
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return redirect('/')
    console.error('Error loading dashboard data:', error)
  }

  const completed      = tasks.filter(t => t.is_completed).length
  const total          = tasks.length
  const pct            = total > 0 ? Math.round((completed / total) * 100) : 0
  const weeklyCompleted = weeklyTasks.filter(t => t.is_completed).length
  const exerciseCount  = (workout as any)?.exercises?.length ?? 0

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const ds = d.toISOString().split('T')[0]
    return {
      name: days[d.getDay()],
      number: weeklyTasks.filter(t => t.is_completed && t.created_at.startsWith(ds)).length,
    }
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
