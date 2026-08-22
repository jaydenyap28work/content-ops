import { describe, expect, it } from 'vitest'
import {
  findIdeaSuggestion,
  mergeSuggestedTags,
  applySuggestionIfEmpty,
} from './idea-suggestions'

describe('Idea suggestions', () => {
  it('matches a prepared title without changing the stored title', () => {
    const suggestion = findIdeaSuggestion('  为什么公司名字叫 LKSOFT？  ')
    expect(suggestion?.suggestedFormat).toBe('Brand Story / Q&A')
    expect(suggestion?.tags).toContain('老板IP')
  })

  it('never replaces an existing user value', () => {
    expect(applySuggestionIfEmpty('Steven 的实际观点', '预设建议')).toBe('Steven 的实际观点')
    expect(applySuggestionIfEmpty('', '预设建议')).toBe('预设建议')
  })

  it('adds missing tags without deleting or duplicating user tags', () => {
    expect(mergeSuggestedTags('老板IP, 自订标签', ['老板IP', '创业'])).toBe(
      '老板IP, 自订标签, 创业',
    )
  })
})
