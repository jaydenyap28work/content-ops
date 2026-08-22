import { describe, expect, it } from 'vitest'
import type { IdeaRecord } from './research-api'
import { filterPlannerIdeas, getDisplayedProductionStatus, sortIdeasByPlannedDate } from './idea-planner'

function idea(overrides: Partial<IdeaRecord>): IdeaRecord {
  return {
    id: 'idea', workspace_id: 'workspace', client_id: 'client', title: 'Idea', planned_date: null,
    source_url: null, original_topic: null, original_hook: null, why_it_works: null, our_angle: null,
    category_id: null, suggested_format: null, priority: 'normal', status: 'new', owner_user_id: null,
    created_by: 'user', owner_name: null, creator_name: 'Jayden', linked_content_id: null,
    linked_content_code: null, linked_content_status: null, linked_content_record_status: null,
    linked_content_planned_date: null, notes: null, status_reason: null, created_at: '2026-08-20',
    updated_at: '2026-08-20', referenceIds: [], tags: [], contributors: [], ...overrides,
  }
}

describe('Idea Planner helpers', () => {
  it('sorts planned dates ascending and keeps unscheduled Ideas last', () => {
    const sorted = sortIdeasByPlannedDate([
      idea({ id: 'none' }), idea({ id: 'later', planned_date: '2026-09-23' }), idea({ id: 'first', planned_date: '2026-09-02' }),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['first', 'later', 'none'])
  })

  it('filters by the human workflow status without conflating Content status', () => {
    const rows = [idea({ id: 'new' }), idea({ id: 'converted', status: 'converted', linked_content_status: 'editing' })]
    const filtered = filterPlannerIdeas(rows, { search: '', status: 'converted', clientId: 'all', categoryId: 'all', reference: 'all' })
    expect(filtered.map((item) => item.id)).toEqual(['converted'])
  })

  it('shows the linked production status for a converted Idea', () => {
    expect(getDisplayedProductionStatus(idea({ status: 'converted', linked_content_status: 'ready_to_shoot' }))).toBe('Ready to Shoot')
    expect(getDisplayedProductionStatus(idea({ status: 'approved', linked_content_status: 'editing' }))).toBeNull()
  })
})
