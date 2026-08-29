import { describe, expect, it } from 'vitest'
import { teamMemberLoginLabel } from './active-team-members'

describe('Team Member lifecycle labels', () => {
  it('keeps roster state conceptually independent from login access', () => {
    expect(teamMemberLoginLabel('not_enabled', true)).toBe('未启用')
    expect(teamMemberLoginLabel('enabled', true)).toBe('已启用')
    expect(teamMemberLoginLabel('disabled', true)).toBe('访问已停用')
    expect(teamMemberLoginLabel('disabled', false)).toBe('Access disabled')
  })
})
