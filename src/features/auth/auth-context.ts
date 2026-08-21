import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AccessStatus =
  | 'loading'
  | 'signed_out'
  | 'authorized'
  | 'profile_required'
  | 'profile_deactivated'
  | 'workspace_required'
  | 'membership_deactivated'
  | 'error'

export interface WorkspaceAccess {
  id: string
  name: string
  roles: string[]
}

export interface AuthContextValue {
  session: Session | null
  status: AccessStatus
  workspace: WorkspaceAccess | null
  errorMessage: string | null
  refreshAccess: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
