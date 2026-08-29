import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureAccessRequest } from './access-request-api'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))

describe('Access Request API', () => {
  beforeEach(() => rpc.mockReset())
  it('cannot send an assigned role from the applicant path', async () => {
    rpc.mockResolvedValue({ data: { id: 'r1', status: 'pending', email: 'new.user@example.com' }, error: null })
    await ensureAccessRequest('workspace-1')
    expect(rpc).toHaveBeenCalledWith('ensure_my_access_request', { target_workspace_id: 'workspace-1' })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('target_role_code')
  })
})
