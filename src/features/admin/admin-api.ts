import { supabase } from '../../lib/supabase'

export interface RoleRecord {
  id: string
  code: string
  name: string
}

export interface ClientRecord {
  id: string
  workspace_id: string
  name: string
  code: string
  industry: string | null
  description: string | null
  brand_notes: string | null
  status: 'active' | 'archived'
  ownership_type?: 'internal_brand' | 'external_client'
  is_default_brand?: boolean
  created_at: string
  updated_at: string
}

export interface TeamMemberRecord {
  membershipId: string
  userId: string
  displayName: string
  email: string
  jobTitle: string | null
  status: 'active' | 'deactivated'
  joinedAt: string
  updatedAt: string
  roleIds: string[]
  clientAccess: Array<{ clientId: string; roleId: string; status: 'active' | 'deactivated' }>
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function loadRoles(workspaceId: string) {
  const { data, error } = await supabase
    .from('roles')
    .select('id, code, name')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('name')
  throwIfError(error)
  return (data ?? []) as RoleRecord[]
}

export async function loadClients(workspaceId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, workspace_id, name, code, industry, description, brand_notes, status, ownership_type, is_default_brand, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('name')
  throwIfError(error)
  return (data ?? []) as ClientRecord[]
}

export async function loadTeam(workspaceId: string) {
  const membershipResult = await supabase
    .from('workspace_members')
    .select('id, user_profile_id, status, joined_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('joined_at')
  throwIfError(membershipResult.error)

  const memberships = membershipResult.data ?? []
  if (memberships.length === 0) return []
  const membershipIds = memberships.map((row) => row.id as string)
  const userIds = memberships.map((row) => row.user_profile_id as string)

  const [profilesResult, rolesResult, accessResult] = await Promise.all([
    supabase.from('user_profiles').select('id, display_name, email, job_title').in('id', userIds),
    supabase.from('workspace_member_roles').select('workspace_member_id, role_id').in('workspace_member_id', membershipIds),
    supabase.from('client_members').select('workspace_member_id, client_id, role_id, status').in('workspace_member_id', membershipIds),
  ])
  throwIfError(profilesResult.error)
  throwIfError(rolesResult.error)
  throwIfError(accessResult.error)

  return memberships.map((membership) => {
    const profile = (profilesResult.data ?? []).find((row) => row.id === membership.user_profile_id)
    return {
      membershipId: membership.id as string,
      userId: membership.user_profile_id as string,
      displayName: (profile?.display_name as string | undefined) ?? 'Unnamed member',
      email: (profile?.email as string | undefined) ?? 'Email unavailable',
      jobTitle: (profile?.job_title as string | null | undefined) ?? null,
      status: membership.status as 'active' | 'deactivated',
      joinedAt: membership.joined_at as string,
      updatedAt: membership.updated_at as string,
      roleIds: (rolesResult.data ?? [])
        .filter((row) => row.workspace_member_id === membership.id)
        .map((row) => row.role_id as string),
      clientAccess: (accessResult.data ?? [])
        .filter((row) => row.workspace_member_id === membership.id)
        .map((row) => ({
          clientId: row.client_id as string,
          roleId: row.role_id as string,
          status: row.status as 'active' | 'deactivated',
        })),
    } satisfies TeamMemberRecord
  })
}

export async function saveClient(
  workspaceId: string,
  values: { id?: string; name: string; code: string; industry: string; description: string; brandNotes: string },
) {
  const rpcName = values.id ? 'update_client' : 'create_client'
  const params = {
    ...(values.id ? { target_client_id: values.id } : { target_workspace_id: workspaceId }),
    client_name: values.name,
    client_code: values.code,
    client_industry: values.industry,
    client_description: values.description,
    client_brand_notes: values.brandNotes,
  }
  const { error } = await supabase.rpc(rpcName, params)
  throwIfError(error)
}

export async function archiveClient(clientId: string) {
  const { error } = await supabase.rpc('archive_client', { target_client_id: clientId })
  throwIfError(error)
}

export async function updateMemberProfile(membershipId: string, displayName: string, jobTitle: string) {
  const { error } = await supabase.rpc('admin_update_user_profile', {
    target_workspace_member_id: membershipId,
    target_display_name: displayName,
    target_job_title: jobTitle,
  })
  throwIfError(error)
}

export async function setMemberActive(membershipId: string, makeActive: boolean) {
  const { error } = await supabase.rpc('admin_set_member_active', {
    target_workspace_member_id: membershipId,
    make_active: makeActive,
  })
  throwIfError(error)
}

export async function setMemberRoles(membershipId: string, roleIds: string[]) {
  const { error } = await supabase.rpc('admin_set_member_roles', {
    target_workspace_member_id: membershipId,
    target_role_ids: roleIds,
  })
  throwIfError(error)
}

export async function setClientAccess(clientId: string, membershipId: string, roleId: string, makeActive: boolean) {
  const { error } = await supabase.rpc('admin_set_client_access', {
    target_client_id: clientId,
    target_workspace_member_id: membershipId,
    target_role_id: roleId,
    make_active: makeActive,
  })
  throwIfError(error)
}

export async function inviteUser(payload: {
  email: string
  displayName: string
  jobTitle: string
  workspaceId: string
  roleIds: string[]
  clientIds: string[]
  clientAccessRoleId: string
}) {
  const { data, error } = await supabase.functions.invoke('invite-user', { body: payload })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error as string)
}

export interface AccessRequestRecord {
  id: string
  workspace_id: string
  auth_user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at: string | null
  assigned_role_id: string | null
  linked_team_member_id: string | null
  review_note: string | null
}

export async function loadAccessRequests(workspaceId: string) {
  const { data, error } = await supabase.from('access_requests')
    .select('id,workspace_id,auth_user_id,email,display_name,avatar_url,status,requested_at,reviewed_at,assigned_role_id,linked_team_member_id,review_note')
    .eq('workspace_id', workspaceId).order('requested_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as AccessRequestRecord[]
}

export async function reviewAccessRequest(values: { requestId: string; decision: 'approved' | 'rejected'; roleCode?: string; teamMemberId?: string; createTeamMember?: boolean; note?: string }) {
  const { data, error } = await supabase.rpc('review_access_request', {
    target_request_id: values.requestId, target_decision: values.decision,
    target_role_code: values.roleCode ?? null, target_team_member_id: values.teamMemberId ?? null,
    target_create_team_member: values.createTeamMember ?? false, target_review_note: values.note ?? null,
  })
  throwIfError(error)
  return data
}

export async function countPendingAccessRequests(workspaceId: string) {
  const { count, error } = await supabase.from('access_requests').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('status', 'pending')
  throwIfError(error)
  return count ?? 0
}
export interface ProductionTeamMemberRecord {
  id:string
  name:string
  job_title:string|null
  email:string|null
  auth_user_id:string|null
  login_status:'not_enabled'|'invited'|'enabled'
  status:'active'|'inactive'
  created_at:string
  updated_at:string
}
export async function loadProductionTeam(workspaceId:string){
  const{data,error}=await supabase.rpc('list_team_members',{target_workspace_id:workspaceId})
  throwIfError(error)
  return(data??[]) as ProductionTeamMemberRecord[]
}
export async function createProductionTeamMember(workspaceId:string,name:string,jobTitle:string,email:string){
  const{data,error}=await supabase.rpc('create_team_member',{target_workspace_id:workspaceId,target_name:name,target_job_title:jobTitle,target_email:email||null})
  if(error)console.error('[ContentOS] create_team_member RPC failed',error)
  throwIfError(error);return data as string
}
export async function updateProductionTeamMember(id:string,name:string,jobTitle:string,active:boolean){
  const{error}=await supabase.rpc('update_team_member',{target_team_member_id:id,target_name:name,target_job_title:jobTitle,target_active:active})
  throwIfError(error)
}
export async function prepareTeamMemberInvite(id:string,email:string){
  const{error}=await supabase.rpc('prepare_team_member_invite',{target_team_member_id:id,target_email:email})
  throwIfError(error)
}
export async function inviteExistingTeamMember(payload:{teamMemberId:string;email:string;displayName:string;jobTitle:string;workspaceId:string;roleIds:string[];clientIds:string[];clientAccessRoleId:string}){
  const{data,error}=await supabase.functions.invoke('invite-user',{body:payload})
  if(error)throw new Error(error.message)
  if(data?.error)throw new Error(data.error as string)
}