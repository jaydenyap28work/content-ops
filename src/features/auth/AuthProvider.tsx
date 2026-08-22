import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { devAuthLog } from '../../lib/dev-diagnostics'
import { AuthContext } from './auth-context'
import type {
  AccessStatus,
  AuthContextValue,
  WorkspaceAccess,
} from './auth-context'

interface ProfileRow {
  status: 'active' | 'deactivated'
}

interface MembershipRow {
  id: string
  workspace_id: string
  status: 'active' | 'deactivated'
}

interface WorkspaceRow {
  id: string
  name: string
  status: 'active' | 'archived'
}

interface MemberRoleRow {
  role_id: string
}

interface RoleRow {
  id: string
  name: string
}

interface AuthState {
  session: Session | null
  status: AccessStatus
  workspace: WorkspaceAccess | null
  errorMessage: string | null
  initialAuthLoading: boolean
  workspaceLoading: boolean
  backgroundRefreshing: boolean
  backgroundError: string | null
}

type VerificationMode = 'foreground' | 'background'

type AccessResult =
  | { kind: 'authorized'; workspace: WorkspaceAccess }
  | {
      kind: 'unauthorized'
      status: Exclude<
        AccessStatus,
        'loading' | 'signed_out' | 'authorized' | 'error'
      >
    }
  | { kind: 'error'; message: string }

const initialState: AuthState = {
  session: null,
  status: 'loading',
  workspace: null,
  errorMessage: null,
  initialAuthLoading: true,
  workspaceLoading: false,
  backgroundRefreshing: false,
  backgroundError: null,
}

