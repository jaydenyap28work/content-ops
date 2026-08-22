// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaFormDrawer } from './IdeaFormDrawer'
import type { ResearchCatalog } from './research-api'

const mocks = vi.hoisted(() => ({
  loadContributorOptions: vi.fn(async () => []),
  saveIdea: vi.fn(async () => 'idea-1'),
}))

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    session: {
      user: {
        id: 'user-1',
        email: 'jaydenyap28work@gmail.com',
      },
    },
  }),
}))

vi.mock('./research-api', () => ({
  loadContributorOptions: mocks.loadContributorOptions,
  saveIdea: mocks.saveIdea,
}))

const catalog: ResearchCatalog = {
  clients: [
    {
      id: 'client-1',
      workspace_id: 'workspace-1',
      name: 'LKSoft',
      code: 'LKSOFT',
      industry: null,
      description: null,
      brand_notes: null,
      status: 'active',
      created_at: '2026-08-22T00:00:00.000Z',
      updated_at: '2026-08-22T00:00:00.000Z',
    },
  ],
  platforms: [],
  categories: [{ id: 'category-1', client_id: null, name: '老板IP' }],
  contributionRoles: [
    { id: 'creator-role', code: 'idea_creator', name: 'Idea Creator' },
  ],
}

describe('IdeaFormDrawer', () => {
  beforeEach(() => {
    mocks.loadContributorOptions.mockClear()
    mocks.saveIdea.mockClear()
  })

  it('keeps intake minimal and saves without requiring optional detail fields', async () => {
    const onSaved = vi.fn(async () => undefined)
    render(
      <IdeaFormDrawer
        workspaceId="workspace-1"
        idea={null}
        catalog={catalog}
        references={[]}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    )

    expect(screen.getByLabelText(/^Client/)).toBeTruthy()
    expect(screen.getByLabelText(/^Idea Title/)).toBeTruthy()
    expect(screen.getByLabelText('Category')).toBeTruthy()
    expect(screen.getByLabelText('Priority')).toBeTruthy()
    expect(screen.getByText('Creator recorded automatically')).toBeTruthy()

    const details = screen.getByText('更多资料 · More details').closest('details')
    expect(details?.open).toBe(false)

    fireEvent.change(screen.getByLabelText(/^Idea Title/), {
      target: { value: '为什么公司名字叫 LKSOFT？' },
    })
    expect(await screen.findByText('Prepared shooting suggestions')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Save Idea' }))

    await waitFor(() => expect(mocks.saveIdea).toHaveBeenCalledTimes(1))
    expect(mocks.saveIdea).toHaveBeenCalledWith(
      'workspace-1',
      expect.objectContaining({
        clientId: 'client-1',
        title: '为什么公司名字叫 LKSOFT？',
        categoryId: null,
        priority: 'normal',
        ourAngle: '',
        contributors: [],
      }),
    )
    expect(onSaved).toHaveBeenCalledWith('Idea created.')
  })
})
