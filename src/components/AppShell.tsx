'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, CheckSquare, Dumbbell, LogOut, Activity, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ThemePicker from '@/components/ThemePicker'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/todo',      label: 'Todos',     icon: CheckSquare },
  { href: '/gym',       label: 'Gym',       icon: Dumbbell },
  { href: '/cardio',    label: 'Cardio',    icon: Activity },
]

function SidebarBody({
  pathname,
  onNavigate,
  onLogout,
}: {
  pathname: string
  onNavigate: () => void
  onLogout: () => void
}) {
  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-gray-800 space-y-1">
        <ThemePicker />
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">

      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col bg-gray-900 border-r border-gray-800">
        <div className="px-6 py-5 border-b border-gray-800">
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Jtrac
          </span>
        </div>
        <SidebarBody pathname={pathname} onNavigate={() => {}} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer — slides in from left */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 flex flex-col bg-gray-900 border-r border-gray-800 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Jtrac
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarBody
              pathname={pathname}
              onNavigate={() => setDrawerOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-300 capitalize">
              {nav.find(n => pathname.startsWith(n.href))?.label ?? 'App'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme picker — mobile only in top bar */}
            <div className="md:hidden">
              <ThemePicker compact />
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-xs text-gray-400">Live</span>
            </div>
          </div>
        </header>

        {/* Page content — add bottom padding on mobile for the tab bar */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4 md:p-8">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-gray-900 border-t border-gray-800 flex">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-medium transition-colors ${
                  active ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-indigo-400' : 'text-gray-500'}`} />
                <span className="text-[10px] leading-none">{label}</span>
              </Link>
            )
          })}
        </nav>

      </div>
    </div>
  )
}
