import { describe, expect, it } from 'vitest'
import { productionBoardStage, productionTracker } from './production-model'
import type { ContentRecord } from './content-api'

describe('production board and tracker', () => {
  it('keeps workflow and publication state separate while showing published work', () => {
    expect(productionBoardStage({ current_status: 'editing', publication_state: 'not_published' })).toBe('editing')
    expect(productionBoardStage({ current_status: 'ready_for_publishing', publication_state: 'fully_published' })).toBe('published')
  })

  it('derives human-readable production steps without database tokens', () => {
    const content = {
      current_status: 'editing', publication_state: 'not_published', shoot_scheduled_at: '2026-08-31T06:00:00Z',
      contributors: [{ userId: 'editor', roleId: 'role', notes: null, displayName: 'Alicia', roleCode: 'editor', roleName: 'Editor' }],
      publications: [],
    } as unknown as ContentRecord
    const tracker = productionTracker(content, 'zh-CN')
    expect(tracker.shooting).toBe('✓ 已拍摄')
    expect(tracker.editing).toContain('Alicia')
    expect(tracker.review).toBe('—')
    expect(tracker.nextAction).toBe('提交初剪')
    expect(Object.values(tracker).join(' ')).not.toMatch(/not_started|draft|converted/)
  })

  it('shows scheduled platforms and fully published state independently', () => {
    const scheduled = productionTracker({ current_status: 'ready_for_publishing', publication_state: 'not_published', contributors: [], publications: [{ platformCode: 'fb', scheduledAt: '2026-09-02T02:00:00Z', publishedAt: null, status: 'scheduled' }] } as unknown as ContentRecord, 'zh-CN')
    expect(scheduled.publishing).toContain('FB')
    const published = productionTracker({ current_status: 'ready_for_publishing', publication_state: 'fully_published', contributors: [], publications: [{ platformCode: 'xhs', scheduledAt: null, publishedAt: '2026-09-02T02:00:00Z', status: 'published' }] } as unknown as ContentRecord, 'zh-CN')
    expect(published.publishing).toContain('✓ 已发布')
  })
})