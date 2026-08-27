import { supabase } from '../../lib/supabase'
import { loadClients } from '../admin/admin-api'
import type { ClientRecord } from '../admin/admin-api'

export interface PlatformRecord { id: string; code: string; name: string }
export interface CategoryRecord { id: string; client_id: string | null; name: string }
export interface ContributionRoleRecord { id: string; code: string; name: string }
export interface ContributorOption { user_profile_id: string; display_name: string }

export interface ReferenceRecord {
  id: string
  workspace_id: string
  client_id: string | null
  reference_type: 'account' | 'content'
  title: string
  account_name: string | null
  platform_id: string | null
  url: string
  industry: string | null
  country: string | null
  content_style: string | null
  format: string | null
  why_it_works: string | null
  learning_notes: string | null
  gold_standard: boolean
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  relatedClientIds: string[]
  tags: string[]
  relatedIdeaIds: string[]
}

export type IdeaStatus = 'new' | 'evaluating' | 'approved' | 'converted' | 'rejected' | 'archived'
export type PlanningStatus = 'new' | 'evaluating' | 'confirmed' | 'paused' | 'rejected' | 'archived'

export interface IdeaRecord {
  id: string
  workspace_id: string
  client_id: string
  title: string
  planned_date: string | null
  shoot_planned_at: string | null
  planned_shoot_date?: string | null
  source_url: string | null
  original_topic: string | null
  original_hook: string | null
  why_it_works: string | null
  our_angle: string | null
  category_id: string | null
  suggested_format: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: IdeaStatus
  planning_status: PlanningStatus
  owner_user_id: string | null
  created_by: string
  owner_name: string | null
  creator_name: string | null
  linked_content_id: string | null
  linked_content_code: string | null
  linked_content_status: string | null
  linked_content_record_status: string | null
  linked_content_planned_date: string | null
  linked_content_planned_shoot_date?: string | null
  linked_content_shoot_scheduled_at: string | null
  notes: string | null
  status_reason: string | null
  created_at: string
  updated_at: string
  referenceIds: string[]
  tags: string[]
  contributors: Array<{ userId: string; roleId: string; notes: string | null }>
}

