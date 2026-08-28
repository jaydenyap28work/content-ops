export const IDEA_CONTRIBUTOR_ROLE = 'Idea Contributor'

const broaderInternalRoles = new Set([
  'Super Admin',
  'Internal Manager',
  'Strategist / Content Planner',
  'Shooter',
  'Editor',
  'Publisher / Marketing',
  'Intern',
])

export function isIdeaContributorOnly(roles: string[]) {
  return roles.includes(IDEA_CONTRIBUTOR_ROLE)
    && !roles.some((role) => broaderInternalRoles.has(role))
}

export function canAccessAppPath(roles: string[], pathname: string) {
  if (!isIdeaContributorOnly(roles)) return true
  return pathname === '/ideas'
}

export function canManageIdeaDecisions(roles: string[]) {
  return roles.includes('Super Admin')
    || roles.includes('Internal Manager')
    || roles.includes('Strategist / Content Planner')
}