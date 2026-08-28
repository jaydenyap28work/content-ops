import { describe, expect, it } from 'vitest'
import { canAccessAppPath, canManageIdeaDecisions, isIdeaContributorOnly } from './role-access'

describe('Idea Contributor route access', () => {
  it('allows a contributor-only user to access only the Idea pool', () => {
    const roles = ['Idea Contributor']
    expect(isIdeaContributorOnly(roles)).toBe(true)
    expect(canAccessAppPath(roles, '/ideas')).toBe(true)
    for (const path of ['/', '/content', '/calendar', '/team', '/analytics', '/settings']) {
      expect(canAccessAppPath(roles, path)).toBe(false)
    }
    expect(canManageIdeaDecisions(roles)).toBe(false)
  })

  it('does not reduce access when a user also has an operational role', () => {
    const roles = ['Idea Contributor', 'Internal Manager']
    expect(isIdeaContributorOnly(roles)).toBe(false)
    expect(canAccessAppPath(roles, '/content')).toBe(true)
    expect(canManageIdeaDecisions(roles)).toBe(true)
  })
})