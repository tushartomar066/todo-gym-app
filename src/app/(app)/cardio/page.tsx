'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCardioLogs, addCardioLog, updateCardioLog, deleteCardioLog } from '@/lib/actions'
import { type CardioLog, type ActivityType } from '@/types/database'
import {
  Activity, Plus, Trash2, Loader2, Timer, Footprints,
  Flame, Bike, MoreHorizontal, X, Pencil, Check,
} from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in LOCAL time (not UTC). */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const today     = localToday()
  const d         = new Date(Date.now() - 86400000)
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function formatDuration(min: number): string {
  if (min < 60) return `${min % 1 === 0 ? min : min.toFixed(1)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function pace(durationMin: number, distanceKm: number | null): string {
  if (!distanceKm || distanceKm <= 0) return ''
  const minPerKm = durationMin / distanceKm
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

// ── constants ─────────────────────────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<ActivityType, {
  label: string
  icon: React.ReactNode
  color: string
  bg: string
  distanceLabel: string
  showSteps: boolean
}> = {
  run:    { label: 'Run',    icon: <Flame          className="h-4 w-4" />, color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20',  distanceLabel: 'Distance (km)', showSteps: false },
  walk:   { label: 'Walk',   icon: <Footprints     className="h-4 w-4" />, color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20',         distanceLabel: 'Distance (km)', showSteps: true  },
  warmup: { label: 'Warmup', icon: <Activity       className="h-4 w-4" />, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20',   distanceLabel: '',              showSteps: false },
  cycle:  { label: 'Cycle',  icon: <Bike           className="h-4 w-4" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', distanceLabel: 'Distance (km)', showSteps: false },
  other:  { label: 'Other',  icon: <MoreHorizontal className="h-4 w-4" />, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20',   distanceLabel: 'Distance (km)', showSteps: true  },
}

interface FormState {
  activity_type: ActivityType
  date: string
  duration: string
  distance: string
  steps: string
  notes: string
}

function makeDefaultForm(): FormState {
  return { activity_type: 'run', date: localToday(), duration: '', distance: '', steps: '', notes: '' }
}

// ── component ─────────────────────────────────────────────────────────────────

type Mode = { type: 'idle' } | { type: 'add' } | { type: 'edit'; log: CardioLog }

export default function CardioPage() {
  const [logs, setLogs]       = useState<CardioLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mode, setMode]       = useState<Mode>({ type: 'idle' })
  const [form, setForm]       = useState<FormState>(makeDefaultForm)
  const [saving, setSaving]   = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLogs(await getCardioLogs())
    } catch {
      setError('Failed to load cardio logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Clear success banner after 3 s
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(null), 3000)
    return () => clearTimeout(t)
  }, [success])

  const setField = (field: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const openAdd = () => {
    setForm(makeDefaultForm())
    setMode({ type: 'add' })
    setError(null)
  }

  const openEdit = (log: CardioLog) => {
    setForm({
      activity_type: log.activity_type,
      date:          log.date,
      duration:      String(log.duration_minutes),
      distance:      log.distance_km != null ? String(log.distance_km) : '',
      steps:         log.steps != null ? String(log.steps) : '',
      notes:         log.notes ?? '',
    })
    setMode({ type: 'edit', log })
    setError(null)
  }

  const closeForm = () => {
    setMode({ type: 'idle' })
    setError(null)
  }

  // ── form validation ───────────────────────────────────────────────────────

  const validate = (): string | null => {
    const duration = parseFloat(form.duration)
    if (!form.duration || isNaN(duration) || duration <= 0) return 'Duration is required and must be greater than 0'
    if (!form.date) return 'Date is required'
    if (form.distance && isNaN(parseFloat(form.distance))) return 'Distance must be a number'
    if (form.steps && isNaN(parseInt(form.steps, 10))) return 'Steps must be a whole number'
    return null
  }

  // ── save handler (add + edit) ─────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    const duration    = parseFloat(form.duration)
    const distance_km = form.distance ? parseFloat(form.distance)    : null
    const steps       = form.steps    ? parseInt(form.steps, 10)     : null
    const notes       = form.notes.trim() || null

    setSaving(true)
    setError(null)
    try {
      if (mode.type === 'add') {
        const log = await addCardioLog(form.activity_type, duration, form.date, distance_km, steps, notes)
        setLogs(prev => {
          const updated = [log, ...prev]
          // Keep sorted: newest date first, then newest created_at
          updated.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
          return updated
        })
        setSuccess('Activity logged!')
      } else if (mode.type === 'edit') {
        const updated = await updateCardioLog(mode.log.id, {
          activity_type: form.activity_type,
          duration_minutes: duration,
          date: form.date,
          distance_km,
          steps,
          notes,
        })
        setLogs(prev => prev.map(l => l.id === updated.id ? updated : l))
        setSuccess('Activity updated!')
      }
      closeForm()
    } catch {
      setError(mode.type === 'add' ? 'Failed to save activity' : 'Failed to update activity')
    } finally {
      setSaving(false)
    }
  }

  // ── delete handler ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return }   // first click → ask
    setDeleteConfirm(null)
    setError(null)
    try {
      await deleteCardioLog(id)
      setLogs(prev => prev.filter(l => l.id !== id))
    } catch {
      setError('Failed to delete activity')
    }
  }

  // ── summary stats ─────────────────────────────────────────────────────────

  const totalSessions = logs.length
  const totalMinutes  = logs.reduce((a, l) => a + Number(l.duration_minutes), 0)
  const totalKm       = logs.reduce((a, l) => a + Number(l.distance_km ?? 0), 0)
  const totalSteps    = logs.reduce((a, l) => a + Number(l.steps ?? 0), 0)

  const cfg = ACTIVITY_CONFIG[form.activity_type]

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl w-full space-y-6">

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-200">Cardio</h2>
          <p className="text-gray-400 text-sm mt-1">Track your runs, walks, warmups and more</p>
        </div>
        {mode.type === 'idle' ? (
          <button
            onClick={openAdd}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Log Activity</span>
            <span className="sm:hidden">Log</span>
          </button>
        ) : (
          <button
            onClick={closeForm}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        )}
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
          <Check className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Error banner — always above the fold */}
      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sessions', value: totalSessions.toString(), sub: 'all time' },
          { label: 'Time',     value: totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)}h` : `${Math.round(totalMinutes)}m`, sub: 'all time' },
          { label: 'Distance', value: `${totalKm.toFixed(1)} km`, sub: 'all time' },
          { label: 'Steps',    value: totalSteps >= 1000 ? `${(totalSteps / 1000).toFixed(1)}k` : totalSteps.toString(), sub: 'all time' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{s.label}</p>
            {loading
              ? <div className="h-7 w-16 bg-gray-800 rounded animate-pulse mt-1" />
              : <p className="text-2xl font-bold text-gray-200 mt-1">{s.value}</p>
            }
            <p className="text-xs text-gray-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      {mode.type !== 'idle' && (
        <form onSubmit={handleSave} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            {mode.type === 'add' ? 'New Activity' : 'Edit Activity'}
          </p>

          {/* Activity type selector */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map(type => {
              const c = ACTIVITY_CONFIG[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setField('activity_type', type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.activity_type === type
                      ? `${c.bg} ${c.color} ring-1 ring-current`
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {c.icon}
                  {c.label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setField('date', e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Duration (min) <span className="text-orange-400">*</span>
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={form.duration}
                onChange={e => setField('duration', e.target.value)}
                placeholder="e.g. 30"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cfg.distanceLabel ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{cfg.distanceLabel}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.distance}
                  onChange={e => setField('distance', e.target.value)}
                  placeholder="e.g. 5.2"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl bg-gray-800/40 border border-gray-800 text-xs text-gray-600 px-3 py-2">
                No distance for {cfg.label.toLowerCase()}
              </div>
            )}
            {cfg.showSteps ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Steps</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.steps}
                  onChange={e => setField('steps', e.target.value)}
                  placeholder="e.g. 8000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl bg-gray-800/40 border border-gray-800 text-xs text-gray-600 px-3 py-2">
                Steps tracked for walk / other
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="e.g. Morning run at the park"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : mode.type === 'add' ? 'Save Activity' : 'Update Activity'}
          </button>
        </form>
      )}

      {/* History list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Activity className="h-10 w-10 mx-auto mb-3 text-gray-700" />
          <p className="text-sm font-medium">No activity logged yet</p>
          <p className="text-xs text-gray-600 mt-1">Hit "Log Activity" above to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            {totalSessions} session{totalSessions !== 1 ? 's' : ''}
          </p>
          {logs.map(log => {
            const c        = ACTIVITY_CONFIG[log.activity_type] ?? ACTIVITY_CONFIG.other
            const isDeleting = deleteConfirm === log.id
            const isEditing  = mode.type === 'edit' && mode.log.id === log.id
            return (
              <div
                key={log.id}
                className={`relative group bg-gray-900 border rounded-2xl px-5 py-4 flex items-center gap-4 transition-all ${
                  isEditing   ? 'border-orange-500/40' :
                  isDeleting  ? 'border-red-500/40' :
                                'border-gray-800 hover:border-gray-700'
                }`}
              >
                {/* Activity icon */}
                <div className={`flex-shrink-0 p-2.5 rounded-xl border ${c.bg} ${c.color}`}>
                  {c.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${c.color}`}>{c.label}</p>
                    <span className="text-gray-600 text-xs">·</span>
                    <p className="text-xs text-gray-400">
                      {formatDate(log.date)}
                      <span className="text-gray-600 ml-1 hidden sm:inline">{log.date}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Timer className="h-3 w-3 text-gray-600" />
                      {formatDuration(Number(log.duration_minutes))}
                    </span>
                    {log.distance_km != null && (
                      <span className="text-xs text-gray-400">{Number(log.distance_km).toFixed(2)} km</span>
                    )}
                    {log.distance_km != null && pace(Number(log.duration_minutes), log.distance_km) && (
                      <span className="text-xs text-gray-500">{pace(Number(log.duration_minutes), log.distance_km)}</span>
                    )}
                    {log.steps != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Footprints className="h-3 w-3 text-gray-600" />
                        {Number(log.steps).toLocaleString()} steps
                      </span>
                    )}
                  </div>
                  {log.notes && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{log.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => isEditing ? closeForm() : openEdit(log)}
                    title="Edit"
                    className="p-1.5 rounded-lg text-gray-600 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(log.id)}
                    title={isDeleting ? 'Click again to confirm delete' : 'Delete'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isDeleting
                        ? 'text-red-400 bg-red-500/10'
                        : 'text-gray-600 hover:text-red-400 hover:bg-red-500/10'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isDeleting && (
                  <div className="absolute right-0 bottom-full mb-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 pointer-events-none whitespace-nowrap">
                    Tap again to delete
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
