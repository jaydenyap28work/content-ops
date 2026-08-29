import { supabase } from '../../lib/supabase'

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected'

export interface AccessRequestInfo {
  id: string
  status: AccessRequestStatus
  email: string
  display_name: string | null
  requested_at: string
  reviewed_at: string | null
  review_note: string | null
}

export async function ensureAccessRequest(workspaceId: string) {
  const { data, error } = await supabase.rpc('ensure_my_access_request', {
    target_workspace_id: workspaceId,
  })
  if (error) throw new Error(error.message)
  return data as AccessRequestInfo | { status: 'authorized'; email: string }
}
