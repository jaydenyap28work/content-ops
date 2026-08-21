import { Menu } from 'lucide-react'
import { useCurrentRoute } from '../hooks/useCurrentRoute'
import { StatusBadge } from '../components/ui'

interface TopBarProps {
  onOpenNavigation: () => void
}

export function TopBar({ onOpenNavigation }: TopBarProps) {
  const route = useCurrentRoute()

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
          <p className="truncate text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Content operations</p>
          <h1 className="truncate font-display text-xl font-semibold text-ink sm:text-2xl">{route?.title ?? 'Page not found'}</h1>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <span className="text-xs font-semibold text-ink-muted">Asia/Kuala_Lumpur</span>
          <StatusBadge tone="info">Foundation</StatusBadge>
        </div>
      </div>
    </header>
  )
}
