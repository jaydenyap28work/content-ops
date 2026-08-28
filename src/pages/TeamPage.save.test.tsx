// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamPage } from './TeamPage'

const mocks = vi.hoisted(() => ({
  createMember: vi.fn(async () => 'team-1'),
  loadTeam: vi.fn(async () => []),
}))

vi.mock('../features/auth/auth-context', () => {
  const value = { workspace: { id: 'workspace-1', roles: ['Super Admin'] } }
  return { useAuth: () => value }
})

vi.mock('../features/i18n/i18n', () => ({
  useI18n: () => ({ language: 'zh-CN' }),
}))

vi.mock('../features/admin/admin-api', () => ({
  createProductionTeamMember: mocks.createMember,
  loadProductionTeam: mocks.loadTeam,
  loadRoles: vi.fn(async () => []),
  loadClients: vi.fn(async () => []),
  updateProductionTeamMember: vi.fn(),
  prepareTeamMemberInvite: vi.fn(),
  inviteExistingTeamMember: vi.fn(),
}))

describe('Team Member save flow', () => {
  afterEach(cleanup)
  beforeEach(() => {
    mocks.createMember.mockClear()
    mocks.loadTeam.mockClear()
  })

  it('submits a name-only member and refreshes before closing', async () => {
    render(<TeamPage />)
    await waitFor(() => expect(mocks.loadTeam).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: '新增团队成员' }))

    const form = screen.getByRole('heading', { name: '新增团队成员' }).closest('form')
    expect(form).toBeTruthy()
    const inputs = form!.querySelectorAll('input')
    fireEvent.change(inputs[0], { target: { value: 'ContentOS Team Test' } })
    fireEvent.click(screen.getByRole('button', { name: '新增成员' }))

    await waitFor(() => expect(mocks.createMember).toHaveBeenCalledWith('workspace-1', 'ContentOS Team Test', '', ''))
    await waitFor(() => expect(mocks.loadTeam).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('heading', { name: '新增团队成员' })).toBeNull()
  })
})
