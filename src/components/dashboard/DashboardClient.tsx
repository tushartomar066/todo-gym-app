'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { CheckCircle2, Dumbbell, TrendingUp, Circle } from 'lucide-react'
import WeeklyProgressChart from '@/components/charts/WeeklyProgressChart'
import WorkoutActions from '@/components/dashboard/WorkoutActions'


export interface DashboardClientProps {
  completed: number
  total: number
  pct: number
  weeklyCompleted: number
  chartData: { name: string; number: number }[]
  hasWorkout: boolean
  exerciseCount: number
}


function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    cancelAnimationFrame(rafRef.current)
    const start = performance.now()
    const tick = (now: number) => {
      const t      = Math.min((now - start) / duration, 1)
      const eased  = 1 - (1 - t) ** 3          // ease-out cubic
      setValue(Math.round(target * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}


const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

const HOVER_LIFT = { y: -3, transition: { duration: 0.18, ease: 'easeOut' as const } }


export default function DashboardClient({
  completed,
  total,
  pct,
  weeklyCompleted,
  chartData,
  hasWorkout,
  exerciseCount,
}: DashboardClientProps) {
  const [dateStr, setDateStr] = useState('')
  const animCompleted = useCountUp(completed)
  const animWeekly    = useCountUp(weeklyCompleted)

  // Compute date client-side to avoid hydration mismatch
  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    )
  }, [])

  return (
    <div className="space-y-8">

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="text-2xl font-bold text-gray-200">Good day 👋</h2>
        <p className="text-gray-400 mt-1 text-sm">Here's what's happening today.</p>
        {dateStr && (
          <p className="text-xs text-gray-600 mt-0.5 font-medium tracking-wide">{dateStr}</p>
        )}
        {/* Gradient divider */}
        <div className="mt-4 h-px bg-gradient-to-r from-transparent via-gray-700/60 to-transparent" />
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <motion.div
          custom={0} variants={fadeUp} initial="hidden" animate="visible"
          className="h-full"
        >
          <Link href="/todo" className="block h-full">
            <motion.div
              whileHover={HOVER_LIFT}
              className="h-full bg-gray-900 bg-gradient-to-br from-indigo-500/10 to-transparent
                         border border-gray-800 border-l-2 border-l-indigo-500
                         rounded-2xl p-5 space-y-4 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Today's Tasks
                </span>
                <div className="p-2 bg-indigo-500/15 rounded-lg group-hover:bg-indigo-500/25 transition-colors">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                </div>
              </div>

              <div>
                <p className="text-3xl font-bold text-gray-200">
                  {animCompleted}
                  <span className="text-gray-600 text-xl">/{total}</span>
                </p>
                <p className={`text-sm mt-1 ${total === 0 ? 'text-gray-600 italic' : 'text-gray-400'}`}>
                  {total === 0 ? 'No tasks yet today' : 'tasks completed'}
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                {total === 0 ? (
                  // Zero-state: dashed appearance via repeating gradient
                  <div
                    className="h-1.5 w-full rounded-full opacity-30"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg, #4b5563 0px, #4b5563 4px, transparent 4px, transparent 8px)',
                    }}
                  />
                ) : (
                  <motion.div
                    className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.85, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </div>

              <p className={`text-xs ${pct === 0 && total > 0 ? 'text-gray-600' : 'text-gray-500'}`}>
                {total === 0 ? '—' : `${pct}% done`}
              </p>
            </motion.div>
          </Link>
        </motion.div>

        <motion.div
          custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className="h-full"
        >
          <motion.div
            whileHover={HOVER_LIFT}
            className={`h-full bg-gray-900 bg-gradient-to-br to-transparent
                        border border-gray-800 border-l-2
                        rounded-2xl p-5 space-y-4
                        ${hasWorkout
                          ? 'from-emerald-500/10 border-l-emerald-500'
                          : 'from-gray-700/10 border-l-gray-600'
                        }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Workout</span>
              <div className={`p-2 rounded-lg ${hasWorkout ? 'bg-emerald-500/15' : 'bg-gray-700/30'}`}>
                <Dumbbell className={`h-4 w-4 ${hasWorkout ? 'text-emerald-400' : 'text-gray-500'}`} />
              </div>
            </div>

            <div>
              {hasWorkout ? (
                <>
                  <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <p className="text-sm font-semibold text-emerald-400">Active today</p>
                  </div>
                  <p className={`text-sm mt-1 ${exerciseCount === 0 ? 'text-gray-600 italic' : 'text-gray-400'}`}>
                    {exerciseCount === 0
                      ? 'No exercises logged yet'
                      : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} logged`
                    }
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Circle className="h-4 w-4 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-500">No workout yet</p>
                  </div>
                  <p className="text-gray-600 text-sm mt-1 italic">Head to Gym to start</p>
                </>
              )}
            </div>

            <WorkoutActions hasWorkout={hasWorkout} />
          </motion.div>
        </motion.div>

        <motion.div
          custom={2} variants={fadeUp} initial="hidden" animate="visible"
          className="sm:col-span-2 lg:col-span-1 h-full"
        >
          <Link href="/todo" className="block h-full">
            <motion.div
              whileHover={HOVER_LIFT}
              className="h-full bg-gray-900 bg-gradient-to-br from-violet-500/10 to-transparent
                         border border-gray-800 border-l-2 border-l-violet-500
                         rounded-2xl p-5 space-y-4 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Weekly Total
                </span>
                <div className="p-2 bg-violet-500/15 rounded-lg group-hover:bg-violet-500/25 transition-colors">
                  <TrendingUp className="h-4 w-4 text-violet-400" />
                </div>
              </div>

              <div>
                <p className="text-3xl font-bold text-gray-200">{animWeekly}</p>
                <p className={`text-sm mt-1 ${weeklyCompleted === 0 ? 'text-gray-600 italic' : 'text-gray-400'}`}>
                  {weeklyCompleted === 0 ? 'Nothing yet this week' : 'tasks done this week'}
                </p>
              </div>
            </motion.div>
          </Link>
        </motion.div>

      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-gray-300">Weekly Task Completion</h3>
          <span className="text-xs text-gray-600 font-medium">{weeklyCompleted} this week</span>
        </div>
        <div className="h-52">
          <WeeklyProgressChart data={chartData} />
        </div>
      </motion.div>

    </div>
  )
}