export interface ResearchCatalog {
  clients: ClientRecord[]
  platforms: PlatformRecord[]
  categories: CategoryRecord[]
  contributionRoles: ContributionRoleRecord[]
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function loadResearchCatalog(workspaceId: string): Promise<ResearchCatalog> {
  const [clients, platforms, categories, contributionRoles] = await Promise.all([
    loadClients(workspaceId),
    supabase.from('platforms').select('id, code, name').eq('is_active', true).order('sort_order'),
    supabase.from('content_categories').select('id, client_id, name').eq('workspace_id', workspaceId).eq('is_active', true).order('sort_order'),
    supabase.from('contribution_roles').select('id, code, name').eq('workspace_id', workspaceId).eq('is_active', true).order('sort_order'),
  ])
  fail(platforms.error); fail(categories.error); fail(contributionRoles.error)
  return {
    clients: clients.filter((client) => client.status === 'active'),
    platforms: (platforms.data ?? []) as PlatformRecord[],
    categories: (categories.data ?? []) as CategoryRecord[],
    contributionRoles: (contributionRoles.data ?? []) as ContributionRoleRecord[],
  }
}

export async function loadReferences(workspaceId: string) {
  const refs = await supabase.from('references').select('id, workspace_id, client_id, reference_type, title, account_name, platform_id, url, industry, country, content_style, format, why_it_works, learning_notes, gold_standard, status, created_at, updated_at').eq('workspace_id', workspaceId).order('updated_at', { ascending: false })
  fail(refs.error)
  const ids = (refs.data ?? []).map((row) => row.id as string)
  if (ids.length === 0) return []
  const [related, tagLinks, ideaLinks] = await Promise.all([
    supabase.from('reference_clients').select('reference_id, client_id').in('reference_id', ids),
    supabase.from('reference_tags').select('reference_id, tag_id').in('reference_id', ids),
    supabase.from('idea_references').select('idea_id, reference_id').in('reference_id', ids),
  ])
  fail(related.error); fail(tagLinks.error); fail(ideaLinks.error)
  const tagIds = [...new Set((tagLinks.data ?? []).map((row) => row.tag_id as string))]
  const tags = tagIds.length ? await supabase.from('tags').select('id, name').in('id', tagIds) : { data: [], error: null }
  fail(tags.error)
  return (refs.data ?? []).map((row) => ({
    ...row,
    relatedClientIds: (related.data ?? []).filter((item) => item.reference_id === row.id).map((item) => item.client_id as string),
    tags: (tagLinks.data ?? []).filter((item) => item.reference_id === row.id).map((item) => (tags.data ?? []).find((tag) => tag.id === item.tag_id)?.name as string).filter(Boolean),
    relatedIdeaIds: (ideaLinks.data ?? []).filter((item) => item.reference_id === row.id).map((item) => item.idea_id as string),
  })) as ReferenceRecord[]
}

export async function loadIdeas(workspaceId: string) {
  const [ideas, plannerContext] = await Promise.all([
    supabase.from('ideas').select('id, workspace_id, client_id, title, planned_date, shoot_planned_at, planned_shoot_date, source_url, original_topic, original_hook, why_it_works, our_angle, category_id, suggested_format, priority, status, planning_status, owner_user_id, created_by, notes, status_reason, created_at, updated_at').eq('workspace_id', workspaceId).order('planned_shoot_date', { ascending: true, nullsFirst: false }),
    supabase.rpc('list_idea_planner_context', { target_workspace_id: workspaceId }),
  ])
  fail(ideas.error); fail(plannerContext.error)
  const ids = (ideas.data ?? []).map((row) => row.id as string)
  if (ids.length === 0) return []
  const [refs, contributors, tagLinks] = await Promise.all([
    supabase.from('idea_references').select('idea_id, reference_id').in('idea_id', ids),
    supabase.from('idea_contributors').select('idea_id, user_profile_id, contribution_role_id, notes').in('idea_id', ids),
    supabase.from('idea_tags').select('idea_id, tag_id').in('idea_id', ids),
  ])
  fail(refs.error); fail(contributors.error); fail(tagLinks.error)
  const tagIds = [...new Set((tagLinks.data ?? []).map((row) => row.tag_id as string))]
  const tags = tagIds.length ? await supabase.from('tags').select('id, name').in('id', tagIds) : { data: [], error: null }
  fail(tags.error)
  return (ideas.data ?? []).map((row) => ({
    ...row,
    ...(plannerContext.data ?? []).find((item: { idea_id: string }) => item.idea_id === row.id),
    referenceIds: (refs.data ?? []).filter((item) => item.idea_id === row.id).map((item) => item.reference_id as string),
    tags: (tagLinks.data ?? []).filter((item) => item.idea_id === row.id).map((item) => (tags.data ?? []).find((tag) => tag.id === item.tag_id)?.name as string).filter(Boolean),
    contributors: (contributors.data ?? []).filter((item) => item.idea_id === row.id).map((item) => ({ userId: item.user_profile_id as string, roleId: item.contribution_role_id as string, notes: item.notes as string | null })),
  })) as IdeaRecord[]
}

export async function saveReference(workspaceId: string, values: {
  id?: string; clientId: string | null; type: 'account' | 'content'; title: string; accountName: string;
  platformId: string | null; url: string; industry: string; country: string; contentStyle: string;
  format: string; whyItWorks: string; notes: string; goldStandard: boolean; relatedClientIds: string[]; tags: string[]
}) {
  const { data, error } = await supabase.rpc('save_reference', {
    target_reference_id: values.id ?? null, target_workspace_id: workspaceId, target_client_id: values.clientId,
    target_reference_type: values.type, target_title: values.title, target_account_name: values.accountName,
    target_platform_id: values.platformId, target_url: values.url, target_industry: values.industry,
    target_country: values.country, target_content_style: values.contentStyle, target_format: values.format,
    target_why_it_works: values.whyItWorks, target_learning_notes: values.notes, target_gold_standard: values.goldStandard,
    target_related_client_ids: values.relatedClientIds, target_tag_names: values.tags,
  })
  fail(error); return data as string
}

export async function archiveReference(id: string) {
  const { error } = await supabase.rpc('archive_reference', { target_reference_id: id }); fail(error)
}

export async function saveIdea(workspaceId: string, values: {
  id?: string; clientId: string; title: string; plannedDate: string; sourceUrl: string; originalTopic: string; originalHook: string;
  whyItWorks: string; ourAngle: string; categoryId: string | null; suggestedFormat: string; priority: string;
  ownerUserId: string | null; notes: string; referenceIds: string[]; tags: string[];
  contributors: Array<{ userId: string; roleId: string; notes?: string }>
}) {
  const { data, error } = await supabase.rpc('save_idea', {
    target_idea_id: values.id ?? null, target_workspace_id: workspaceId, target_client_id: values.clientId,
    target_title: values.title, target_source_url: values.sourceUrl, target_original_topic: values.originalTopic,
    target_original_hook: values.originalHook, target_why_it_works: values.whyItWorks, target_our_angle: values.ourAngle,
    target_category_id: values.categoryId, target_suggested_format: values.suggestedFormat, target_priority: values.priority,
    target_owner_user_id: values.ownerUserId, target_notes: values.notes, target_reference_ids: values.referenceIds,
    target_tag_names: values.tags, target_contributors: values.contributors,
    target_planned_date: values.plannedDate || null,
  })
  fail(error); return data as string
}

export async function createIdeaFromReference(workspaceId: string, referenceId: string, values: {
  clientId: string; title: string; ourAngle: string; categoryId: string | null; priority: string; notes: string; tags: string[]
}) {
  const { data, error } = await supabase.rpc('create_idea_from_reference', {
    target_reference_id: referenceId, target_workspace_id: workspaceId, target_client_id: values.clientId,
    target_title: values.title, target_our_angle: values.ourAngle, target_category_id: values.categoryId,
    target_priority: values.priority, target_notes: values.notes, target_tag_names: values.tags,
  })
  fail(error); return data as string
}

export async function changeIdeaStatus(id: string, status: IdeaStatus, reason = '') {
  const { error } = await supabase.rpc('change_idea_status', { target_idea_id: id, target_status: status, target_reason: reason }); fail(error)
}

export async function loadContributorOptions(clientId: string) {
  const { data, error } = await supabase.rpc('list_research_contributors', { target_client_id: clientId }); fail(error)
  return (data ?? []) as ContributorOption[]
}
