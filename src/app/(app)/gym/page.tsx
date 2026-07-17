'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getAllWorkoutsWithDetails,
  getPersonalRecords,
  addExercise,
  addSet,
  toggleSetComplete,
  type PersonalRecord,
} from '@/lib/actions'
import { type Workout, type Exercise, type WorkoutSet } from '@/types/database'
import { Plus, Dumbbell, Check, X, Loader2, ChevronDown, ChevronUp, Calendar, Trophy } from 'lucide-react'

interface SetFormState {
  exerciseId: string
  weight: string
  reps: string
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

type Tab = 'log' | 'prs'

export default function GymPage() {
  const [tab, setTab]                       = useState<Tab>('log')
  const [workouts, setWorkouts]             = useState<Workout[]>([])
  const [setsMap, setSetsMap]               = useState<Map<string, WorkoutSet[]>>(new Map())
  const [prs, setPrs]                       = useState<PersonalRecord[]>([])
  const [loading, setLoading]               = useState(true)
  const [loadingPrs, setLoadingPrs]         = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [addingExercise, setAddingExercise]   = useState(false)
  const [setForm, setSetForm]               = useState<SetFormState | null>(null)
  const [collapsed, setCollapsed]           = useState<Set<string>>(new Set())

  const today = new Date().toISOString().split('T')[0]

  const fetchWorkouts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAllWorkoutsWithDetails()
      setWorkouts(data)
      const map = new Map<string, WorkoutSet[]>()
      data.forEach(w => (w.exercises || []).forEach(ex => map.set(ex.id, ex.sets || [])))
      setSetsMap(map)
      const pastIds = new Set(data.filter(w => w.date !== today).map(w => w.id))
      setCollapsed(pastIds)
    } catch {
      setError('Failed to load workouts')
    } finally {
      setLoading(false)
    }
  }, [today])

  const fetchPrs = useCallback(async () => {
    setLoadingPrs(true)
    setError(null)
    try {
      setPrs(await getPersonalRecords())
    } catch {
      setError('Failed to load personal records')
    } finally {
      setLoadingPrs(false)
    }
  }, [])

  useEffect(() => { fetchWorkouts() }, [fetchWorkouts])

  useEffect(() => {
    if (tab === 'prs') fetchPrs()
  }, [tab, fetchPrs])

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExerciseName.trim()) return
    setError(null)
    setAddingExercise(true)
    try {
      const ex = await addExercise(newExerciseName.trim())
      setNewExerciseName('')
      setSetsMap(prev => new Map(prev).set(ex!.id, []))
      setWorkouts(prev => {
        const todayWorkout = prev.find(w => w.date === today)
        if (todayWorkout) {
          return prev.map(w =>
            w.date === today
              ? { ...w, exercises: [...(w.exercises || []), { ...ex!, sets: [] }] }
              : w
          )
        }
        return [{ id: ex!.workout_id, user_id: '', date: today, notes: null, created_at: '', updated_at: '', exercises: [{ ...ex!, sets: [] }] }, ...prev]
      })
    } catch {
      setError('Failed to add exercise')
    } finally {
      setAddingExercise(false)
    }
  }

  const handleSubmitSet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setForm) return
    const weight = parseFloat(setForm.weight)
    const reps   = parseInt(setForm.reps, 10)
    if (isNaN(weight) || weight <= 0 || isNaN(reps) || reps <= 0) {
      setError('Enter valid weight and reps')
      return
    }
    setError(null)
    try {
      const newSet = await addSet(setForm.exerciseId, weight, reps)
      setSetsMap(prev => {
        const map = new Map(prev)
        map.set(setForm.exerciseId, [...(map.get(setForm.exerciseId) || []), newSet!])
        return map
      })
      setSetForm(null)
    } catch {
      setError('Failed to add set')
    }
  }

  const handleToggleSet = async (exerciseId: string, setId: string, isCompleted: boolean) => {
    setError(null)
    try {
      await toggleSetComplete(setId)
      setSetsMap(prev => {
        const map = new Map(prev)
        map.set(exerciseId, (map.get(exerciseId) || []).map(s =>
          s.id === setId ? { ...s, is_completed: !isCompleted } : s
        ))
        return map
      })
    } catch {
      setError('Failed to update set')
    }
  }

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="max-w-2xl w-full space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-200">Gym Tracker</h2>
        <p className="text-gray-400 text-sm mt-1">Log exercises and track your sets</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('log')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'log' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Dumbbell className="h-3.5 w-3.5" />
          Workout Log
        </button>
        <button
          onClick={() => setTab('prs')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'prs' ? 'bg-yellow-500 text-gray-900' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          Personal Records
        </button>
      </div>

      {/* ── LOG TAB ────────────────────────────────────────── */}
      {tab === 'log' && (
        <>
          {/* Add exercise form */}
          <form onSubmit={handleAddExercise} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-semibold">Add to today's workout</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newExerciseName}
                onChange={e => setNewExerciseName(e.target.value)}
                placeholder="Exercise name (e.g. Bench Press)"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!newExerciseName.trim() || addingExercise}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
              >
                {addingExercise ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Exercise
              </button>
            </div>
          </form>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            </div>
          ) : workouts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Dumbbell className="h-10 w-10 mx-auto mb-3 text-gray-700" />
              <p className="text-sm">No workouts yet. Add your first exercise above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workouts.map(workout => {
                const exercises: Exercise[] = workout.exercises || []
                const isToday     = workout.date === today
                const isCollapsed = collapsed.has(workout.id)
                const totalSets   = exercises.reduce((a, ex) => a + (setsMap.get(ex.id)?.length ?? 0), 0)
                const doneSets    = exercises.reduce((a, ex) => a + (setsMap.get(ex.id)?.filter(s => s.is_completed).length ?? 0), 0)

                return (
                  <div
                    key={workout.id}
                    className={`bg-gray-900 border rounded-2xl overflow-hidden ${
                      isToday ? 'border-emerald-500/30' : 'border-gray-800'
                    }`}
                  >
                    <button
                      onClick={() => toggleCollapse(workout.id)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isToday ? 'bg-emerald-500/10' : 'bg-gray-800'}`}>
                          <Calendar className={`h-4 w-4 ${isToday ? 'text-emerald-400' : 'text-gray-500'}`} />
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${isToday ? 'text-emerald-400' : 'text-gray-200'}`}>
                            {formatDate(workout.date)}
                            {isToday && <span className="ml-2 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Active</span>}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-1">
                            <span className="hidden sm:inline">{workout.date} ·</span>
                            <span>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
                            <span>· {doneSets}/{totalSets} sets done</span>
                          </p>
                        </div>
                      </div>
                      {isCollapsed
                        ? <ChevronDown className="h-4 w-4 text-gray-500" />
                        : <ChevronUp className="h-4 w-4 text-gray-500" />
                      }
                    </button>

                    {!isCollapsed && (
                      <div className="px-5 pb-5 space-y-4 border-t border-gray-800">
                        {exercises.length === 0 ? (
                          <p className="text-sm text-gray-600 pt-4">No exercises logged yet.</p>
                        ) : (
                          exercises.map(exercise => {
                            const sets = setsMap.get(exercise.id) || []
                            const doneCount = sets.filter(s => s.is_completed).length
                            return (
                              <div key={exercise.id} className="pt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h3 className="text-sm font-semibold text-gray-200">{exercise.name}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {sets.length} set{sets.length !== 1 ? 's' : ''} · {doneCount} done
                                    </p>
                                  </div>
                                  {isToday && (
                                    <button
                                      onClick={() => setSetForm({ exerciseId: exercise.id, weight: '', reps: '' })}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add Set
                                    </button>
                                  )}
                                </div>

                                {setForm?.exerciseId === exercise.id && (
                                  <form
                                    onSubmit={handleSubmitSet}
                                    className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 p-3 bg-gray-800 rounded-xl border border-gray-700"
                                  >
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={setForm.weight}
                                      onChange={e => setSetForm(f => f && { ...f, weight: e.target.value })}
                                      placeholder="Weight (kg)"
                                      required
                                      autoFocus
                                      className="w-full sm:w-32 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={setForm.reps}
                                      onChange={e => setSetForm(f => f && { ...f, reps: e.target.value })}
                                      placeholder="Reps"
                                      required
                                      className="w-full sm:w-24 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                      type="submit"
                                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSetForm(null)}
                                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors flex items-center justify-center"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </form>
                                )}

                                {sets.length === 0 ? (
                                  <p className="text-xs text-gray-600 pl-1">No sets yet</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div className="grid grid-cols-4 text-xs font-medium text-gray-500 uppercase tracking-wider px-3 pb-1">
                                      <span>Set</span>
                                      <span>Weight</span>
                                      <span>Reps</span>
                                      <span className="text-right">Done</span>
                                    </div>
                                    {sets.map((set, i) => (
                                      <div
                                        key={set.id}
                                        className={`grid grid-cols-4 items-center px-3 py-2 rounded-xl text-sm transition-colors ${
                                          set.is_completed
                                            ? 'bg-emerald-500/5 border border-emerald-500/10 text-gray-500'
                                            : 'bg-gray-800 border border-gray-700 text-gray-200'
                                        }`}
                                      >
                                        <span className={`font-semibold ${set.is_completed ? 'text-gray-600' : 'text-gray-300'}`}>
                                          {i + 1}
                                        </span>
                                        <span className={set.is_completed ? 'line-through' : ''}>{set.weight} kg</span>
                                        <span className={set.is_completed ? 'line-through' : ''}>{set.reps} reps</span>
                                        <div className="flex justify-end">
                                          <button
                                            onClick={() => handleToggleSet(exercise.id, set.id, set.is_completed)}
                                            disabled={!isToday}
                                            className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                                              set.is_completed
                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                : isToday
                                                  ? 'border-gray-600 hover:border-emerald-400'
                                                  : 'border-gray-700 opacity-50 cursor-default'
                                            }`}
                                          >
                                            {set.is_completed && <Check className="h-3 w-3" />}
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── PRs TAB ────────────────────────────────────────── */}
      {tab === 'prs' && (
        <>
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
          )}

          {loadingPrs ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
            </div>
          ) : prs.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Trophy className="h-10 w-10 mx-auto mb-3 text-gray-700" />
              <p className="text-sm">No PRs yet. Log some sets to see your records!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                {prs.length} exercise{prs.length !== 1 ? 's' : ''} tracked
              </p>
              {prs.map((pr, i) => (
                <div
                  key={pr.exerciseName}
                  className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 flex items-center gap-4"
                >
                  {/* Rank */}
                  <span className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    i === 1 ? 'bg-gray-400/10 text-gray-400' :
                    i === 2 ? 'bg-orange-500/10 text-orange-400' :
                               'bg-gray-800 text-gray-500'
                  }`}>
                    {i + 1}
                  </span>

                  {/* Exercise name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-200 truncate">{pr.exerciseName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Calendar className="h-3 w-3 text-gray-600" />
                      <p className="text-xs text-gray-500">
                        {formatDate(pr.date)}
                        <span className="hidden sm:inline"> · {pr.date}</span>
                      </p>
                    </div>
                  </div>

                  {/* PR value */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-yellow-400">{pr.weight} kg</p>
                    <p className="text-xs text-gray-500">{pr.reps} reps</p>
                  </div>

                  {/* Trophy for top spot */}
                  {i === 0 && <Trophy className="h-4 w-4 text-yellow-400 flex-shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
