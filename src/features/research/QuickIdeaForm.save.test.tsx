// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickIdeaForm } from './QuickIdeaForm'
import type { ResearchCatalog } from './research-api'

const mocks = vi.hoisted(() => ({
  saveIdea: vi.fn(async () => 'idea-1'),
}))

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}))

vi.mock('../i18n/i18n', () => ({
  useI18n: () => ({ language: 'zh-CN' }),
}))

vi.mock('./research-api', () => ({
  loadIdeaProviderOptions: vi.fn(async () => [{ team_member_id: 'member-1', display_name: 'Jayden', is_current_user: true }]),
  saveIdea: mocks.saveIdea,
}))

const catalog: ResearchCatalog = {
  clients: [{
    id: 'client-1', workspace_id: 'workspace-1', name: 'LKSoft', code: 'LKSOFT', industry: null,
    description: null, brand_notes: null, status: 'active', is_default_brand: true,
    created_at: '2026-08-28T00:00:00Z', updated_at: '2026-08-28T00:00:00Z',
  }],
  platforms: [], categories: [], contributionRoles: [],
}

describe('Quick Idea save flow', () => {
  afterEach(cleanup)
  beforeEach(() => mocks.saveIdea.mockReset())

  it('submits with only a title and keeps optional fields blank', async () => {
    mocks.saveIdea.mockResolvedValue('idea-1')
    const onSaved = vi.fn(async () => undefined)
    render(<QuickIdeaForm workspaceId="workspace-1" idea={null} catalog={catalog} onClose={vi.fn()} onSaved={onSaved} />)

    const form = screen.getByRole('heading', { name: '新增选题' }).closest('section')!.querySelector('form')!
    const title = form.querySelector('input[required]')!
    fireEvent.change(title, { target: { value: 'ContentOS Idea Test' } })
    await waitFor(() => expect(screen.getByRole('button', { name: '保存选题' }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '保存选题' }))

    await waitFor(() => expect(mocks.saveIdea).toHaveBeenCalledWith('workspace-1', expect.objectContaining({
      title: 'ContentOS Idea Test', sourceUrl: '', rawContent: '', contentFormat: '', priority: '',
      providerTeamMemberId: 'member-1', categoryId: null, tags: [],
    })))
    expect(onSaved).toHaveBeenCalledWith('选题已保存')
  })

})
