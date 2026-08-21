import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { navigationSections, routeDefinitions } from '../lib/navigation'
import { cn } from '../lib/cn'

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

function NavigationContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-coral font-display text-2xl font-semibold text-white shadow-[3px_3px_0_#fff2]">
            C
          </div>
          <div>
            <p className="font-display text-xl font-semibold leading-none text-white">ContentOS</p>
            <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/45">
              Operations workspace
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary navigation">
        {navigationSections.map((section) => (
          <div key={section} className="mb-5 last:mb-0">
            <p className="mb-2 px-3 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-white/35">
              {section}
            </p>
            <div className="space-y-1">
              {routeDefinitions
                .filter((route) => route.section === section)
                .map((route) => {
                  const Icon = route.icon
                  return (
                    <NavLink
                      key={route.path}
                      to={route.path}
                      end={route.path === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral',
                          isActive
                            ? 'bg-white text-ink shadow-sm'
                            : 'text-white/67 hover:bg-white/8 hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            aria-hidden="true"
                            className={cn('size-[1.05rem] shrink-0', isActive ? 'text-coral' : 'text-white/45 group-hover:text-white')}
                            strokeWidth={2.1}
                          />
                          <span>{route.navigationLabel}</span>
                        </>
                      )}
                    </NavLink>
                  )
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-light">Application Foundation</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/48">Business data is intentionally absent in this phase.</p>
        </div>
      </div>
    </>
  )
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col bg-ink lg:flex">
        <NavigationContent />
      </aside>

      <div
        aria-hidden={!mobileOpen}
        className={cn(
          'fixed inset-0 z-40 bg-ink/55 backdrop-blur-sm transition-opacity lg:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(86vw,20rem)] flex-col bg-ink shadow-2xl transition-transform duration-200 ease-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          type="button"
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-coral"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <NavigationContent onNavigate={onClose} />
      </aside>
    </>
  )
}
