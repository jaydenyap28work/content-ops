import { describe, expect, it } from 'vitest'
import type { IdeaRecord } from '../research/research-api'
import { createShootingBriefTemplate, toShootingBriefGenerationInput } from './shooting-brief-templates'

const titles = [
  '最近很多商家开始倒闭了，你怎样看？',
  '做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？',
  '不是已经有 SST 了吗？为什么安华又提 GST？',
  '你觉得一个企业里面，什么部门最重要？',
  '为什么公司名字叫 LKSOFT？',
  '你觉得怎样的企业或老板，会有很好的发展？',
  '很多人讲00后很难融入企业文化，你怎样看？',
]

function idea(title: string): IdeaRecord {
  return {
    id: title, workspace_id: 'workspace', client_id: 'client', title, planned_date: '2026-09-01',
    source_url: null, original_topic: null, original_hook: 'Existing hook', why_it_works: null,
    our_angle: 'Existing angle', category_id: null, suggested_format: 'Q&A', priority: 'normal',
    status: 'approved', owner_user_id: null, created_by: 'creator', owner_name: null,
    creator_name: 'Creator', notes: null, status_reason: null, created_at: '', updated_at: '',
    referenceIds: [], contributors: [], tags: [], linked_content_id: null, linked_content_code: null,
    linked_content_status: null, linked_content_record_status: null, linked_content_planned_date: null,
  }
}

describe('Shooting Brief templates', () => {
  it('provides complete review-ready templates for all seven LKSoft topics', () => {
    for (const title of titles) {
      const template = createShootingBriefTemplate(idea(title))
      expect(template.whyNow).toBeTruthy()
      expect(template.interviewQuestions.length).toBeGreaterThanOrEqual(3)
      expect(template.interviewQuestions.length).toBeLessThanOrEqual(5)
      expect(template.keyTalkingPoints.length).toBeGreaterThan(0)
      expect(template.keyTakeaway).toBeTruthy()
      expect(template.suggestedCta).toBeTruthy()
      expect(template.targetDuration).toBeTruthy()
      expect(template.bRollVisualSuggestions.length).toBeGreaterThan(0)
      expect(template.riskFactCheckNotes.length).toBeGreaterThan(0)
    }
  })

  it('flags unknown policy and personal-history facts instead of inventing them', () => {
    const tax = createShootingBriefTemplate(idea(titles[2])).riskFactCheckNotes.join(' ')
    const brand = createShootingBriefTemplate(idea(titles[4])).riskFactCheckNotes.join(' ')
    expect(tax).toContain('不得声称 GST 已确定回归')
    expect(tax).toContain('最新官方声明')
    expect(brand).toContain('名字的真实由来')
    expect(brand).toContain('不得由制作团队替 Steven 补写个人故事')
  })

  it('builds a generation payload without execution assignments', () => {
    const payload = toShootingBriefGenerationInput(idea(titles[0]))
    expect(payload.ideaId).toBe(titles[0])
    expect(payload).not.toHaveProperty('talent')
    expect(payload).not.toHaveProperty('shooter')
    expect(payload).not.toHaveProperty('location')
    expect(payload).not.toHaveProperty('shootDate')
  })
})
