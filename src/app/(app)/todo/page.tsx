import { redirect } from 'next/navigation'
import { getTasks } from '@/lib/actions'
import { Task } from '@/types/database'
import TodoClient from './TodoClient'

export const dynamic = 'force-dynamic'

export default async function TodoPage() {
  let initialTasks: Task[] = []
  try {
    initialTasks = await getTasks('all')
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') redirect('/')
  }
  return <TodoClient initialTasks={initialTasks} />
}
