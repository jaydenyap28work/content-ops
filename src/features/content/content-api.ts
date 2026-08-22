import { supabase } from '../../lib/supabase'
import { loadClients } from '../admin/admin-api'
import type { ClientRecord } from '../admin/admin-api'
import { loadContributorOptions, loadIdeas, loadReferences } from '../research/research-api'
import type { CategoryRecord, ContributorOption, IdeaRecord, ReferenceRecord } from '../research/research-api'

export type ContentStatus =
  | 'draft'
  | 'ready_to_shoot'
  | 'shooting'
  | 'shot_awaiting_edit'
  | 'editing'
  | 'first_cut_submitted'
  | 'internal_review'
  | 'revision_required'
  | 'client_review'
  | 'approved'
  | 'ready_for_publishing'
  | 'analytics_tracking'
  | 'completed'
  | 'cancelled'

export interface CampaignRecord {
  id: string
  workspace_id: string
  client_id: string
  name: string
  description: string | null
  starts_on: string | null
  ends_on: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface ContentRecord {
  id: string
  workspace_id: string
  client_id: string
  source_idea_id: string | null
  content_code: string
  title: string
  working_title: string | null
  category_id: string | null
  campaign_id: string | null
  objective: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  current_status: ContentStatus
  current_owner_user_id: string | null
  current_owner_name: string | null
  internal_notes: string | null
  private_management_notes: string | null
  client_visible_notes: string | null
  direct_creation_reason: string | null
  record_status: 'active' | 'archived'
  created_by: string
  created_at: string
  updated_at: string
  archived_at: string | null
  archive_reason: string | null
  tags: string[]
  contributors: Array<{ userId: string; roleId: string; notes: string | null }>
}

export interface ContentCatalog {
  clients: ClientRecord[]
  categories: CategoryRecord[]
  campaigns: CampaignRecord[]
}

export interface ContentDetail {
  content: ContentRecord
  sourceIdea: IdeaRecord | null
  sourceReferences: ReferenceRecord[]
}

export interface ContentFormValues {
  id?: string
  clientId: string
  title: string
  workingTitle: string
  categoryId: string | null
  campaignId: string | null
  objective: string
  priority: string
  ownerUserId: string | null
  internalNotes: string
  privateManagementNotes: string
  clientVisibleNotes: string
  directCreationReason: string
  tags: string[]
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function loadCampaigns(workspaceId: string) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, workspace_id, client_id, name, description, starts_on, ends_on, status, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('name')
  fail(error)
  return (data ?? []) as CampaignRecord[]
}

export async function loadContentCatalog(workspaceId: string): Promise<ContentCatalog> {
  const [clients, categories, campaigns] = await Promise.all([
    loadClients(workspaceId),
    supabase
      .from('content_categories')
      .select('id, client_id, name')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('sort_order'),
    loadCampaigns(workspaceId),
  ])
  fail(categories.error)
  return {
    clients: clients.filter((client) => client.status === 'active'),
    categories: (categories.data ?? []) as CategoryRecord[],
    campaigns,
  }
}

export async function loadContents(workspaceId: string, contentId?: string) {
  const result = await supabase.rpc('list_contents', {
    target_workspace_id: workspaceId,
    target_content_id: contentId ?? null,
  })
  fail(result.error)
  const rows = (result.data ?? []) as Omit<ContentRecord, 'tags' | 'contributors'>[]
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return []
  const [tagLinks, contributors] = await Promise.all([
    supabase.from('content_tags').select('content_id, tag_id').in('content_id', ids),
    supabase.from('content_contributors').select('content_id, user_profile_id, contribution_role_id, notes').in('content_id', ids).eq('status', 'active'),
  ])
  fail(tagLinks.error); fail(contributors.error)
  const tagIds = [...new Set((tagLinks.data ?? []).map((row) => row.tag_id as string))]
  const tags = tagIds.length
    ? await supabase.from('tags').select('id, name').in('id', tagIds)
    : { data: [], error: null }
  fail(tags.error)
  return rows.map((row) => ({
    ...row,
    tags: (tagLinks.data ?? [])
      .filter((item) => item.content_id === row.id)
      .map((item) => (tags.data ?? []).find((tag) => tag.id === item.tag_id)?.name as string)
      .filter(Boolean),
    contributors: (contributors.data ?? [])
      .filter((item) => item.content_id === row.id)
      .map((item) => ({
        userId: item.user_profile_id as string,
        roleId: item.contribution_role_id as string,
        notes: item.notes as string | null,
      })),
  })) as ContentRecord[]
}

export async function loadContentDetail(workspaceId: string, contentId: string): Promise<ContentDetail | null> {
  const [contents, ideas, references] = await Promise.all([
    loadContents(workspaceId, contentId),
    loadIdeas(workspaceId),
    loadReferences(workspaceId),
  ])
  const content = contents[0]
  if (!content) return null
  const sourceIdea = ideas.find((idea) => idea.id === content.source_idea_id) ?? null
  const sourceReferences = sourceIdea
    ? references.filter((reference) => sourceIdea.referenceIds.includes(reference.id))
    : []
  return { content, sourceIdea, sourceReferences }
}

export async function saveCampaign(workspaceId: string, values: {
  id?: string
  clientId: string
  name: string
  description: string
  startsOn: string
  endsOn: string
}) {
  const { data, error } = await supabase.rpc('save_campaign', {
    target_campaign_id: values.id ?? null,
    target_workspace_id: workspaceId,
    target_client_id: values.clientId,
    target_name: values.name,
    target_description: values.description,
    target_starts_on: values.startsOn || null,
    target_ends_on: values.endsOn || null,
  })
  fail(error)
  return data as string
}

export async function archiveCampaign(id: string) {
  const { error } = await supabase.rpc('archive_campaign', { target_campaign_id: id })
  fail(error)
}

export async function saveContent(workspaceId: string, values: ContentFormValues) {
  const { data, error } = await supabase.rpc('save_content', {
    target_content_id: values.id ?? null,
    target_workspace_id: workspaceId,
    target_client_id: values.clientId,
    target_title: values.title,
    target_working_title: values.workingTitle,
    target_category_id: values.categoryId,
    target_campaign_id: values.campaignId,
    target_objective: values.objective,
    target_priority: values.priority,
    target_owner_user_id: values.ownerUserId,
    target_internal_notes: values.internalNotes,
    target_private_management_notes: values.privateManagementNotes,
    target_client_visible_notes: values.clientVisibleNotes,
    target_direct_creation_reason: values.directCreationReason,
    target_tag_names: values.tags,
  })
  fail(error)
  return data as string
}

export async function convertIdeaToContent(ideaId: string, values: {
  title: string
  workingTitle: string
  campaignId: string | null
  objective: string
  ownerUserId: string | null
  internalNotes: string
  privateManagementNotes: string
  clientVisibleNotes: string
  tags: string[]
}) {
  const { data, error } = await supabase.rpc('convert_idea_to_content', {
    target_idea_id: ideaId,
    target_title: values.title,
    target_working_title: values.workingTitle,
    target_campaign_id: values.campaignId,
    target_objective: values.objective,
    target_owner_user_id: values.ownerUserId,
    target_internal_notes: values.internalNotes,
    target_private_management_notes: values.privateManagementNotes,
    target_client_visible_notes: values.clientVisibleNotes,
    target_tag_names: values.tags,
  })
  fail(error)
  const created = (data ?? [])[0] as { content_id: string; content_code: string } | undefined
  if (!created) throw new Error('Content conversion did not return a Content record')
  return created
}

export async function archiveContent(id: string, reason: string) {
  const { error } = await supabase.rpc('archive_content', {
    target_content_id: id,
    target_reason: reason,
  })
  fail(error)
}

export async function loadContentOwnerOptions(clientId: string): Promise<ContributorOption[]> {
  return loadContributorOptions(clientId)
}
