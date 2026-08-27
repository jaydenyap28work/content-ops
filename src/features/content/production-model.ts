import type { ContentRecord } from './content-api'

export function productionBoardStage(content: Pick<ContentRecord, 'current_status' | 'publication_state'>) {
  if (content.publication_state === 'fully_published' && content.current_status === 'ready_for_publishing') return 'published'
  return content.current_status
}

export const productionBoardStages = [
  'ready_to_shoot', 'shooting', 'shot_awaiting_edit', 'editing', 'first_cut_submitted',
  'internal_review', 'revision_required', 'ready_for_publishing', 'published',
  'analytics_tracking', 'completed',
] as const

const beforeEditing = new Set(['draft', 'ready_to_shoot', 'shooting', 'shot_awaiting_edit'])
const afterShooting = new Set(['shot_awaiting_edit', 'editing', 'first_cut_submitted', 'internal_review', 'revision_required', 'client_review', 'approved', 'ready_for_publishing', 'analytics_tracking', 'completed'])
const afterApproval = new Set(['approved', 'ready_for_publishing', 'analytics_tracking', 'completed'])

function person(content: ContentRecord, role: 'editor' | 'reviewer') {
  return content.contributors.find((item) => item.roleCode === role)?.displayName || ''
}

function dateTime(value: string | null, language: 'zh-CN' | 'en') {
  if (!value) return ''
  return new Intl.DateTimeFormat(language === 'zh-CN' ? 'zh-CN' : 'en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}

export function productionTracker(content: ContentRecord, language: 'zh-CN' | 'en') {
  const zh = language === 'zh-CN'
  const status = content.current_status
  const editor = person(content, 'editor')
  const reviewer = person(content, 'reviewer')
  const publications = content.publications ?? []
  const scheduledPublication = publications.find((item) => item.status === 'scheduled')
  const failedPublication = publications.find((item) => item.status === 'failed')
  const publishedPlatforms = [...new Set(publications.filter((item) => item.status === 'published').map((item) => item.platformCode.toUpperCase()).filter(Boolean))]
  const plannedPlatforms = [...new Set(publications.filter((item) => ['draft', 'scheduled'].includes(item.status)).map((item) => item.platformCode.toUpperCase()).filter(Boolean))]

  let shooting = zh ? '未安排' : 'Not scheduled'
  if (status === 'shooting') shooting = zh ? '拍摄中' : 'Shooting'
  else if (afterShooting.has(status)) shooting = zh ? '✓ 已拍摄' : '✓ Shot'
  else if (content.shoot_scheduled_at) shooting = dateTime(content.shoot_scheduled_at, language)

  let editing = zh ? '待剪辑' : 'Awaiting edit'
  if (status === 'editing') editing = editor ? `${zh ? '剪辑中' : 'Editing'} · ${editor}` : (zh ? '剪辑中' : 'Editing')
  else if (['first_cut_submitted', 'internal_review', 'revision_required', 'client_review', 'approved', 'ready_for_publishing', 'analytics_tracking', 'completed'].includes(status)) editing = zh ? '初剪已提交' : 'First cut submitted'
  else if (beforeEditing.has(status) && editor) editing = `${zh ? '待剪辑' : 'Awaiting edit'} · ${editor}`

  let review = '—'
  if (status === 'first_cut_submitted') review = reviewer ? `${zh ? '等待' : 'Waiting for'} ${reviewer}` : (zh ? '等待审核' : 'Awaiting review')
  else if (['internal_review', 'client_review'].includes(status)) review = reviewer ? `${zh ? '等待' : 'Waiting for'} ${reviewer}` : (zh ? '审核中' : 'In review')
  else if (status === 'revision_required') review = zh ? '需要修改' : 'Revision required'
  else if (afterApproval.has(status)) review = zh ? '✓ 已通过' : '✓ Approved'

  let publishing = zh ? '未安排' : 'Not scheduled'
  if (content.publication_state === 'fully_published') publishing = `${zh ? '✓ 已发布' : '✓ Published'}${publishedPlatforms.length ? ` · ${publishedPlatforms.join(' + ')}` : ''}`
  else if (failedPublication) publishing = zh ? '发布失败' : 'Publication failed'
  else if (scheduledPublication) publishing = `${plannedPlatforms.join(' + ') || (zh ? '已排期' : 'Scheduled')} · ${dateTime(scheduledPublication.scheduledAt, language)}`
  else if (content.publication_state === 'partially_published') publishing = `${zh ? '部分已发布' : 'Partially published'} · ${publishedPlatforms.join(' + ')}`

  const next: Record<string, [string, string]> = {
    draft: ['安排拍摄', 'Schedule shoot'], ready_to_shoot: ['开始拍摄', 'Start shooting'], shooting: ['完成拍摄', 'Complete shooting'],
    shot_awaiting_edit: ['等待剪辑', 'Await editing'], editing: ['提交初剪', 'Submit first cut'], first_cut_submitted: ['审核初剪', 'Review first cut'],
    internal_review: ['完成审核', 'Complete review'], revision_required: ['修改内容', 'Revise content'], client_review: ['等待客户确认', 'Await client approval'],
    approved: ['准备发布', 'Prepare publishing'], ready_for_publishing: ['准备发布', 'Prepare publishing'], analytics_tracking: ['查看数据', 'Review analytics'], completed: ['查看数据', 'Review analytics'],
  }

  return { shooting, editing, review, publishing, nextAction: next[status]?.[zh ? 0 : 1] ?? (zh ? '查看详情' : 'View details') }
}