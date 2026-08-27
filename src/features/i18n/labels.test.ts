import { describe, expect, it } from 'vitest'
import { enumLabel } from './labels'

describe('localized operational labels', () => {
  it('uses Chinese-only Idea and production status labels in zh-CN', () => {
    expect(enumLabel('converted', 'zh-CN')).toBe('已转制作')
    expect(enumLabel('ready_to_shoot', 'zh-CN')).toBe('待拍摄')
    expect(enumLabel('revision_required', 'zh-CN')).toBe('需要修改')
  })
  it('keeps database values unchanged while rendering English labels', () => {
    expect(enumLabel('ready_for_publishing', 'en')).toBe('Ready For Publishing')
  })
})
