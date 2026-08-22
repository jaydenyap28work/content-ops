import type { IdeaRecord, IdeaStatus } from './research-api'

export const ideaStatusLabels: Record<IdeaStatus, string> = {
  new: 'New',
  evaluating: 'Evaluating',
  approved: 'Approved',
  converted: 'Converted',
  rejected: 'Rejected',
  archived: 'Archived',
}

export const contentStatusLabels: Record<string, string> = {
  draft: 'Draft',
  ready_to_shoot: 'Ready to Shoot',
  shooting: 'Shooting',
  shot_awaiting_edit: 'Awaiting Edit',
  editing: 'Editing',
  first_cut_submitted: 'First Cut Submitted',
  internal_review: 'Review',
  revision_required: 'Revision Required',
  client_review: 'Client Review',
  approved: 'Approved',
  ready_for_publishing: 'Ready for Publishing',
  analytics_tracking: 'Analytics Tracking',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export interface PlannerFilters {
  search: string
  status: IdeaStatus | 'all'
  clientId: string
  categoryId: string
  reference: 'all' | 'with' | 'without'
}

export function sortIdeasByPlannedDate(ideas: IdeaRecord[]) {
  return [...ideas].sort((left, right) => {
    if (!left.planned_date && !right.planned_date) return right.updated_at.localeCompare(left.updated_at)
    if (!left.planned_date) return 1
    if (!right.planned_date) return -1
    const byDate = left.planned_date.localeCompare(right.planned_date)
    return byDate || left.title.localeCompare(right.title)
  })
}

export function filterPlannerIdeas(ideas: IdeaRecord[], filters: PlannerFilters) {
  const term = filters.search.trim().toLocaleLowerCase('en')
  return sortIdeasByPlannedDate(ideas.filter((idea) => {
    if (filters.status !== 'all' && idea.status !== filters.status) return false
    if (filters.clientId !== 'all' && idea.client_id !== filters.clientId) return false
    if (filters.categoryId !== 'all' && idea.category_id !== filters.categoryId) return false
    if (filters.reference === 'with' && idea.referenceIds.length === 0) return false
    if (filters.reference === 'without' && idea.referenceIds.length > 0) return false
    return !term || [idea.title, idea.original_topic ?? '', idea.our_angle ?? '', ...idea.tags]
      .some((value) => value.toLocaleLowerCase('en').includes(term))
  }))
}

export function getDisplayedProductionStatus(idea: IdeaRecord) {
  if (idea.status !== 'converted' || !idea.linked_content_status) return null
  return contentStatusLabels[idea.linked_content_status] ?? idea.linked_content_status
}

export function getNextActionLabel(idea: IdeaRecord) {
  if (idea.status === 'new') return 'Start evaluation'
  if (idea.status === 'evaluating') return 'Approve Idea'
  if (idea.status === 'approved') return 'Convert to Content'
  if (idea.status === 'converted') return idea.linked_content_id ? 'Open Content' : 'Find linked Content'
  if (idea.status === 'rejected' || idea.status === 'archived') return 'Re-open evaluation'
  return 'Review details'
}

export function formatPlannedDate(value: string | null, compact = false) {
  if (!value) return 'Unscheduled'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 4))
  return new Intl.DateTimeFormat('en-MY', compact
    ? { day: '2-digit', month: 'short', timeZone: 'Asia/Kuala_Lumpur' }
    : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })
    .format(date)
}
