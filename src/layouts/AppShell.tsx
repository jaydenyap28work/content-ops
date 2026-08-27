import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Button } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { devAuthLog, useDevMountCounter } from '../lib/dev-diagnostics'
import { useI18n } from '../features/i18n/i18n'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const {language}=useI18n(); const zh=language==='zh-CN'
  const { backgroundRefreshing, backgroundError, refreshAccess } = useAuth()

  useDevMountCounter('AppShell')

  useEffect(() => {
    devAuthLog('navigation', {
      source: 'router_location_change',
      pathname: location.pathname,
    })
  }, [location.pathname])

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
        {backgroundRefreshing ? (
          <div
            className="border-b border-blue/20 bg-blue/5 px-4 py-2 text-xs font-semibold text-blue sm:px-6 lg:px-8"
            role="status"
          >
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              {zh?'正在背景确认工作区权限，当前页面与输入会保持不变':'Rechecking workspace access in the background… Your current work stays open.'}
            </span>
          </div>
        ) : null}
        {backgroundError ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/25 bg-gold/8 px-4 py-2.5 text-xs text-ink sm:px-6 lg:px-8"
            role="alert"
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-gold-dark" aria-hidden="true" />
              {zh?'工作区背景检查中断；页面和表单仍保持打开':'Workspace recheck was interrupted. Your page and form remain open.'}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void refreshAccess()}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {zh?'重试权限检查':'Retry access check'}
            </Button>
          </div>
        ) : null}
        <main
          id="main-content"
          className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
        >
          <div className="mx-auto w-full max-w-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
