import { Link } from 'react-router-dom'
import { Card } from '../components/ui'

export function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">404</p>
      <h2 className="mt-3 font-display text-4xl font-semibold text-ink">This route is not in the plan.</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink-soft">
        Return to the registered ContentOS foundation routes. No additional product surface has been inferred.
      </p>
      <Link
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md border border-ink bg-ink px-4 text-sm font-semibold text-paper shadow-[3px_3px_0_0_var(--color-coral)] transition-all hover:-translate-y-0.5 hover:shadow-[4px_5px_0_0_var(--color-coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        to="/"
      >
        Return to Dashboard
      </Link>
    </Card>
  )
}
