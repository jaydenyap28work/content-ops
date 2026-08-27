import { describe, expect, it } from 'vitest'
import { productionBoardStage } from './production-model'

describe('production board', () => {
  it('keeps workflow and publication state separate while showing published work', () => {
    expect(productionBoardStage({ current_status: 'editing', publication_state: 'not_published' })).toBe('editing')
    expect(productionBoardStage({ current_status: 'ready_for_publishing', publication_state: 'fully_published' })).toBe('published')
  })
})
