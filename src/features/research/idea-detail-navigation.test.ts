import { describe, expect, it } from 'vitest'
import { normalizeIdeaText, readIdeaPlanViewState, safeIdeaPlanBackPath, writeIdeaPlanViewState } from './idea-detail-navigation'

describe('Idea detail navigation and reading',()=>{
  it('round-trips planner filters for detail back navigation',()=>{
    const state=readIdeaPlanViewState(new URLSearchParams('q=GST&status=confirmed&client=lksoft&category=tax&source=with&view=board'))
    expect(state).toEqual({search:'GST',status:'confirmed',clientId:'lksoft',categoryId:'tax',reference:'with',view:'board'})
    expect(writeIdeaPlanViewState(state).toString()).toBe('q=GST&status=confirmed&client=lksoft&category=tax&source=with&view=board')
  })
  it('collapses excessive blank lines only for rendering',()=>{
    const original='角色：Steven\n\n\n\n台词：市场不只是变差\n动作：看镜头'
    expect(normalizeIdeaText(original)).toBe('角色：Steven\n\n台词：市场不只是变差\n动作：看镜头')
    expect(original).toContain('\n\n\n\n')
  })
  it('accepts only safe Content Plan back paths',()=>{
    expect(safeIdeaPlanBackPath('/ideas?status=confirmed')).toBe('/ideas?status=confirmed')
    expect(safeIdeaPlanBackPath('/content')).toBe('/ideas')
  })
})