async function queryWorkspaceAccess(activeSession: Session): Promise<AccessResult> {
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('status')
    .eq('id', activeSession.user.id)
    .maybeSingle()

  if (profileError) return { kind: 'error', message: profileError.message }

  const profile = profileData as ProfileRow | null
  if (!profile) return { kind: 'unauthorized', status: 'profile_required' }
  if (profile.status !== 'active') {
    return { kind: 'unauthorized', status: 'profile_deactivated' }
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, status')
    .eq('user_profile_id', activeSession.user.id)

  if (membershipError) {
    return { kind: 'error', message: membershipError.message }
  }

  const memberships = (membershipData ?? []) as MembershipRow[]
  const activeMembership = memberships.find(
    (membership) => membership.status === 'active',
  )

  if (!activeMembership) {
    return {
      kind: 'unauthorized',
      status:
        memberships.length > 0
          ? 'membership_deactivated'
          : 'workspace_required',
    }
  }

  const [workspaceResult, memberRolesResult] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, name, status')
      .eq('id', activeMembership.workspace_id)
      .maybeSingle(),
    supabase
      .from('workspace_member_roles')
      .select('role_id')
      .eq('workspace_member_id', activeMembership.id),
  ])

  if (workspaceResult.error || memberRolesResult.error) {
    return {
      kind: 'error',
      message:
        workspaceResult.error?.message
        ?? memberRolesResult.error?.message
        ?? 'Workspace verification failed.',
    }
  }

  const workspaceRow = workspaceResult.data as WorkspaceRow | null
  if (!workspaceRow || workspaceRow.status !== 'active') {
    return { kind: 'unauthorized', status: 'workspace_required' }
  }

  const roleIds = ((memberRolesResult.data ?? []) as MemberRoleRow[]).map(
    ({ role_id }) => role_id,
  )
  let roleNames: string[] = []

  if (roleIds.length > 0) {
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id, name')
      .in('id', roleIds)
      .eq('is_active', true)

    if (roleError) return { kind: 'error', message: roleError.message }
    roleNames = ((roleData ?? []) as RoleRow[])
      .map(({ name }) => name)
      .sort()
  }

  return {
    kind: 'authorized',
    workspace: {
      id: workspaceRow.id,
      name: workspaceRow.name,
      roles: roleNames,
    },
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)
  const stateRef = useRef(state)
  const mountedRef = useRef(false)
  const subscriptionGenerationRef = useRef(0)
  const verificationVersionRef = useRef(0)
  const authorizedUserIdRef = useRef<string | null>(null)
  const inFlightRef = useRef<{
    userId: string
    promise: Promise<void>
  } | null>(null)

  const commitState = useCallback(
    (update: (current: AuthState) => AuthState) => {
      setState((current) => {
        const next = update(current)
        stateRef.current = next
        return next
      })
    },
    [],
  )

  const applySignedOut = useCallback(
    (source: string) => {
      verificationVersionRef.current += 1
      authorizedUserIdRef.current = null
      inFlightRef.current = null
      devAuthLog('signed_out', { source })
      commitState(() => ({
        ...initialState,
        status: 'signed_out',
        initialAuthLoading: false,
      }))
    },
    [commitState],
  )

  const verifyAccess = useCallback(
    (
      activeSession: Session,
      mode: VerificationMode,
      source: string,
    ): Promise<void> => {
      const userId = activeSession.user.id
      const existing = inFlightRef.current
      if (existing?.userId === userId) {
        devAuthLog('workspace_verification_deduplicated', {
          source,
          mode,
          userId,
        })
        return existing.promise
      }

      const version = ++verificationVersionRef.current
      devAuthLog('workspace_verification_started', {
        source,
        mode,
        userId,
        version,
      })

      if (mode === 'foreground') {
        commitState((current) => ({
          ...current,
          session: activeSession,
          status: 'loading',
          workspace: null,
          errorMessage: null,
          initialAuthLoading: false,
          workspaceLoading: true,
          backgroundRefreshing: false,
          backgroundError: null,
        }))
      } else {
        commitState((current) => ({
          ...current,
          session: activeSession,
          backgroundRefreshing: true,
          backgroundError: null,
        }))
      }

      const promise = (async () => {
        const result = await queryWorkspaceAccess(activeSession)
        if (!mountedRef.current || verificationVersionRef.current !== version) {
          return
        }

        if (result.kind === 'authorized') {
          authorizedUserIdRef.current = userId
          commitState((current) => ({
            ...current,
            session: activeSession,
            status: 'authorized',
            workspace: result.workspace,
            errorMessage: null,
            initialAuthLoading: false,
            workspaceLoading: false,
            backgroundRefreshing: false,
            backgroundError: null,
          }))
          devAuthLog('workspace_verification_succeeded', {
            source,
            mode,
            userId,
            version,
          })
          return
        }

        if (result.kind === 'unauthorized') {
          authorizedUserIdRef.current = null
          commitState((current) => ({
            ...current,
            session: activeSession,
            status: result.status,
            workspace: null,
            errorMessage: null,
            initialAuthLoading: false,
            workspaceLoading: false,
            backgroundRefreshing: false,
            backgroundError: null,
          }))
          devAuthLog('workspace_verification_unauthorized', {
            source,
            mode,
            userId,
            status: result.status,
            version,
          })
          return
        }

        const canKeepCurrentPage =
          mode === 'background'
          && stateRef.current.status === 'authorized'
          && authorizedUserIdRef.current === userId

        if (canKeepCurrentPage) {
          commitState((current) => ({
            ...current,
            session: activeSession,
            backgroundRefreshing: false,
            backgroundError: result.message,
          }))
          devAuthLog('workspace_background_verification_failed', {
            source,
            userId,
            version,
          })
        } else {
          authorizedUserIdRef.current = null
          commitState((current) => ({
            ...current,
            session: activeSession,
            status: 'error',
            workspace: null,
            errorMessage: result.message,
            initialAuthLoading: false,
            workspaceLoading: false,
            backgroundRefreshing: false,
            backgroundError: null,
          }))
          devAuthLog('workspace_initial_verification_failed', {
            source,
            userId,
            version,
          })
        }
      })().finally(() => {
        if (inFlightRef.current?.promise === promise) {
          inFlightRef.current = null
        }
      })

      inFlightRef.current = { userId, promise }
      return promise
    },
    [commitState],
  )

  useEffect(() => {
    const subscriptionGeneration = ++subscriptionGenerationRef.current
    mountedRef.current = true
    devAuthLog('provider_mounted')

    const handleAuthEvent = (
      event: AuthChangeEvent,
      nextSession: Session | null,
    ) => {
      const userId = nextSession?.user.id ?? null
      devAuthLog('auth_event', { event, userId })

      if (event === 'SIGNED_OUT' || !nextSession) {
        applySignedOut(event)
        return
      }

      const sameAuthorizedUser =
        authorizedUserIdRef.current === userId
        && stateRef.current.status === 'authorized'

      if (event === 'SIGNED_IN' && sameAuthorizedUser) {
        commitState((current) => ({ ...current, session: nextSession }))
        devAuthLog('auth_event_session_only', {
          event,
          userId,
          source: 'duplicate_signed_in',
        })
        return
      }

      if (event === 'TOKEN_REFRESHED' && sameAuthorizedUser) {
        commitState((current) => ({ ...current, session: nextSession }))
        void verifyAccess(nextSession, 'background', 'token_refreshed')
        return
      }

      if (
        (event === 'USER_UPDATED' || event === 'MFA_CHALLENGE_VERIFIED')
        && sameAuthorizedUser
      ) {
        commitState((current) => ({ ...current, session: nextSession }))
        void verifyAccess(nextSession, 'background', event.toLowerCase())
        return
      }

      void verifyAccess(nextSession, 'foreground', event.toLowerCase())
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      queueMicrotask(() => {
        if (
          mountedRef.current
          && subscriptionGenerationRef.current === subscriptionGeneration
        ) {
          handleAuthEvent(event, nextSession)
        }
      })
    })

    return () => {
      mountedRef.current = false
      subscriptionGenerationRef.current += 1
      verificationVersionRef.current += 1
      subscription.unsubscribe()
      devAuthLog('provider_unmounted')
    }
  }, [applySignedOut, commitState, verifyAccess])

  const value = useMemo<AuthContextValue>(
    () => ({
      session: state.session,
      status: state.status,
      workspace: state.workspace,
      errorMessage: state.errorMessage,
      initialAuthLoading: state.initialAuthLoading,
      workspaceLoading: state.workspaceLoading,
      backgroundRefreshing: state.backgroundRefreshing,
      backgroundError: state.backgroundError,
      refreshAccess: async () => {
        if (!state.session) {
          applySignedOut('manual_refresh_without_session')
          return
        }
        const mode: VerificationMode =
          state.status === 'authorized' ? 'background' : 'foreground'
        await verifyAccess(state.session, mode, 'manual_retry')
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
    }),
    [applySignedOut, state, verifyAccess],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
