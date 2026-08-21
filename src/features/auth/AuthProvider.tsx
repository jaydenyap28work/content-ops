import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AccessStatus>('loading')
  const [workspace, setWorkspace] = useState<WorkspaceAccess | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadAccess = useCallback(async (activeSession: Session | null) => {
    setWorkspace(null)
    setErrorMessage(null)

    if (!activeSession) {
      setStatus('signed_out')
      return
    }

    setStatus('loading')

    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('status')
      .eq('id', activeSession.user.id)
      .maybeSingle()

    if (profileError) {
      setErrorMessage(profileError.message)
      setStatus('error')
      return
    }

    const profile = profileData as ProfileRow | null
    if (!profile) {
      setStatus('profile_required')
      return
    }
    if (profile.status !== 'active') {
      setStatus('profile_deactivated')
      return
    }

    const { data: membershipData, error: membershipError } = await supabase
      .from('workspace_members')
      .select('id, workspace_id, status')
      .eq('user_profile_id', activeSession.user.id)

    if (membershipError) {
      setErrorMessage(membershipError.message)
      setStatus('error')
      return
    }

    const memberships = (membershipData ?? []) as MembershipRow[]
    const activeMembership = memberships.find(
      (membership) => membership.status === 'active',
    )

    if (!activeMembership) {
      setStatus(
        memberships.length > 0 ? 'membership_deactivated' : 'workspace_required',
      )
      return
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
      setErrorMessage(
        workspaceResult.error?.message ?? memberRolesResult.error?.message ?? null,
      )
      setStatus('error')
      return
    }

    const workspaceRow = workspaceResult.data as WorkspaceRow | null
    if (!workspaceRow || workspaceRow.status !== 'active') {
      setStatus('workspace_required')
      return
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

      if (roleError) {
        setErrorMessage(roleError.message)
        setStatus('error')
        return
      }

      roleNames = ((roleData ?? []) as RoleRow[]).map(({ name }) => name).sort()
    }

    setWorkspace({
      id: workspaceRow.id,
      name: workspaceRow.name,
      roles: roleNames,
    })
    setStatus('authorized')
  }, [])

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setErrorMessage(error.message)
        setStatus('error')
        return
      }

      setSession(data.session)
      void loadAccess(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadAccess(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadAccess])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      workspace,
      errorMessage,
      refreshAccess: () => loadAccess(session),
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
    }),
    [errorMessage, loadAccess, session, status, workspace],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
