'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTasks, addTask, toggleTaskComplete, deleteTask } from '@/lib/actions'
import { Task } from '@/types/database'
import { Plus, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react'

type Filter = 'all' | 'active' | 'completed'
type Priority = 'low' | 'medium' | 'high'

const PRIORITY_STYLES: Record<Priority, string> = {
  high:   'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low:    'bg-green-500/10 text-green-400 border-green-500/20',
}

export default function TodoPage() {
  const [filter, setFilter]     = useState<Filter>('all')
  const [tasks, setTasks]       = useState<Task[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [newTask, setNewTask]   = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [adding, setAdding]     = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTasks(await getTasks(filter))
    } catch {
      setError('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.trim()) return
    setAdding(true)
    setError(null)
    try {
      await addTask(newTask.trim(), priority)
      setNewTask('')
      await fetchTasks()
    } catch {
      setError('Failed to add task')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (id: string, isCompleted: boolean) => {
    setError(null)
    try {
      await toggleTaskComplete(id, isCompleted)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, is_completed: !isCompleted } : t))
    } catch {
      setError('Failed to update task')
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      await deleteTask(id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch {
      setError('Failed to delete task')
    }
  }

  const remaining = tasks.filter(t => !t.is_completed).length

  return (
    <div className="max-w-2xl w-full space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-200">My Todos</h2>
        <p className="text-gray-400 text-sm mt-1">
          {remaining} task{remaining !== 1 ? 's' : ''} remaining
        </p>
      </div>

      {/* Add task */}
      <form onSubmit={handleAdd} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
        <input
          type="text"
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          placeholder="What needs to be done?"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {(['low', 'medium', 'high'] as Priority[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium border capitalize transition-all ${
                  priority === p
                    ? PRIORITY_STYLES[p] + ' ring-1 ring-current'
                    : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={!newTask.trim() || adding}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Add Task</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </form>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {(['all', 'active', 'completed'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              filter === f ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-gray-700" />
          <p className="text-sm">No tasks here. Add one above!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              className={`group flex items-center gap-4 p-4 rounded-xl border transition-all ${
                task.is_completed
                  ? 'bg-gray-900/50 border-gray-800 opacity-60'
                  : 'bg-gray-900 border-gray-800 hover:border-gray-700'
              }`}
            >
              <button
                onClick={() => handleToggle(task.id, task.is_completed)}
                className="flex-shrink-0"
              >
                {task.is_completed
                  ? <CheckCircle2 className="h-5 w-5 text-indigo-400" />
                  : <Circle className="h-5 w-5 text-gray-600 hover:text-indigo-400 transition-colors" />
                }
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  task.is_completed ? 'line-through text-gray-500' : 'text-gray-100'
                }`}>
                  {task.title}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {new Date(task.created_at).toLocaleDateString()}
                </p>
              </div>

              <span className={`px-2 py-0.5 text-xs rounded-full border capitalize flex-shrink-0 ${
                PRIORITY_STYLES[task.priority as Priority] ?? 'bg-gray-800 text-gray-400 border-gray-700'
              }`}>
                {task.priority}
              </span>

              <button
                onClick={() => handleDelete(task.id)}
                className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
