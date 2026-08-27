import { LogOut, Menu } from 'lucide-react'
import { useCurrentRoute } from '../hooks/useCurrentRoute'
import { StatusBadge } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { LanguageSwitch, routeTranslationKeys, useI18n } from '../features/i18n/i18n'

interface TopBarProps {
  onOpenNavigation: () => void
}

export function TopBar({ onOpenNavigation }: TopBarProps) {
  const route = useCurrentRoute()
  const { session, workspace, signOut } = useAuth()
  const { t, language } = useI18n()
  const zh = language === 'zh-CN'

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur-xl">
      <div className="flex min-h-18 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white text-ink shadow-sm hover:border-ink/25 lg:hidden"
          onClick={onOpenNavigation}
          aria-label="Open navigation"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">{zh?'内容运营':'Content operations'}</p>
          <h1 className="truncate font-display text-xl font-semibold text-ink sm:text-2xl">{route ? t(routeTranslationKeys[route.path]) : (zh ? '找不到页面' : 'Page not found')}</h1>
        </div>

        <LanguageSwitch compact />
        <div className="hidden min-w-0 items-center gap-3 sm:flex">
          <div className="min-w-0 text-right">
            <p className="max-w-56 truncate text-xs font-bold text-ink">{session?.user.email}</p>
            <p className="max-w-56 truncate text-[0.68rem] font-semibold text-ink-muted">
              {workspace?.name} · {workspace?.roles.join(', ') || 'Member'}
            </p>
          </div>
          <StatusBadge tone="info">{zh?'已登录':'Authenticated'}</StatusBadge>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg border border-line bg-white text-ink-muted transition hover:border-coral/40 hover:text-coral"
            onClick={() => void signOut()}
            aria-label={zh?'登出':'Sign out'}
            title={zh?'登出':'Sign out'}
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
