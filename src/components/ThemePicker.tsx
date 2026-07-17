'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme, type Theme } from '@/contexts/ThemeContext'
import { Palette } from 'lucide-react'

const THEMES: { id: Theme; label: string; preview: string[] }[] = [
  { id: 'dark',    label: 'Dark',    preview: ['#111827', '#6366f1', '#0f172a'] },
  { id: 'light',   label: 'Light',   preview: ['#eef2ff', '#6366f1', '#ffffff'] },
  { id: 'acid',    label: 'Acid',    preview: ['#2C2E39', '#D8125B', '#1a1b22'] },
  { id: 'floors',  label: 'Floors',  preview: ['#EAE7DD', '#99775C', '#f5f2ec'] },
  { id: 'liberty', label: 'Liberty', preview: ['#ffffff', '#4F0341', '#f9f5ff'] },
]

interface Props {
  compact?: boolean
}

export default function ThemePicker({ compact = false }: Props) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {compact ? (
        <button
          onClick={() => setOpen(o => !o)}
          className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          title="Change theme"
          aria-label="Change theme"
        >
          <Palette className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full"
          title="Change theme"
        >
          <Palette className="h-4 w-4" />
          <span>Theme</span>
          <span className="ml-auto text-xs text-gray-600 capitalize">{theme}</span>
        </button>
      )}

      {open && (
        <div className={`absolute ${compact ? 'right-0 top-full mt-2' : 'bottom-full left-0 mb-2'} w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50`}>
          <p className="px-3 pt-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Choose Theme
          </p>
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                theme === t.id
                  ? 'bg-indigo-600/20 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="flex gap-0.5 flex-shrink-0">
                {t.preview.map((c, i) => (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-sm border border-white/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="font-medium">{t.label}</span>
              {theme === t.id && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />
              )}
            </button>
          ))}
          <div className="h-2" />
        </div>
      )}
    </div>
  )
}
