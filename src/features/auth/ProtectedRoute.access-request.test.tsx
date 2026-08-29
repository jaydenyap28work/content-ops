// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'

vi.mock('./auth-context', () => ({
  useAuth: () => ({
    status: 'access_pending', errorMessage: null, initialAuthLoading: false, workspaceLoading: false,
    refreshAccess: vi.fn(), signOut: vi.fn(), session: { user: { email: 'new.user@example.com' } },
    accessRequest: { email: 'new.user@example.com' },
  }),
}))
vi.mock('../i18n/i18n', () => ({ useI18n: () => ({ language: 'zh-CN' }) }))

describe('Access Request waiting screen', () => {
  it('shows the verified Google account without rendering Workspace content', () => {
    render(<MemoryRouter><ProtectedRoute /></MemoryRouter>)
    expect(screen.getByText('访问申请已提交')).toBeTruthy()
    expect(screen.getByText('new.user@example.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: '重新检查权限' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '退出登录' })).toBeTruthy()
  })
})
