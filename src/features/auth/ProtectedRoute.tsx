import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoaderCircle, LockKeyhole } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { useAuth } from './auth-context'

const accessMessages = {
  profile_required: {
    title: 'Account setup is not complete',
    body: 'Your sign-in is valid, but a ContentOS profile has not been provisioned yet. Ask a Super Admin to complete workspace access.',
  },
  profile_deactivated: {
    title: 'Account deactivated',
    body: 'This ContentOS profile is deactivated. Access remains closed while historical activity attribution is preserved.',
  },
  workspace_required: {
    title: 'No active workspace',
    body: 'This account does not have an active ContentOS workspace membership.',
  },
  membership_deactivated: {
    title: 'Workspace access deactivated',
    body: 'Your ContentOS workspace membership is inactive. Contact a Super Admin if access should be restored.',
  },
  error: {
    title: 'Access check failed',
    body: 'ContentOS could not verify workspace access. No workspace data has been opened.',
  },
} as const

export function ProtectedRoute() {
  const location = useLocation()
  const {
    status,
    errorMessage,
    initialAuthLoading,
    workspaceLoading,
    refreshAccess,
    signOut,
  } = useAuth()

  if (status === 'loading' || initialAuthLoading || workspaceLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-5 text-ink">
        <div className="flex items-center gap-3 text-sm font-semibold text-ink-muted">
          <LoaderCircle className="size-5 animate-spin text-coral" aria-hidden="true" />
          Verifying secure workspace access…
        </div>
      </main>
    )
  }

  if (status === 'signed_out') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (status === 'authorized') {
    return <Outlet />
  }

  const message = accessMessages[status]

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-10 text-ink">
      <Card className="w-full max-w-lg border-t-4 border-t-coral">
        <div className="grid size-12 place-items-center rounded-xl bg-ink text-paper">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-coral">
          Access closed
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{message.title}</h1>
        <p className="mt-3 leading-7 text-ink-soft">{message.body}</p>
        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-coral/25 bg-coral/7 px-4 py-3 text-sm text-coral-dark">
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap gap-3">
          <Button onClick={() => void refreshAccess()}>Check access again</Button>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    </main>
  )
}
