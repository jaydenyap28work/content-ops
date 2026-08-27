// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IdeaPlannerView } from './IdeaPlannerView'
import { I18nProvider } from '../i18n/i18n'
import type { IdeaRecord, ResearchCatalog } from './research-api'

const catalog: ResearchCatalog = { clients: [], platforms: [], categories: [], contributionRoles: [] }
const row = {
  id: 'idea', workspace_id: 'workspace', client_id: 'client', title: 'Mobile planning row', planned_date: '2026-09-02', shoot_planned_at: null,
  source_url: null, original_topic: null, original_hook: null, why_it_works: null, our_angle: null, category_id: null,
  suggested_format: null, priority: 'normal', status: 'new', planning_status: 'new', owner_user_id: null, created_by: 'user', owner_name: null,
  creator_name: 'Jayden', linked_content_id: null, linked_content_code: null, linked_content_status: null,
  linked_content_record_status: null, linked_content_planned_date: null, linked_content_shoot_scheduled_at: null, notes: null, status_reason: null,
  created_at: '2026-08-20', updated_at: '2026-08-20', referenceIds: [], tags: [], contributors: [],
} satisfies IdeaRecord

describe('IdeaPlannerView responsive structure', () => {
  it('uses a dense desktop table and separate compact mobile rows', () => {
    render(<I18nProvider><IdeaPlannerView ideas={[row]} catalog={catalog} onSelect={vi.fn()} /></I18nProvider>)
    expect(screen.getByTestId('idea-planner-desktop').className).toContain('hidden')
    expect(screen.getByTestId('idea-planner-desktop').className).toContain('lg:block')
    expect(screen.getByTestId('idea-planner-mobile').className).toContain('lg:hidden')
    expect(screen.getByRole('columnheader', { name: '选题标题' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: '策划状态' })).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: '优先级' })).toBeNull()
    expect(screen.getAllByText(/目标发布日期 ·/)).toHaveLength(2)
    expect(screen.getAllByText('Mobile planning row')).toHaveLength(2)
  })
})
