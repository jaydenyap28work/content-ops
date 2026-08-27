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
