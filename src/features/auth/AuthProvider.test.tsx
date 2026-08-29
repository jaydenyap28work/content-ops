// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { ProtectedRoute } from './ProtectedRoute'
import { I18nProvider } from '../i18n/i18n'

type AuthCallback = (
  event: AuthChangeEvent,
  session: Session | null,
) => void

const authHarness = vi.hoisted(() => ({
  callback: null as AuthCallback | null,
  profileQueries: 0,
  failNextProfileQuery: false,
  reset() {
    this.callback = null
    this.profileQueries = 0
    this.failNextProfileQuery = false
  },
}))

function queryResult(table: string) {
  if (table === 'user_profiles') {
    authHarness.profileQueries += 1
    if (authHarness.failNextProfileQuery) {
      authHarness.failNextProfileQuery = false
      return { data: null, error: { message: 'Temporary network failure' } }
    }
    return { data: { status: 'active' }, error: null }
  }

  if (table === 'workspace_members') {
    return {
      data: [
        {
          id: 'membership-1',
          workspace_id: 'workspace-1',
          status: 'active',
        },
      ],
      error: null,
    }
  }

  if (table === 'workspaces') {
    return {
      data: { id: 'workspace-1', name: 'ContentOS', status: 'active' },
      error: null,
    }
  }

  if (table === 'workspace_member_roles') {
    return { data: [{ role_id: 'role-1' }], error: null }
  }

  if (table === 'roles') {
    return {
      data: [{ id: 'role-1', name: 'Super Admin' }],
      error: null,
    }
  }

  throw new Error(`Unexpected table in auth test: ${table}`)
}

function createQuery(table: string) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    maybeSingle: () => Promise.resolve(queryResult(table)),
    then: <TResult1 = unknown, TResult2 = never>(
      onFulfilled?: ((value: ReturnType<typeof queryResult>) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(queryResult(table)).then(onFulfilled, onRejected),
  }
  return query
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: AuthCallback) => {
        authHarness.callback = callback
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      },
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: (table: string) => createQuery(table),
  },
}))

const session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-22T00:00:00.000Z',
  },
} as Session

let formMounts = 0
let formUnmounts = 0

function PilotForm() {
  const location = useLocation()

  useEffect(() => {
    formMounts += 1
    return () => {
      formUnmounts += 1
    }
  }, [])

  return (
    <div>
      <label htmlFor="pilot-title">Pilot title</label>
      <input id="pilot-title" />
      <output aria-label="Current route">{location.pathname}</output>
    </div>
  )
}

function TestShell() {
  return <Outlet />
}

function renderProtectedRoute(pathname = '/clients') {
  return render(
    <I18nProvider><AuthProvider>
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<TestShell />}>
              <Route path="/clients" element={<PilotForm />} />
              <Route path="/content" element={<PilotForm />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider></I18nProvider>,
  )
}

async function emitAuthEvent(
  event: AuthChangeEvent,
  nextSession: Session | null,
) {
  await act(async () => {
    authHarness.callback?.(event, nextSession)
    await Promise.resolve()
  })
}

describe('AuthProvider workspace verification lifecycle', () => {
  beforeEach(() => {
    authHarness.reset()
    formMounts = 0
    formUnmounts = 0
  })

  it('keeps the current form mounted through duplicate auth events, refresh, tab changes, and transient errors', async () => {
    renderProtectedRoute('/clients')

    expect(screen.getByText(/正在验证工作区权限|Verifying secure Workspace access/i)).toBeTruthy()

    await emitAuthEvent('INITIAL_SESSION', session)
    const input = await screen.findByLabelText('Pilot title')

    expect(authHarness.profileQueries).toBe(1)
    expect(formMounts).toBe(1)
    expect(formUnmounts).toBe(0)

    fireEvent.change(input, { target: { value: 'LKSoft pilot draft' } })

    await emitAuthEvent('SIGNED_IN', session)
    expect(authHarness.profileQueries).toBe(1)
    expect(input).toHaveProperty('value', 'LKSoft pilot draft')
    expect(formMounts).toBe(1)
    expect(formUnmounts).toBe(0)

    await emitAuthEvent('TOKEN_REFRESHED', {
      ...session,
      access_token: 'refreshed-access-token',
    })
    await waitFor(() => expect(authHarness.profileQueries).toBe(2))

    expect(screen.queryByText(/正在验证工作区权限|Verifying secure Workspace access/i)).toBeNull()
    expect(input).toHaveProperty('value', 'LKSoft pilot draft')
    expect(screen.getByLabelText('Current route').textContent).toBe('/clients')
    expect(formMounts).toBe(1)
    expect(formUnmounts).toBe(0)

    document.dispatchEvent(new Event('visibilitychange'))
    await act(async () => Promise.resolve())

    expect(authHarness.profileQueries).toBe(2)
    expect(input).toHaveProperty('value', 'LKSoft pilot draft')
    expect(formMounts).toBe(1)
    expect(formUnmounts).toBe(0)

    vi.useFakeTimers()
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000)
    })
    vi.useRealTimers()

    expect(authHarness.profileQueries).toBe(2)
    expect(input).toHaveProperty('value', 'LKSoft pilot draft')
    expect(formMounts).toBe(1)
    expect(formUnmounts).toBe(0)

    authHarness.failNextProfileQuery = true
    await emitAuthEvent('TOKEN_REFRESHED', {
      ...session,
      access_token: 'another-refreshed-access-token',
    })
    await waitFor(() => expect(authHarness.profileQueries).toBe(3))

    expect(screen.queryByText(/正在验证工作区权限|Verifying secure Workspace access/i)).toBeNull()
    expect(input).toHaveProperty('value', 'LKSoft pilot draft')
    expect(formMounts).toBe(1)
    expect(formUnmounts).toBe(0)

    await emitAuthEvent('SIGNED_OUT', null)
    expect(await screen.findByText('Login page')).toBeTruthy()
    expect(formUnmounts).toBe(1)
  })

  it('restores a protected route after a direct route refresh', async () => {
    renderProtectedRoute('/content')
    await emitAuthEvent('INITIAL_SESSION', session)

    expect(await screen.findByLabelText('Pilot title')).toBeTruthy()
    expect(screen.getByLabelText('Current route').textContent).toBe('/content')
    expect(formMounts).toBe(1)
    expect(authHarness.profileQueries).toBe(1)
  })
})
