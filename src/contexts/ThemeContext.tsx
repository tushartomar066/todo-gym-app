'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'acid' | 'floors' | 'liberty'

const STORAGE_KEY = 'fittrack-theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', setTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved) applyTheme(saved)
  }, [])

  const applyTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    const html = document.documentElement
    if (t === 'dark') {
      html.removeAttribute('data-theme')
    } else {
      html.setAttribute('data-theme', t)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
