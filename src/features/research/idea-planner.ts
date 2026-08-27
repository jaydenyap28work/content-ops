import type { IdeaRecord, PlanningStatus } from './research-api'

export const ideaStatusLabels = {
  new: 'New', evaluating: 'Evaluating', approved: 'Approved', converted: 'Converted', rejected: 'Rejected', archived: 'Archived',
} as const
export const planningStatusLabels: Record<PlanningStatus, { zh: string; en: string }> = {
  new: { zh: '新选题', en: 'New Idea' },
  evaluating: { zh: '待确认', en: 'Awaiting Decision' },
  confirmed: { zh: '已确认', en: 'Confirmed' },
  paused: { zh: '暂缓', en: 'Paused' },
  rejected: { zh: '不采用', en: 'Not Selected' },
  archived: { zh: '已归档', en: 'Archived' },
}

export interface PlannerFilters {
  search: string
  status: PlanningStatus | 'decision' | 'all'
  clientId: string
  categoryId: string
  reference: 'all' | 'with' | 'without'
}

export function planningStatusLabel(status: PlanningStatus, language: 'zh-CN' | 'en') {
  return planningStatusLabels[status][language === 'zh-CN' ? 'zh' : 'en']
}

export function productionProgressLabel(status: string | null, language: 'zh-CN' | 'en') {
  if (!status) return null
  const zh = language === 'zh-CN'
  if (['draft', 'ready_to_shoot'].includes(status)) return zh ? '待拍摄' : 'Awaiting Shoot'
  if (status === 'shooting') return zh ? '拍摄中' : 'Shooting'
  if (status === 'shot_awaiting_edit') return zh ? '待剪辑' : 'Awaiting Edit'
  if (status === 'editing') return zh ? '剪辑中' : 'Editing'
  if (['first_cut_submitted', 'internal_review', 'client_review', 'revision_required'].includes(status)) return zh ? '审核中' : 'In Review'
  if (['approved', 'ready_for_publishing'].includes(status)) return zh ? '待发布' : 'Ready to Publish'
  if (['analytics_tracking', 'completed'].includes(status)) return zh ? '已发布' : 'Published'
  return zh ? '制作中' : 'In Production'
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
    if (filters.status === 'decision' && !['new','evaluating'].includes(idea.planning_status)) return false
    if (filters.status !== 'all' && filters.status !== 'decision' && idea.planning_status !== filters.status) return false
    if (filters.clientId !== 'all' && idea.client_id !== filters.clientId) return false
    if (filters.categoryId !== 'all' && idea.category_id !== filters.categoryId) return false
    if (filters.reference === 'with' && idea.referenceIds.length === 0) return false
    if (filters.reference === 'without' && idea.referenceIds.length > 0) return false
    return !term || [idea.title, idea.original_topic ?? '', idea.our_angle ?? '', ...idea.tags]
      .some((value) => value.toLocaleLowerCase('en').includes(term))
  }))
}

export function getDisplayedProductionStatus(idea: IdeaRecord, language: 'zh-CN' | 'en' = 'en') {
  return idea.status === 'converted' ? productionProgressLabel(idea.linked_content_status, language) : null
}

export function getNextActionLabel(idea: IdeaRecord, language: 'zh-CN' | 'en' = 'en') {
  const zh = language === 'zh-CN'
  if (idea.status === 'converted') return idea.linked_content_id ? (zh ? '打开制作内容' : 'Open Production Content') : (zh ? '查找制作内容' : 'Find Production Content')
  if (idea.planning_status === 'new') return zh ? '交给老板确认' : 'Send for Decision'
  if (idea.planning_status === 'evaluating') return zh ? '等待决定' : 'Await Decision'
  if (idea.planning_status === 'confirmed') return zh ? '进入制作中心' : 'Open Production Center'
  return zh ? '查看详情' : 'Review details'
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