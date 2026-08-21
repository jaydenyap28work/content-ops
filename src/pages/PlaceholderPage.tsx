import { ArrowUpRight, CheckCircle2 } from 'lucide-react'
import type { AppRouteDefinition } from '../types/navigation'
import { Card, StatusBadge } from '../components/ui'

interface PlaceholderPageProps {
  route: AppRouteDefinition
}

export function PlaceholderPage({ route }: PlaceholderPageProps) {
  const Icon = route.icon

  return (
    <div className="page-enter">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-paper p-5 shadow-[0_16px_45px_rgba(13,31,42,0.07)] sm:p-8 lg:p-10">
        <div className="absolute right-0 top-0 h-full w-2 bg-coral" aria-hidden="true" />
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-ink text-white shadow-[4px_4px_0_var(--color-coral)]">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <StatusBadge tone="neutral">Route ready</StatusBadge>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">{route.phase}</span>
          </div>

          <h2 className="mt-7 text-balance font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {route.title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft sm:text-lg">{route.description}</p>
        </div>
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green" aria-hidden="true" />
            <div>
              <h3 className="font-display text-xl font-semibold text-ink">Foundation status</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{route.foundationNote}</p>
            </div>
          </div>
        </Card>

        <Card tone="dark">
          <ArrowUpRight className="size-5 text-coral-light" aria-hidden="true" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.17em] text-white/45">Scope guard</p>
          <p className="mt-2 text-sm leading-6 text-white/72">
            No demo business data, backend connection, authentication, or workflow logic has been added.
          </p>
        </Card>
      </div>
    </div>
  )
}
