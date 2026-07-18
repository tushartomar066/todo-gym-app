'use client'

import { X } from 'lucide-react'

interface Props {
  seconds: number
  onAdjust: (delta: number) => void
  onStop: () => void
}

export default function RestTimerBar({ seconds, onAdjust, onStop }: Props) {
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  const label = `${mm}:${String(ss).padStart(2, '0')}`

  // Progress ring fraction (visual only — full at start of a 90s rest).
  const total = 90
  const remaining = Math.min(1, seconds / total)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:bottom-4 md:left-auto md:right-4 md:w-80">
      <div className="mx-3 mb-3 md:mx-0 md:mb-0 flex items-center gap-3 px-4 py-3 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50">
        <div className="relative h-10 w-10 flex-shrink-0">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#374151" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#34d399"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 15}
              strokeDashoffset={2 * Math.PI * 15 * (1 - remaining)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-emerald-400">
            {label}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider font-semibold text-gray-400">Rest</p>
          <p className="text-sm font-medium text-gray-200">Recover before next set</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAdjust(-30)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            -30s
          </button>
          <button
            type="button"
            onClick={() => onAdjust(30)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            +30s
          </button>
          <button
            type="button"
            onClick={onStop}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label="Stop timer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
