import { describe, expect, it } from 'vitest'
import { canAccessAppPath, canManageIdeaDecisions, canViewTeamReports, isIdeaContributorOnly } from './role-access'

describe('Idea Contributor route access', () => {
  it('allows a contributor-only user to access only the Idea pool', () => {
    const roles = ['Idea Contributor']
    expect(isIdeaContributorOnly(roles)).toBe(true)
    expect(canAccessAppPath(roles, '/ideas')).toBe(true)
    expect(canAccessAppPath(roles, '/ideas/idea-123')).toBe(true)
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
  it('keeps Team Reports limited to management and Marketing roles',()=>{
    expect(canViewTeamReports(['Super Admin'])).toBe(true)
    expect(canViewTeamReports(['Publisher / Marketing'])).toBe(true)
    expect(canAccessAppPath(['Idea Contributor'],'/team-reports')).toBe(false)
    expect(canAccessAppPath(['Editor'],'/team-reports')).toBe(false)
  })
})