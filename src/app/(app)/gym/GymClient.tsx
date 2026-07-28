'use client'

import { useState, useEffect, useCallback, useRef, useTransition, useMemo } from 'react'
import {
  getPersonalRecords, addExercise, addExerciseToDate, addSet, toggleSetComplete,
  deleteSet, deleteExercise, deleteWorkout,
  getPreviousExerciseDataBatch, updateExerciseNotes,
  getInitialGymData, type PersonalRecord,
} from '@/lib/actions'
import { type Workout, type Exercise, type WorkoutSet, type SetType } from '@/types/database'
import ExerciseCombobox from '@/components/gym/ExerciseCombobox'
import RestTimerBar from '@/components/gym/RestTimerBar'
import { getTodayIST, getYesterdayIST } from '@/lib/date'
import {
  Plus, Dumbbell, Check, X, Loader2, ChevronDown, ChevronUp,
  Calendar, Trophy, Trash2, StickyNote, TrendingUp, TrendingDown,
  Copy, Minus, Clock, Target, Zap, CheckCheck, Edit2, BarChart2,
  Medal, ArrowUpRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PreviousSession {
  exerciseName: string
  date: string | null
  sets: { weight: number | null; reps: number | null; set_type: SetType }[]
}

interface InlineForm {
  exerciseId: string
  weight: string
  reps: string
  setType: SetType
}

// ── Constants ──────────────────────────────────────────────────────────────────

const REST_SECONDS = 90
const BAR_KG = 20

const SET_TYPES: { type: SetType; label: string; short: string; chip: string; border: string }[] = [
  { type: 'warmup',   label: 'Warmup',  short: 'W', chip: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',    border: 'border-l-yellow-500/60' },
  { type: 'working',  label: 'Normal',  short: 'N', chip: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', border: 'border-l-emerald-500/60' },
  { type: 'drop_set', label: 'Drop',    short: 'D', chip: 'bg-sky-500/15 border-sky-500/30 text-sky-400',             border: 'border-l-sky-500/60' },
  { type: 'failure',  label: 'Failure', short: 'F', chip: 'bg-red-500/15 border-red-500/30 text-red-400',             border: 'border-l-red-500/60' },
]

const CHIP:   Record<SetType, string> = Object.fromEntries(SET_TYPES.map(o => [o.type, o.chip]))   as Record<SetType, string>
const BORDER: Record<SetType, string> = Object.fromEntries(SET_TYPES.map(o => [o.type, o.border])) as Record<SetType, string>

// ── Pure helpers ───────────────────────────────────────────────────────────────

function epley(weight: number, reps: number) {
  if (reps <= 1) return Math.round(weight)
  return Math.round(weight * (1 + reps / 30))
}

function platesPerSide(total: number): number[] {
  const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]
  const side = (total - BAR_KG) / 2
  if (side <= 0) return []
  const result: number[] = []
  let rem = side
  for (const p of PLATES) {
    while (rem >= p - 0.01) { result.push(p); rem -= p }
  }
  return result
}

function calcVolume(sets: { weight: number | null; reps: number | null; is_completed: boolean }[]): number {
  return sets.filter(s => s.is_completed && s.weight && s.reps)
    .reduce((sum, s) => sum + s.weight! * s.reps!, 0)
}

function formatDate(d: string): string {
  const today = getTodayIST()
  const yesterday = getYesterdayIST()
  if (d === today) return 'Today'
  if (d === yesterday) return 'Yesterday'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressRing({ done, total, size = 38 }: { done: number; total: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? Math.min(1, done / total) : 0
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={pct >= 1 ? '#34d399' : '#6ee7b7'}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.35s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-300 leading-none">
        {total > 0 ? `${done}` : '0'}
      </span>
    </div>
  )
}

const PLATE_COLOR: Record<number, string> = {
  25: 'bg-red-500 text-white',
  20: 'bg-blue-500 text-white',
  15: 'bg-yellow-400 text-gray-900',
  10: 'bg-green-500 text-white',
  5:  'bg-white text-gray-900',
  2.5: 'bg-gray-300 text-gray-900',
  1.25: 'bg-gray-500 text-white',
}

function PlateDisplay({ kg }: { kg: number }) {
  if (kg <= 0) return null
  if (kg < BAR_KG) return <p className="text-[11px] text-amber-400/70 mt-1">⚠ Less than bar weight ({BAR_KG} kg)</p>
  if (kg === BAR_KG) return <p className="text-[11px] text-gray-500 mt-1">Bar only ({BAR_KG} kg)</p>
  const plates = platesPerSide(kg)
  if (!plates.length) return null
  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">Per side:</span>
      {plates.map((p, i) => (
        <span key={i} className={`${PLATE_COLOR[p] ?? 'bg-gray-600 text-white'} text-[10px] font-bold px-1.5 py-0.5 rounded`}>
          {p}
        </span>
      ))}
    </div>
  )
}

// ── Stepper input ──────────────────────────────────────────────────────────────
function Stepper({ label, value, onChange, step, min, className = '' }: {
  label: string; value: string; onChange: (v: string) => void
  step: number; min: number; className?: string
}) {
  const num = parseFloat(value) || 0
  const dec = step < 1 ? 1 : 0
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</label>
      <div className="flex items-center gap-1">
        <button type="button"
          onClick={() => onChange(String(Math.max(min, +(num - step).toFixed(dec))))}
          className="h-8 w-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
        ><Minus className="h-3.5 w-3.5" /></button>
        <input
          type="number" min={min} step={step} value={value}
          onChange={e => onChange(e.target.value)} required
          className="w-20 text-center bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-gray-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button type="button"
          onClick={() => onChange(String(+(num + step).toFixed(dec)))}
          className="h-8 w-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
        ><Plus className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type Tab = 'log' | 'prs'

interface Props {
  initialWorkouts: Workout[]
  initialExerciseNames: string[]
  initialPrevEntries: [string, PreviousSession][]
}

export default function GymClient({ initialWorkouts, initialExerciseNames, initialPrevEntries }: Props) {
  const today = getTodayIST()

  const buildSetsMap = (ws: Workout[]) => {
    const m = new Map<string, WorkoutSet[]>()
    ws.forEach(w => (w.exercises || []).forEach(ex => m.set(ex.id, ex.sets || [])))
    return m
  }
  const buildCollapsed = (ws: Workout[]) =>
    new Set(ws.filter(w => w.date !== today).map(w => w.id))
  const buildPrevMap = (entries: [string, PreviousSession][], ws: Workout[]) => {
    const byName = new Map(entries)
    const m = new Map<string, PreviousSession>()
    ws.forEach(w => (w.exercises || []).forEach(ex => {
      const p = byName.get(ex.name)
      if (p) m.set(ex.id, p)
    }))
    return m
  }

  // ── state ──────────────────────────────────────────────────────────────────
  const [tab, setTab]                     = useState<Tab>('log')
  const [workouts, setWorkouts]           = useState(initialWorkouts)
  const [setsMap, setSetsMap]             = useState(() => buildSetsMap(initialWorkouts))
  const [prs, setPrs]                     = useState<PersonalRecord[]>([])
  const [loadingPrs, setLoadingPrs]       = useState(false)
  const [prSearch, setPrSearch]           = useState('')
  const [prSort, setPrSort]               = useState<'name' | 'weight' | 'orm' | 'date'>('weight')
  const [error, setError]                 = useState<string | null>(null)
  const [newExName, setNewExName]         = useState('')
  const [addingEx, setAddingEx]           = useState(false)
  const [inlineForm, setInlineForm]       = useState<InlineForm | null>(null)
  const [collapsed, setCollapsed]         = useState(() => buildCollapsed(initialWorkouts))
  const [exerciseNames, setExerciseNames] = useState(initialExerciseNames)
  const [prevMap, setPrevMap]             = useState(() => buildPrevMap(initialPrevEntries, initialWorkouts))
  const [saving, setSaving]               = useState(false)
  const [elapsed, setElapsed]             = useState(0)
  const startRef                          = useRef<number | null>(null)
  const [restSecs, setRestSecs]           = useState(0)
  const restRef                           = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isPending, startTransition]      = useTransition()

  // past-workout edit state
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null)
  const [pastExName, setPastExName]             = useState('')
  const [addingPastEx, setAddingPastEx]         = useState(false)
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null)

  // ── derived ────────────────────────────────────────────────────────────────
  const todayWorkout = useMemo(() => workouts.find(w => w.date === today), [workouts, today])
  const todayStats = useMemo(() => {
    const exs = todayWorkout?.exercises || []
    let volume = 0, totalSets = 0, doneSets = 0
    for (const ex of exs) {
      const sets = setsMap.get(ex.id) || []
      totalSets += sets.length
      doneSets  += sets.filter(s => s.is_completed).length
      volume    += calcVolume(sets)
    }
    return { volume, totalSets, doneSets, exCount: exs.length }
  }, [todayWorkout, setsMap])

  // ── elapsed timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const wo = workouts.find(w => w.date === today)
    if (!wo) return
    let earliest: number | null = null
    for (const ex of wo.exercises || []) {
      for (const s of setsMap.get(ex.id) || []) {
        if (s.is_completed && s.created_at) {
          const t = new Date(s.created_at).getTime()
          if (!earliest || t < earliest) earliest = t
        }
      }
    }
    if (earliest) startRef.current = earliest
  }, [workouts, setsMap, today])

  useEffect(() => {
    const id = setInterval(() => {
      if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── rest timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (restSecs <= 0) {
      if (restRef.current) { clearInterval(restRef.current); restRef.current = null }
      return
    }
    restRef.current = setInterval(() => setRestSecs(s => s > 1 ? s - 1 : 0), 1000)
    return () => { if (restRef.current) { clearInterval(restRef.current); restRef.current = null } }
  }, [restSecs])

  const adjustRest = (d: number) => setRestSecs(s => Math.max(0, s + d))

  // ── refresh ────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const data = await getInitialGymData()
      setWorkouts(data.workouts)
      setSetsMap(buildSetsMap(data.workouts))
      setCollapsed(buildCollapsed(data.workouts))
      setExerciseNames(data.exerciseNames)
      setPrevMap(buildPrevMap(Array.from(data.prevData.entries()), data.workouts))
    } catch { setError('Failed to refresh') }
  }, [])

  // ── PRs ────────────────────────────────────────────────────────────────────
  const fetchPrs = useCallback(async () => {
    setLoadingPrs(true)
    try { setPrs(await getPersonalRecords()) }
    catch { setError('Failed to load records') }
    finally { setLoadingPrs(false) }
  }, [])

  useEffect(() => { if (tab === 'prs') fetchPrs() }, [tab, fetchPrs])

  const filteredPrs = useMemo(() => {
    const q = prSearch.toLowerCase()
    const list = q ? prs.filter(p => p.exerciseName.toLowerCase().includes(q)) : prs
    return [...list].sort((a, b) => {
      if (prSort === 'name')   return a.exerciseName.localeCompare(b.exerciseName)
      if (prSort === 'weight') return b.weight - a.weight
      if (prSort === 'orm')    return epley(b.weight, b.reps) - epley(a.weight, a.reps)
      if (prSort === 'date')   return b.date.localeCompare(a.date)
      return 0
    })
  }, [prs, prSearch, prSort])

  // ── open inline form ───────────────────────────────────────────────────────
  const openInlineForm = useCallback((exerciseId: string, prev?: PreviousSession) => {
    if (inlineForm?.exerciseId === exerciseId) { setInlineForm(null); return }
    const existing = setsMap.get(exerciseId) || []
    const lastSet  = existing[existing.length - 1]
    const lastPrev = prev?.sets?.[0]
    setInlineForm({
      exerciseId,
      weight:  (lastSet?.weight  ?? lastPrev?.weight)?.toString()  ?? '',
      reps:    (lastSet?.reps    ?? lastPrev?.reps)?.toString()    ?? '',
      setType: lastSet?.set_type ?? lastPrev?.set_type ?? 'working',
    })
  }, [inlineForm, setsMap])

  // ── add exercise (today) ───────────────────────────────────────────────────
  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExName.trim()) return
    setError(null); setAddingEx(true)
    try {
      const ex = await addExercise(newExName.trim())
      if (!ex) throw new Error()
      setNewExName('')
      setSetsMap(prev => new Map(prev).set(ex.id, []))
      setWorkouts(prev => {
        const tw = prev.find(w => w.date === today)
        if (tw) return prev.map(w => w.date === today
          ? { ...w, exercises: [...(w.exercises || []), { ...ex, sets: [] }] } : w)
        return [{ id: ex.workout_id, user_id: '', date: today, notes: null, created_at: '', updated_at: '', exercises: [{ ...ex, sets: [] }] }, ...prev]
      })
      setExerciseNames(prev => prev.includes(ex.name) ? prev : [...prev, ex.name].sort())
      const prevBatch = await getPreviousExerciseDataBatch([ex.name])
      const prevData  = prevBatch.get(ex.name)
      if (prevData) setPrevMap(p => new Map(p).set(ex.id, prevData))
      setInlineForm({
        exerciseId: ex.id,
        weight:  prevData?.sets[0]?.weight?.toString()  ?? '',
        reps:    prevData?.sets[0]?.reps?.toString()    ?? '',
        setType: prevData?.sets[0]?.set_type ?? 'working',
      })
    } catch { setError('Failed to add exercise') }
    finally { setAddingEx(false) }
  }

  // ── add exercise to past workout ──────────────────────────────────────────
  const handleAddPastExercise = async (e: React.FormEvent, workoutDate: string) => {
    e.preventDefault()
    if (!pastExName.trim()) return
    setError(null); setAddingPastEx(true)
    try {
      const ex = await addExerciseToDate(pastExName.trim(), workoutDate)
      setPastExName('')
      setSetsMap(prev => new Map(prev).set(ex.id, []))
      setWorkouts(prev => prev.map(w => w.date === workoutDate
        ? { ...w, exercises: [...(w.exercises || []), { ...ex, sets: [] }] }
        : w
      ))
      setExerciseNames(prev => prev.includes(ex.name) ? prev : [...prev, ex.name].sort())
      openInlineForm(ex.id)
    } catch { setError('Failed to add exercise') }
    finally { setAddingPastEx(false) }
  }


  // ── delete whole workout ───────────────────────────────────────────────────
  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Delete this entire workout and all its sets? This cannot be undone.')) return
    setDeletingWorkoutId(workoutId)
    const workout = workouts.find(w => w.id === workoutId)
    // Optimistic remove
    setWorkouts(prev => prev.filter(w => w.id !== workoutId))
    if (workout) {
      setSetsMap(prev => {
        const map = new Map(prev)
        for (const ex of workout.exercises || []) map.delete(ex.id)
        return map
      })
    }
    try { await deleteWorkout(workoutId) }
    catch { setError('Failed to delete workout'); refresh() }
    finally { setDeletingWorkoutId(null) }
  }

  // ── submit set ─────────────────────────────────────────────────────────────
  const handleSubmitSet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inlineForm) return
    const weight = parseFloat(inlineForm.weight)
    const reps   = parseInt(inlineForm.reps, 10)
    if (isNaN(weight) || weight <= 0 || isNaN(reps) || reps <= 0) {
      setError('Enter valid weight and reps'); return
    }
    setError(null); setSaving(true)
    try {
      const newSet = await addSet(inlineForm.exerciseId, weight, reps, inlineForm.setType)
      if (!newSet) throw new Error()
      setSetsMap(prev => {
        const map = new Map(prev)
        map.set(inlineForm.exerciseId, [...(map.get(inlineForm.exerciseId) || []), newSet])
        return map
      })
    } catch { setError('Failed to log set') }
    finally { setSaving(false) }
  }

  // ── toggle set ─────────────────────────────────────────────────────────────
  const handleToggle = async (exerciseId: string, setId: string, isCompleted: boolean) => {
    setSetsMap(prev => {
      const map = new Map(prev)
      map.set(exerciseId, (map.get(exerciseId) || []).map(s =>
        s.id === setId ? { ...s, is_completed: !isCompleted } : s
      ))
      return map
    })
    try {
      await toggleSetComplete(setId)
      if (!isCompleted) { setRestSecs(REST_SECONDS); if (!startRef.current) startRef.current = Date.now() }
    } catch {
      setSetsMap(prev => {
        const map = new Map(prev)
        map.set(exerciseId, (map.get(exerciseId) || []).map(s =>
          s.id === setId ? { ...s, is_completed: isCompleted } : s
        ))
        return map
      })
      setError('Failed to update set')
    }
  }

  // ── delete set ─────────────────────────────────────────────────────────────
  const handleDeleteSet = (exerciseId: string, setId: string) => {
    startTransition(async () => {
      setSetsMap(prev => {
        const map = new Map(prev)
        map.set(exerciseId, (map.get(exerciseId) || []).filter(s => s.id !== setId))
        return map
      })
      try { await deleteSet(setId) }
      catch { setError('Failed to delete set'); refresh() }
    })
  }

  // ── delete exercise ────────────────────────────────────────────────────────
  const handleDeleteExercise = (exerciseId: string) => {
    startTransition(async () => {
      if (inlineForm?.exerciseId === exerciseId) setInlineForm(null)
      setWorkouts(prev => prev.map(w => ({
        ...w, exercises: (w.exercises || []).filter(ex => ex.id !== exerciseId),
      })))
      setSetsMap(prev => { const m = new Map(prev); m.delete(exerciseId); return m })
      try { await deleteExercise(exerciseId) }
      catch { setError('Failed to delete exercise'); refresh() }
    })
  }

  // ── notes ──────────────────────────────────────────────────────────────────
  const handleNotesBlur = async (exerciseId: string, val: string) => {
    const trimmed = val.trim()
    try {
      await updateExerciseNotes(exerciseId, trimmed || null)
      setWorkouts(prev => prev.map(w => ({
        ...w, exercises: (w.exercises || []).map(ex =>
          ex.id === exerciseId ? { ...ex, notes: trimmed || null } : ex),
      })))
    } catch { setError('Failed to save notes') }
  }

  // ── auto-fill ──────────────────────────────────────────────────────────────
  const autoFill = async (exerciseId: string) => {
    const prev = prevMap.get(exerciseId)
    if (!prev?.sets.length) return
    setSaving(true)
    try {
      const added = (await Promise.all(
        prev.sets.filter(s => s.weight != null && s.reps != null)
          .map(s => addSet(exerciseId, s.weight!, s.reps!, s.set_type))
      )).filter(Boolean) as WorkoutSet[]
      setSetsMap(prev => {
        const map = new Map(prev)
        map.set(exerciseId, [...(map.get(exerciseId) || []), ...added])
        return map
      })
    } catch { setError('Failed to auto-fill') }
    finally { setSaving(false) }
  }

  // ── duplicate last set ─────────────────────────────────────────────────────
  const duplicateLast = async (exerciseId: string) => {
    const sets = setsMap.get(exerciseId) || []
    const last = sets[sets.length - 1]
    if (!last?.weight || !last?.reps) return
    setSaving(true)
    try {
      const newSet = await addSet(exerciseId, last.weight, last.reps, last.set_type)
      if (newSet) setSetsMap(prev => {
        const map = new Map(prev)
        map.set(exerciseId, [...(map.get(exerciseId) || []), newSet])
        return map
      })
    } catch { setError('Failed to duplicate set') }
    finally { setSaving(false) }
  }

  const toggleCollapse = (id: string) => setCollapsed(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl w-full space-y-5 pb-24 md:pb-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Gym Tracker</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {formatDate(today)}
            {elapsed > 0 && todayStats.doneSets > 0 && (
              <span className="ml-2 text-emerald-500 font-semibold">{fmtDuration(elapsed)}</span>
            )}
          </p>
        </div>
        {todayStats.volume > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">
              {todayStats.volume >= 1000
                ? `${(todayStats.volume / 1000).toFixed(1)}t`
                : `${todayStats.volume.toLocaleString()} kg`}
            </p>
            <p className="text-[11px] text-gray-600 uppercase tracking-wide font-medium">volume</p>
          </div>
        )}
      </div>

      {/* ── Today stats bar ────────────────────────────────────────────────── */}
      {todayWorkout && todayStats.exCount > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Dumbbell, label: 'Exercises', value: String(todayStats.exCount),                      color: 'text-emerald-400' },
            { icon: Target,   label: 'Sets',      value: `${todayStats.doneSets}/${todayStats.totalSets}`, color: 'text-blue-400'   },
            { icon: Clock,    label: 'Duration',  value: elapsed > 0 ? fmtDuration(elapsed) : '—',        color: 'text-purple-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
              <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
              <div className="min-w-0">
                <p className={`text-sm font-bold tabular-nums truncate ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-600 uppercase tracking-wide font-medium">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {([
          { key: 'log', icon: Dumbbell, label: 'Workout Log', active: 'bg-emerald-600 text-white' },
          { key: 'prs', icon: Trophy,   label: 'Records',     active: 'bg-amber-500 text-gray-900' },
        ] as const).map(({ key, icon: Icon, label, active }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === key ? active : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── Error toast ────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 flex-shrink-0 hover:text-red-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ══════════════════════ LOG TAB ══════════════════════════════════════ */}
      {tab === 'log' && (
        <>
          {/* Add exercise to TODAY */}
          <form onSubmit={handleAddExercise} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-[11px] text-gray-500 mb-3 uppercase tracking-widest font-semibold">Add to today's workout</p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <ExerciseCombobox value={newExName} onChange={setNewExName} suggestions={exerciseNames} />
              <button type="submit" disabled={!newExName.trim() || addingEx}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                {addingEx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </div>
          </form>

          {workouts.length === 0 ? (
            <div className="text-center py-20">
              <Dumbbell className="h-12 w-12 mx-auto mb-3 text-gray-800" />
              <p className="text-sm font-medium text-gray-400">No workouts yet</p>
              <p className="text-xs mt-1 text-gray-600">Add your first exercise above to start tracking</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map(workout => {
                const exercises: Exercise[] = workout.exercises || []
                const isToday     = workout.date === today
                const isCollapsed = collapsed.has(workout.id)
                const isEditing   = editingWorkoutId === workout.id
                const sessTotal   = exercises.reduce((a, ex) => a + (setsMap.get(ex.id)?.length ?? 0), 0)
                const sessDone    = exercises.reduce((a, ex) => a + (setsMap.get(ex.id)?.filter(s => s.is_completed).length ?? 0), 0)
                const sessVol     = exercises.reduce((a, ex) => a + calcVolume(setsMap.get(ex.id) || []), 0)
                const pct         = sessTotal > 0 ? Math.round((sessDone / sessTotal) * 100) : 0
                const allDone     = sessTotal > 0 && sessDone === sessTotal

                return (
                  <div key={workout.id}
                    className={`bg-gray-900 border rounded-2xl overflow-hidden ${
                      isToday ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5' : 'border-gray-800'
                    }`}
                  >
                    {/* Workout row header */}
                    <div className="flex items-center gap-0">
                      <button onClick={() => toggleCollapse(workout.id)}
                        className="flex-1 flex items-center gap-3 px-5 py-4 hover:bg-gray-800/30 transition-colors text-left"
                      >
                        <div className={`p-2 rounded-xl flex-shrink-0 ${
                          allDone ? 'bg-emerald-500/15' : isToday ? 'bg-emerald-500/10' : 'bg-gray-800'
                        }`}>
                          {allDone
                            ? <CheckCheck className="h-4 w-4 text-emerald-400" />
                            : <Calendar className={`h-4 w-4 ${isToday ? 'text-emerald-400' : 'text-gray-500'}`} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-bold ${isToday ? 'text-emerald-400' : 'text-gray-200'}`}>
                              {formatDate(workout.date)}
                            </span>
                            {isToday && (
                              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                                Active
                              </span>
                            )}
                            {allDone && !isToday && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/15 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                                Done
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                            <span>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
                            <span>·</span><span>{sessDone}/{sessTotal} sets</span>
                            {sessVol > 0 && (
                              <><span>·</span>
                                <span className="text-gray-400 font-semibold tabular-nums">{sessVol.toLocaleString()} kg</span>
                              </>
                            )}
                          </div>
                        </div>
                        {isToday && sessTotal > 0 && (
                          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 tabular-nums w-8">{pct}%</span>
                          </div>
                        )}
                        {isCollapsed ? <ChevronDown className="h-4 w-4 text-gray-600 flex-shrink-0" /> : <ChevronUp className="h-4 w-4 text-gray-600 flex-shrink-0" />}
                      </button>

                      {/* Past workout edit toggle — only for non-today */}
                      {!isToday && (
                        <button
                          onClick={() => {
                            setEditingWorkoutId(isEditing ? null : workout.id)
                            if (!isEditing && isCollapsed) toggleCollapse(workout.id)
                          }}
                          title={isEditing ? 'Stop editing' : 'Edit this workout'}
                          className={`mr-2 p-2 rounded-xl transition-colors flex-shrink-0 ${
                            isEditing
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                              : 'text-gray-600 hover:text-indigo-400 hover:bg-indigo-500/10'
                          }`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Expanded body */}
                    {!isCollapsed && (
                      <div className="border-t border-gray-800/60">

                        {/* Past-workout actions bar */}
                        {!isToday && isEditing && (
                          <div className="px-5 py-3 bg-indigo-500/5 border-b border-indigo-500/10 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-indigo-400 font-semibold uppercase tracking-wide flex items-center gap-1.5">
                              <Edit2 className="h-3 w-3" />Editing past workout
                            </span>
                            <div className="flex items-center gap-2 ml-auto flex-wrap">
                              {/* Delete whole workout */}
                              <button
                                type="button"
                                onClick={() => handleDeleteWorkout(workout.id)}
                                disabled={deletingWorkoutId === workout.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg border border-red-500/10 transition-colors disabled:opacity-50"
                              >
                                {deletingWorkoutId === workout.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />
                                }
                                Delete workout
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Exercises list */}
                        <div className="divide-y divide-gray-800/40">
                          {exercises.length === 0 ? (
                            <p className="px-5 py-4 text-sm text-gray-600">No exercises logged yet.</p>
                          ) : exercises.map(exercise => {
                            const sets      = setsMap.get(exercise.id) || []
                            const doneCount = sets.filter(s => s.is_completed).length
                            const volume    = calcVolume(sets)
                            const prev      = prevMap.get(exercise.id)
                            const prevVol   = prev ? calcVolume(prev.sets.map(s => ({ ...s, is_completed: true }))) : 0
                            const volDelta  = prevVol > 0 ? volume - prevVol : null
                            const best1RM   = sets.filter(s => s.is_completed && s.weight && s.reps)
                              .reduce((b, s) => Math.max(b, epley(s.weight!, s.reps!)), 0)
                            const canEdit   = isToday || isEditing

                            return (
                              <div key={exercise.id} className="px-5 py-4 space-y-3">
                                {/* Exercise header */}
                                <div className="flex items-center gap-3">
                                  <ProgressRing done={doneCount} total={sets.length} size={38} />
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-gray-100">{exercise.name}</h3>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      {volume > 0 && <span className="text-xs text-gray-400 font-semibold tabular-nums">{volume.toLocaleString()} kg</span>}
                                      {volDelta !== null && volume > 0 && (
                                        <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${volDelta > 0 ? 'text-emerald-400' : volDelta < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                          {volDelta > 0 ? <TrendingUp className="h-3 w-3" /> : volDelta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                          {volDelta > 0 ? '+' : ''}{volDelta.toLocaleString()} kg
                                        </span>
                                      )}
                                      {best1RM > 0 && (
                                        <span className="flex items-center gap-0.5 text-[11px] text-amber-400 font-semibold">
                                          <Zap className="h-3 w-3" />~{best1RM} kg 1RM
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {/* Action buttons */}
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {canEdit && prev?.sets.length && !sets.length && (
                                      <button type="button" onClick={() => autoFill(exercise.id)} disabled={saving}
                                        title="Copy last session's sets"
                                        className="flex items-center gap-1 px-2 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-lg border border-indigo-500/20 transition-colors disabled:opacity-40"
                                      ><Copy className="h-3 w-3" />Copy</button>
                                    )}
                                    {canEdit && sets.length > 0 && (
                                      <button type="button" onClick={() => duplicateLast(exercise.id)} disabled={saving}
                                        title="Duplicate last set"
                                        className="flex items-center gap-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg border border-gray-700 transition-colors disabled:opacity-40"
                                      ><Copy className="h-3 w-3" />+1</button>
                                    )}
                                    {canEdit && (
                                      <button type="button" onClick={() => openInlineForm(exercise.id, prev ?? undefined)}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                          inlineForm?.exerciseId === exercise.id
                                            ? 'bg-emerald-600 border-emerald-500 text-white'
                                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                        }`}
                                      ><Plus className="h-3.5 w-3.5" />Set</button>
                                    )}
                                    {canEdit && (
                                      <button type="button" onClick={() => handleDeleteExercise(exercise.id)} disabled={isPending}
                                        title="Delete exercise"
                                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                      ><Trash2 className="h-3.5 w-3.5" /></button>
                                    )}
                                  </div>
                                </div>

                                {/* Previous session hint */}
                                {prev?.sets.length && (
                                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                    <span className="text-gray-600">Last{prev.date ? ` (${formatDate(prev.date)})` : ''}:</span>
                                    {prev.sets.slice(0, 6).map((s, i) => (
                                      <span key={i} className="text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded font-mono">
                                        {s.weight ?? '—'}×{s.reps ?? '—'}
                                      </span>
                                    ))}
                                    {prev.sets.length > 6 && <span className="text-gray-700">+{prev.sets.length - 6}</span>}
                                  </div>
                                )}

                                {/* Notes */}
                                {canEdit && (
                                  <div className="flex items-center gap-2 rounded-lg bg-gray-800/40 px-3 py-1.5 border border-gray-800">
                                    <StickyNote className="h-3.5 w-3.5 flex-shrink-0 text-gray-600" />
                                    <input type="text" defaultValue={exercise.notes ?? ''}
                                      onBlur={e => handleNotesBlur(exercise.id, e.target.value)}
                                      placeholder="Note (e.g. seat at 4, incline 30°)"
                                      className="w-full bg-transparent text-xs text-gray-400 placeholder:text-gray-600 focus:text-gray-200 focus:outline-none py-0.5"
                                    />
                                  </div>
                                )}

                                {/* Inline set form */}
                                {inlineForm?.exerciseId === exercise.id && (
                                  <form onSubmit={handleSubmitSet} className="p-3 bg-gray-800/70 rounded-xl border border-gray-700 space-y-3">
                                    <div className="flex gap-3 flex-wrap items-end">
                                      <Stepper
                                        label="Weight (kg)"
                                        value={inlineForm.weight}
                                        onChange={v => setInlineForm(f => f && { ...f, weight: v })}
                                        step={2.5} min={0}
                                      />
                                      <Stepper
                                        label="Reps"
                                        value={inlineForm.reps}
                                        onChange={v => setInlineForm(f => f && { ...f, reps: v })}
                                        step={1} min={1}
                                      />
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Type</label>
                                        <div className="flex gap-1">
                                          {SET_TYPES.map(o => (
                                            <button key={o.type} type="button"
                                              onClick={() => setInlineForm(f => f && { ...f, setType: o.type })}
                                              title={o.label}
                                              className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition-colors ${
                                                inlineForm.setType === o.type ? o.chip : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300'
                                              }`}
                                            >{o.short}</button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    {inlineForm.weight && parseFloat(inlineForm.weight) > 0 && (
                                      <PlateDisplay kg={parseFloat(inlineForm.weight)} />
                                    )}
                                    {inlineForm.weight && inlineForm.reps &&
                                     parseFloat(inlineForm.weight) > 0 && parseInt(inlineForm.reps) > 0 && (
                                      <p className="text-xs text-amber-400/70">
                                        Est. 1RM: <span className="font-bold text-amber-400">
                                          {epley(parseFloat(inlineForm.weight), parseInt(inlineForm.reps))} kg
                                        </span>
                                        <span className="text-gray-600 ml-1">(Epley)</span>
                                      </p>
                                    )}
                                    <div className="flex gap-2">
                                      <button type="submit" disabled={saving}
                                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                      >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        Log Set
                                      </button>
                                      <button type="button" onClick={() => setInlineForm(null)}
                                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                                      ><X className="h-4 w-4" /></button>
                                    </div>
                                  </form>
                                )}

                                {/* Set rows */}
                                {sets.length > 0 && (
                                  <div className="space-y-1.5 mt-1">
                                    <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem_3rem] gap-2 text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-2">
                                      <span>#</span><span>Weight</span><span>Reps</span><span>1RM</span><span className="text-right">Done</span>
                                    </div>
                                    {sets.map((set, i) => {
                                      const orm = set.weight && set.reps ? epley(set.weight, set.reps) : null
                                      return (
                                        <div key={set.id}
                                          className={`grid grid-cols-[2rem_1fr_1fr_2.5rem_3rem] gap-2 items-center px-2 py-2 rounded-xl border-l-2 text-sm transition-all duration-200 ${
                                            set.is_completed
                                              ? 'bg-emerald-950/25 border-emerald-700/30'
                                              : `bg-gray-800/60 ${BORDER[set.set_type]}`
                                          }`}
                                        >
                                          <span className={`text-xs font-bold ${set.is_completed ? 'text-gray-600' : 'text-gray-400'}`}>{i + 1}</span>
                                          <span className={`text-sm font-semibold tabular-nums ${set.is_completed ? 'text-gray-600 line-through' : 'text-gray-100'}`}>{set.weight} kg</span>
                                          <div className="flex items-center gap-1.5">
                                            <span className={`text-sm tabular-nums ${set.is_completed ? 'text-gray-600 line-through' : 'text-gray-300'}`}>×{set.reps}</span>
                                            <span className={`text-[10px] px-1 py-0.5 rounded border font-bold hidden sm:inline ${CHIP[set.set_type]}`}>
                                              {set.set_type === 'drop_set' ? 'D' : set.set_type === 'working' ? 'N' : set.set_type === 'warmup' ? 'W' : 'F'}
                                            </span>
                                          </div>
                                          <span className={`text-[11px] tabular-nums font-medium ${set.is_completed ? 'text-gray-700' : 'text-amber-500/80'}`}>{orm ?? '—'}</span>
                                          <div className="flex items-center justify-end gap-1">
                                            {canEdit && (
                                              <button type="button" onClick={() => handleDeleteSet(exercise.id, set.id)} disabled={isPending}
                                                className="h-5 w-5 flex items-center justify-center rounded text-gray-600 hover:text-red-400 transition-colors"
                                              ><X className="h-3.5 w-3.5" /></button>
                                            )}
                                            <button type="button" onClick={() => handleToggle(exercise.id, set.id, set.is_completed)} disabled={!canEdit}
                                              className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
                                                set.is_completed
                                                  ? 'bg-emerald-500 border-emerald-400 text-white'
                                                  : canEdit
                                                    ? 'border-gray-600 hover:border-emerald-400 hover:scale-110'
                                                    : 'border-gray-700 opacity-30 cursor-default'
                                              }`}
                                            >{set.is_completed && <Check className="h-3.5 w-3.5" />}</button>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {!sets.length && inlineForm?.exerciseId !== exercise.id && (
                                  <p className="text-xs text-gray-700 pl-2">No sets yet{canEdit ? ' — click + Set' : ''}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Add exercise to this PAST workout */}
                        {!isToday && isEditing && (
                          <form onSubmit={e => handleAddPastExercise(e, workout.date)}
                            className="mx-5 my-4 flex gap-2"
                          >
                            <ExerciseCombobox value={pastExName} onChange={setPastExName} suggestions={exerciseNames} />
                            <button type="submit" disabled={!pastExName.trim() || addingPastEx}
                              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                            >
                              {addingPastEx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              Add
                            </button>
                          </form>
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

      {/* ══════════════════════ RECORDS TAB ══════════════════════════════════ */}
      {tab === 'prs' && (
        <div className="space-y-4">
          {/* Summary cards */}
          {prs.length > 0 && !loadingPrs && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Medal,        label: 'Exercises', value: String(prs.length),                                                color: 'text-amber-400' },
                { icon: BarChart2,    label: 'Best 1RM',  value: `${Math.max(...prs.map(p => epley(p.weight, p.reps)))} kg`,       color: 'text-blue-400'  },
                { icon: ArrowUpRight, label: 'Top lift',  value: `${Math.max(...prs.map(p => p.weight))} kg`,                     color: 'text-emerald-400' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-bold tabular-nums truncate ${color}`}>{value}</p>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide font-medium">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search + Sort bar */}
          {prs.length > 0 && (
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative flex-1 min-w-[140px]">
                <input
                  type="text"
                  value={prSearch}
                  onChange={e => setPrSearch(e.target.value)}
                  placeholder="Search exercise…"
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-4 pr-8 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                {prSearch && (
                  <button onClick={() => setPrSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-1">
                {([
                  { key: 'weight', label: 'Weight' },
                  { key: 'orm',    label: '1RM'    },
                  { key: 'date',   label: 'Recent' },
                  { key: 'name',   label: 'A–Z'    },
                ] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => setPrSort(key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      prSort === key ? 'bg-amber-500 text-gray-900' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Records list */}
          {loadingPrs ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            </div>
          ) : prs.length === 0 ? (
            <div className="text-center py-16">
              <Trophy className="h-10 w-10 mx-auto mb-3 text-gray-800" />
              <p className="text-sm text-gray-400">No records yet</p>
              <p className="text-xs mt-1 text-gray-600">Complete some sets to see your PRs here</p>
            </div>
          ) : filteredPrs.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">No match for "{prSearch}"</p>
          ) : (
            <div className="space-y-2">
              {filteredPrs.map((pr, i) => {
                const orm  = epley(pr.weight, pr.reps)
                const rank = prs.findIndex(p => p.exerciseName === pr.exerciseName)
                return (
                  <div key={pr.exerciseName}
                    className={`bg-gray-900 border rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-colors ${
                      rank === 0 ? 'border-amber-500/30 bg-amber-500/3' :
                      rank === 1 ? 'border-gray-500/20' :
                      rank === 2 ? 'border-orange-500/20' : 'border-gray-800'
                    }`}
                  >
                    {/* Rank */}
                    <span className="flex-shrink-0 w-7 text-center text-base">
                      {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : (
                        <span className="text-xs font-bold text-gray-600">{rank + 1}</span>
                      )}
                    </span>

                    {/* Name + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-100 truncate">{pr.exerciseName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Calendar className="h-3 w-3 text-gray-600" />
                        <p className="text-xs text-gray-500">{formatDate(pr.date)}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 text-right space-y-0.5">
                      <p className="text-base font-bold text-gray-100 tabular-nums">
                        {pr.weight} kg
                        <span className="text-xs text-gray-400 font-normal ml-1">× {pr.reps}</span>
                      </p>
                      <p className="text-xs text-amber-400 font-semibold tabular-nums">~{orm} kg 1RM</p>
                    </div>

                    {rank === 0 && <Trophy className="h-4 w-4 text-amber-400 flex-shrink-0" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {restSecs > 0 && (
        <RestTimerBar seconds={restSecs} onAdjust={adjustRest} onStop={() => setRestSecs(0)} />
      )}
    </div>
  )
}
