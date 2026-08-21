import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileOpen])

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[60] -translate-y-20 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white focus:translate-y-0"
      >
        Skip to main content
      </a>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="min-h-dvh lg:pl-sidebar">
        <TopBar onOpenNavigation={() => setMobileOpen(true)} />
        <main id="main-content" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
