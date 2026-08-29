import { supabase } from '../../lib/supabase'
import type { ContentStatus } from './content-api'
import type { ContributionRoleRecord } from '../research/research-api'

export type WorkflowAction =
  | 'mark_ready_to_shoot'
  | 'start_shooting'
  | 'complete_shooting'
  | 'start_editing'

export interface ProductionDates {
  shoot_scheduled_at: string | null
  shooting_started_at: string | null
  shooting_completed_at: string | null
  editing_started_at: string | null
}

export interface ContentContributorRecord {
  id: string
  user_profile_id: string | null
  team_member_id: string
  display_name: string
  contribution_role_id: string
  contribution_role_code: string
  contribution_role_name: string
  notes: string | null
  status: 'active' | 'removed'
  added_by: string
  created_at: string
  removed_at: string | null
  removed_by: string | null
}

export interface WorkflowEventRecord {
  id: string
  actor_user_id: string
  actor_name: string
  event_type: string
  from_state: ContentStatus
  to_state: ContentStatus
  occurred_at: string
  notes: string | null
  metadata: Record<string, unknown>
}

export interface ActivityLogRecord {
  id: string
  actor_user_id: string
  actor_name: string
  entity_type: 'content' | 'content_contributor'
  entity_id: string
  action: string
  occurred_at: string
  metadata: Record<string, unknown>
}

export interface WorkflowBundle {
  production: ProductionDates
  contributors: ContentContributorRecord[]
  events: WorkflowEventRecord[]
  activity: ActivityLogRecord[]
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function loadWorkflowBundle(contentId: string): Promise<WorkflowBundle> {
  const [production, contributors, events, activity] = await Promise.all([
    supabase.rpc('get_content_production', { target_content_id: contentId }),
    supabase.rpc('list_content_contributors', { target_content_id: contentId }),
    supabase.rpc('list_workflow_events', { target_content_id: contentId }),
    supabase.rpc('list_content_activity', { target_content_id: contentId }),
  ])
  fail(production.error); fail(contributors.error); fail(events.error); fail(activity.error)
  return {
    production: ((production.data ?? [])[0] ?? {
      shoot_scheduled_at: null,
      shooting_started_at: null,
      shooting_completed_at: null,
      editing_started_at: null,
    }) as ProductionDates,
    contributors: (contributors.data ?? []) as ContentContributorRecord[],
    events: (events.data ?? []) as WorkflowEventRecord[],
    activity: (activity.data ?? []) as ActivityLogRecord[],
  }
}

export interface ProductionTeamMember { id:string; name:string; job_title:string|null; email:string|null; auth_user_id:string|null; login_status:'not_enabled'|'invited'|'enabled'; status:'active'|'inactive' }
export async function loadWorkflowAssignmentCatalog(workspaceId: string, clientId: string) {
  const [people, roles] = await Promise.all([
    supabase.rpc('list_production_team_members', { target_workspace_id: workspaceId, target_client_id: clientId }),
    supabase.from('contribution_roles').select('id, code, name').eq('workspace_id', workspaceId).eq('is_active', true).in('code',['owner','talent','director','shooter','editor','reviewer','publisher','copywriter','designer']).order('sort_order'),
  ])
  fail(people.error); fail(roles.error)
  return { people: (people.data ?? []) as ProductionTeamMember[], roles: (roles.data ?? []) as ContributionRoleRecord[] }
}

export async function performWorkflowAction(
  contentId: string,
  action: WorkflowAction,
  expectedFromState: ContentStatus,
  note: string,
) {
  const { data, error } = await supabase.rpc('perform_content_workflow_action', {
    target_content_id: contentId,
    target_action: action,
    expected_from_state: expectedFromState,
    target_note: note,
  })
  fail(error)
  const result = (data ?? [])[0] as { event_id: string; new_status: ContentStatus; occurred_at: string } | undefined
  if (!result) throw new Error('Workflow action did not return a result')
  return result
}

export async function setShootSchedule(contentId: string, scheduledAt: string | null) {
  const { error } = await supabase.rpc('set_content_shoot_schedule', {
    target_content_id: contentId,
    target_shoot_scheduled_at: scheduledAt,
  })
  fail(error)
}

export async function assignContentTeamMember(values: { contentId:string; teamMemberId:string; roleCode:string; notes:string }) {
  const { data, error } = await supabase.rpc('assign_content_team_member', {
    target_content_id: values.contentId, target_team_member_id: values.teamMemberId,
    target_role_code: values.roleCode, target_notes: values.notes,
  })
  fail(error)
  return data as string
}

export async function removeContentContributor(contributorId: string) {
  const { error } = await supabase.rpc('remove_content_contributor', {
    target_contributor_id: contributorId,
  })
  fail(error)
}
export async function bulkUpdateProductionItems(contentIds: string[], field: 'owner' | 'planned_shoot_date', value: string) {
  const { data, error } = await supabase.rpc('bulk_update_production_items', {
    target_content_ids: contentIds, target_field: field, target_value: value,
  })
  fail(error)
  return data as number
}

export type ProductionRoleCode = 'owner'|'talent'|'director'|'shooter'|'editor'|'reviewer'|'publisher'|'copywriter'|'designer'
export async function bulkAssignContentTeamMember(contentIds:string[], teamMemberId:string, roleCode:ProductionRoleCode) {
  const { data, error } = await supabase.rpc('bulk_assign_content_team_member', {
    target_content_ids: contentIds, target_team_member_id: teamMemberId, target_role_code: roleCode,
  })
  fail(error)
  return data as number
}

export async function bulkPerformWorkflowAction(contentIds: string[], action: WorkflowAction, expectedState: ContentStatus, note = '') {
  const { data, error } = await supabase.rpc('bulk_perform_content_workflow_action', {
    target_content_ids: contentIds, target_action: action, expected_from_state: expectedState, target_note: note,
  })
  fail(error)
  return data as number
}
