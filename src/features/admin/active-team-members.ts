import { supabase } from '../../lib/supabase'

export type TeamMemberLoginStatus = 'not_enabled' | 'invited' | 'enabled' | 'disabled'

export interface ActiveTeamMemberOption {
  id: string
  name: string
  job_title: string | null
  email: string | null
  auth_user_id: string | null
  login_status: TeamMemberLoginStatus
  status: 'active'
}

export async function loadActiveTeamMembers(workspaceId: string, clientId?: string) {
  const { data, error } = await supabase.rpc('list_active_team_members', {
    target_workspace_id: workspaceId,
    target_client_id: clientId ?? null,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as ActiveTeamMemberOption[]
}

export function teamMemberLoginLabel(status: TeamMemberLoginStatus, zh: boolean) {
  if (status === 'enabled') return zh ? '已启用' : 'Enabled'
  if (status === 'disabled') return zh ? '访问已停用' : 'Access disabled'
  if (status === 'invited') return zh ? '邀请中' : 'Invited'
  return zh ? '未启用' : 'Not enabled'
}
