import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitePayload {
  email?: string
  displayName?: string
  jobTitle?: string
  workspaceId?: string
  roleIds?: string[]
  clientIds?: string[]
  clientAccessRoleId?: string
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401)

  let payload: InvitePayload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const email = payload.email?.trim().toLowerCase()
  const displayName = payload.displayName?.trim()
  const jobTitle = payload.jobTitle?.trim() ?? ''
  const workspaceId = payload.workspaceId
  const roleIds = [...new Set(payload.roleIds ?? [])]
  const clientIds = [...new Set(payload.clientIds ?? [])]
  const clientAccessRoleId = payload.clientAccessRoleId

  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !displayName || !workspaceId || roleIds.length === 0 || (clientIds.length > 0 && (!clientAccessRoleId || !roleIds.includes(clientAccessRoleId)))) {
    return json({ error: 'Email, display name, Workspace, and at least one role are required' }, 400)
  }

  const { data: allowed, error: permissionError } = await userClient.rpc(
    'is_workspace_super_admin',
    { target_workspace_id: workspaceId },
  )
  if (permissionError || allowed !== true) return json({ error: 'Forbidden' }, 403)

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName },
  })
  if (inviteError || !invited.user) {
    return json({ error: inviteError?.message ?? 'Could not create invitation' }, 400)
  }

  const { data: membershipId, error: provisionError } = await adminClient.rpc('provision_invited_user', {
    invited_user_id: invited.user.id,
    invited_email: email,
    invited_display_name: displayName,
    invited_job_title: jobTitle,
    target_workspace_id: workspaceId,
    target_role_ids: roleIds,
    actor_user_id: userData.user.id,
  })

  if (provisionError || !membershipId) {
    return json({
      error: 'Invitation was created but Workspace provisioning needs administrator review',
      detail: provisionError?.message ?? 'Membership ID was not returned',
    }, 500)
  }

  if (clientIds.length > 0 && clientAccessRoleId) {
    const { error: accessError } = await adminClient.from('client_members').insert(clientIds.map((clientId) => ({
      client_id: clientId, workspace_member_id: membershipId, role_id: clientAccessRoleId, assigned_by: userData.user.id,
    })))
    if (accessError) return json({ error: 'Invitation and Workspace roles were created, but Client access needs administrator review', detail: accessError.message }, 500)
  }

  return json({ invited: true }, 201)
})
