'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
}

export default function ExerciseCombobox({ value, onChange, suggestions }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = suggestions
    .filter(s => s.toLowerCase().includes(value.toLowerCase().trim()))
    .slice(0, 8)

  return (
    <div ref={ref} className="relative flex-1">
      <input
        type="text"
        value={value}
        required
        autoComplete="off"
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Exercise name (e.g. Bench Press)"
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      />
      {open && value.trim().length > 0 && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
          {filtered.map(name => (
            <li key={name}>
              <button
                type="button"
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
