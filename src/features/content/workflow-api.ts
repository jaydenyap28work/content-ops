import { supabase } from '../../lib/supabase'
import type { ContentStatus } from './content-api'
import type { ContributionRoleRecord, ContributorOption } from '../research/research-api'

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
  user_profile_id: string
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

export async function loadWorkflowAssignmentCatalog(workspaceId: string, clientId: string) {
  const [people, roles] = await Promise.all([
    supabase.rpc('list_research_contributors', { target_client_id: clientId }),
    supabase
      .from('contribution_roles')
      .select('id, code, name')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('sort_order'),
  ])
  fail(people.error); fail(roles.error)
  return {
    people: (people.data ?? []) as ContributorOption[],
    roles: (roles.data ?? []) as ContributionRoleRecord[],
  }
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

export async function assignContentContributor(values: {
  contentId: string
  userId: string
  contributionRoleId: string
  notes: string
}) {
  const { data, error } = await supabase.rpc('assign_content_contributor', {
    target_content_id: values.contentId,
    target_user_id: values.userId,
    target_contribution_role_id: values.contributionRoleId,
    target_notes: values.notes,
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
