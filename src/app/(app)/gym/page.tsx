'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import {
  getAllWorkoutsWithDetails,
  getPersonalRecords,
  addExercise,
  addSet,
  toggleSetComplete,
  deleteSet,
  deleteExercise,
  getPreviousExerciseDataBatch,
  getUniqueExerciseNames,
  updateExerciseNotes,
  type PersonalRecord,
} from '@/lib/actions'
import { type Workout, type Exercise, type WorkoutSet, type SetType } from '@/types/database'
import ExerciseCombobox from '@/components/gym/ExerciseCombobox'
import RestTimerBar from '@/components/gym/RestTimerBar'
import { getTodayIST, getYesterdayIST } from '@/lib/date'
import { Plus, Dumbbell, Check, X, Loader2, ChevronDown, ChevronUp, Calendar, Trophy, Trash2, StickyNote } from 'lucide-react'

interface SetFormState {
  exerciseId: string
  weight: string
  reps: string
  setType: SetType
}

interface PreviousSession {
  exerciseName: string
  date: string | null
  sets: { weight: number | null; reps: number | null; set_type: SetType }[]
}

const REST_SECONDS = 90

const SET_TYPE_OPTIONS: {
  type: SetType
  label: string
  short: string
  chip: string
  rowBorder: string
}[] = [
  { type: 'warmup',   label: 'Warmup', short: 'W', chip: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',     rowBorder: 'border-l-yellow-500/50' },
  { type: 'working',  label: 'Normal', short: 'N', chip: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',  rowBorder: 'border-l-emerald-500/50' },
  { type: 'drop_set', label: 'Drop',   short: 'D', chip: 'bg-sky-500/10 border-sky-500/20 text-sky-400',             rowBorder: 'border-l-sky-500/50' },
  { type: 'failure',  label: 'Failure',short: 'F', chip: 'bg-red-500/10 border-red-500/20 text-red-400',             rowBorder: 'border-l-red-500/50' },
]

const SET_TYPE_CHIP: Record<SetType, string> = Object.fromEntries(
  SET_TYPE_OPTIONS.map(o => [o.type, o.chip]),
) as Record<SetType, string>

const SET_TYPE_ROW: Record<SetType, string> = Object.fromEntries(
  SET_TYPE_OPTIONS.map(o => [o.type, o.rowBorder]),
) as Record<SetType, string>

function formatDate(dateStr: string): string {
  const today = getTodayIST()
  const yesterday = getYesterdayIST()
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
  const [exerciseNames, setExerciseNames]   = useState<string[]>([])
  const [prevMap, setPrevMap]               = useState<Map<string, PreviousSession>>(new Map())
  const [saving, setSaving]                 = useState(false)

  // Rest timer
  const [restSeconds, setRestSeconds] = useState(0)
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Delete-set transition
  const [isPending, startTransition] = useTransition()

  const today = getTodayIST()

  // ── rest timer countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (restSeconds <= 0) {
      if (restRef.current) { clearInterval(restRef.current); restRef.current = null }
      return
    }
    restRef.current = setInterval(() => {
      setRestSeconds(s => (s > 1 ? s - 1 : 0))
    }, 1000)
    return () => {
      if (restRef.current) { clearInterval(restRef.current); restRef.current = null }
    }
  }, [restSeconds])

  const startRest = (sec = REST_SECONDS) => setRestSeconds(sec)
  const adjustRest = (delta: number) => setRestSeconds(s => Math.max(0, s + delta))
  const stopRest = () => setRestSeconds(0)

  // ── data fetching ───────────────────────────────────────────────────────────
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

      const names = await getUniqueExerciseNames()
      setExerciseNames(names)

      // Batch fetch previous-session data for all exercise names (one query instead of N+1)
      if (names.length > 0) {
        const prevBatch = await getPreviousExerciseDataBatch(names)
        const newPrevMap = new Map<string, PreviousSession>()
        data.forEach(w => (w.exercises || []).forEach(ex => {
          const prev = prevBatch.get(ex.name)
          if (prev && prev.sets.length > 0) newPrevMap.set(ex.id, prev)
        }))
        setPrevMap(newPrevMap)
      }
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

  // ── exercise handlers ────────────────────────────────────────────────────────
  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExerciseName.trim()) return
    setError(null)
    setAddingExercise(true)
    try {
      const ex = await addExercise(newExerciseName.trim())
      if (!ex) throw new Error('Failed to add exercise')
      setNewExerciseName('')
      setSetsMap(prev => new Map(prev).set(ex.id, []))

      setWorkouts(prev => {
        const todayWorkout = prev.find(w => w.date === today)
        if (todayWorkout) {
          return prev.map(w =>
            w.date === today
              ? { ...w, exercises: [...(w.exercises || []), { ...ex, sets: [] }] }
              : w
          )
        }
        return [{ id: ex.workout_id, user_id: '', date: today, notes: null, created_at: '', updated_at: '', exercises: [{ ...ex, sets: [] }] }, ...prev]
      })

      // Pull in the previous session for progressive-overload hints.
      const prevBatch = await getPreviousExerciseDataBatch([ex.name])
      const prev = prevBatch.get(ex.name)
      if (prev) setPrevMap(p => new Map(p).set(ex.id, prev))

      const names = await getUniqueExerciseNames()
      setExerciseNames(names)
    } catch {
      setError('Failed to add exercise')
    } finally {
      setAddingExercise(false)
    }
  }

  const updateLocalExerciseNotes = (exerciseId: string, notes: string | null) => {
    setWorkouts(prev => prev.map(w => ({
      ...w,
      exercises: (w.exercises || []).map(ex =>
        ex.id === exerciseId ? { ...ex, notes } : ex
      ),
    })))
  }

  const handleNotesBlur = async (exerciseId: string, value: string) => {
    const trimmed = value.trim()
    try {
      await updateExerciseNotes(exerciseId, trimmed || null)
      updateLocalExerciseNotes(exerciseId, trimmed || null)
    } catch {
      setError('Failed to save notes')
    }
  }

  // ── set handlers ─────────────────────────────────────────────────────────────
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
    setSaving(true)
    try {
      const newSet = await addSet(setForm.exerciseId, weight, reps, setForm.setType)
      setSetsMap(prev => {
        const map = new Map(prev)
        map.set(setForm.exerciseId, [...(map.get(setForm.exerciseId) || []), newSet!])
        return map
      })
      setSetForm(null)
    } catch {
      setError('Failed to add set')
    } finally {
      setSaving(false)
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
      // Start the rest timer only when a set is completed (not when unchecked).
      if (!isCompleted) startRest(REST_SECONDS)
    } catch {
      setError('Failed to update set')
    }
  }

  const handleDeleteSet = (exerciseId: string, setId: string) => {
    startTransition(async () => {
      setError(null)
      try {
        await deleteSet(setId)
        setSetsMap(prev => {
          const map = new Map(prev)
          map.set(exerciseId, (map.get(exerciseId) || []).filter(s => s.id !== setId))
          return map
        })
      } catch {
        setError('Failed to delete set')
      }
    })
  }

  const handleDeleteExercise = (exerciseId: string) => {
    startTransition(async () => {
      setError(null)
      try {
        await deleteExercise(exerciseId)
        setWorkouts(prev => prev.map(w => ({
          ...w,
          exercises: (w.exercises || []).filter(ex => ex.id !== exerciseId)
        })))
        setSetsMap(prev => {
          const map = new Map(prev)
          map.delete(exerciseId)
          return map
        })
      } catch {
        setError('Failed to delete exercise')
      }
    })
  }

  // ── auto-fill today's empty sets from the previous session ───────────────────
  const autoFillFromPrevious = async (exerciseId: string) => {
    const prev = prevMap.get(exerciseId)
    if (!prev || prev.sets.length === 0) return
    setSaving(true)
    setError(null)
    try {
      for (const s of prev.sets) {
        if (s.weight == null || s.reps == null) continue
        await addSet(exerciseId, Number(s.weight), Number(s.reps), s.set_type)
      }
      await fetchWorkouts()
    } catch {
      setError('Failed to auto-fill sets')
    } finally {
      setSaving(false)
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
    <div className="max-w-2xl w-full space-y-6 pb-24 md:pb-4">

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

      {/* ── LOG TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'log' && (
        <>
          {/* Add exercise form */}
          <form onSubmit={handleAddExercise} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-semibold">Add to today's workout</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <ExerciseCombobox
                value={newExerciseName}
                onChange={setNewExerciseName}
                suggestions={exerciseNames}
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
                            const prev = prevMap.get(exercise.id)

                            return (
                              <div key={exercise.id} className="pt-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-gray-200">{exercise.name}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {sets.length} set{sets.length !== 1 ? 's' : ''} · {doneCount} done
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isToday && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteExercise(exercise.id)}
                                        disabled={isPending}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-red-400/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-medium rounded-lg border border-red-500/10 hover:border-red-500/20 transition-colors"
                                        title="Delete exercise and all its sets"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                      </button>
                                    )}
                                    {prev && prev.sets.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => autoFillFromPrevious(exercise.id)}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors disabled:opacity-50"
                                        title="Copy last session's sets into today"
                                      >
                                        <Plus className="h-3 w-3" />
                                        Auto-fill
                                      </button>
                                    )}
                                    {isToday && (
                                      <button
                                        onClick={() => setSetForm({ exerciseId: exercise.id, weight: '', reps: '', setType: 'working' })}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Set
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Previous session hint */}
                                {prev && prev.sets.length > 0 && (
                                  <div className="text-xs text-gray-500">
                                    <span className="text-gray-600">Last time{prev.date ? ` (${formatDate(prev.date)})` : ''}: </span>
                                    {prev.sets.map((s, i) => (
                                      <span key={i} className="text-gray-400">
                                        {i > 0 ? ', ' : ''}
                                        {s.weight ?? '—'}kg × {s.reps ?? '—'}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Notes (today's exercises only) */}
                                {isToday && (
                                  <div className="mt-1 flex items-start gap-2 rounded-lg bg-gray-800/30 px-3 py-2">
                                    <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-600" />
                                    <input
                                      type="text"
                                      defaultValue={exercise.notes ?? ''}
                                      onBlur={e => handleNotesBlur(exercise.id, e.target.value)}
                                      placeholder="Add a note — e.g. seat at position 4"
                                      className="w-full bg-transparent text-sm text-gray-400 placeholder:text-gray-600 focus:text-gray-200 focus:outline-none"
                                    />
                                  </div>
                                )}

                                {/* Set form */}
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
                                    {/* Set type selector */}
                                    <div className="col-span-2 sm:col-span-1 flex gap-1">
                                      {SET_TYPE_OPTIONS.map(o => (
                                        <button
                                          key={o.type}
                                          type="button"
                                          onClick={() => setSetForm(f => f && { ...f, setType: o.type })}
                                          title={o.label}
                                          className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                            setForm.setType === o.type
                                              ? o.chip
                                              : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300'
                                          }`}
                                        >
                                          {o.short}
                                        </button>
                                      ))}
                                    </div>
                                    <button
                                      type="submit"
                                      disabled={saving}
                                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
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

                                {/* Set rows */}
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
                                        className={`grid grid-cols-4 items-center px-3 py-2 rounded-xl text-sm border-l-2 transition-colors ${
                                          set.is_completed
                                            ? 'bg-emerald-500/5 border-gray-800 text-gray-500'
                                            : `bg-gray-800 border-gray-700 ${SET_TYPE_ROW[set.set_type]} text-gray-200`
                                        }`}
                                      >
                                        <span className="flex items-center gap-2">
                                          <span className={`font-semibold ${set.is_completed ? 'text-gray-600' : 'text-gray-300'}`}>
                                            {i + 1}
                                          </span>
                                          <span className={`text-[10px] uppercase font-bold px-1 py-0.5 rounded ${SET_TYPE_CHIP[set.set_type]}`}>
                                            {set.set_type === 'drop_set' ? 'D' : set.set_type === 'working' ? 'N' : set.set_type === 'warmup' ? 'W' : 'F'}
                                          </span>
                                        </span>
                                        <span className={set.is_completed ? 'line-through' : ''}>{set.weight} kg</span>
                                        <span className={set.is_completed ? 'line-through' : ''}>{set.reps} reps</span>
                                        <div className="flex justify-end gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteSet(exercise.id, set.id)}
                                            disabled={!isToday || isPending}
                                            title="Delete set"
                                            className={`h-5 w-5 flex items-center justify-center transition-colors ${
                                              isToday
                                                ? 'text-gray-500 hover:text-red-400'
                                                : 'text-gray-700 opacity-40 cursor-default'
                                            }`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
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

                                {/* Metrics removed — card ends cleanly after the last set */}
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

      {/* ── PRs TAB ─────────────────────────────────────────────────────────── */}
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

      {/* Floating rest timer */}
      {restSeconds > 0 && (
        <RestTimerBar seconds={restSeconds} onAdjust={adjustRest} onStop={stopRest} />
      )}
    </div>
  )
}
