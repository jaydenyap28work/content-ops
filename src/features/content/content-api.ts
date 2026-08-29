import { supabase } from '../../lib/supabase'
import { loadClients } from '../admin/admin-api'
import type { ClientRecord } from '../admin/admin-api'
import { loadContributorOptions, loadIdeas, loadReferences } from '../research/research-api'
import type { CategoryRecord, ContributorOption, IdeaRecord, ReferenceRecord } from '../research/research-api'
import { parseSkitContent } from '../pilot/skit-parser'
import type { ContentType, IdeaContentFormat } from '../research/idea-format'

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
  | 'graphic_in_production'
  | 'graphic_review'
  | 'published'

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
  content_type: ContentType | null
  content_format: IdeaContentFormat | null
  content_code: string
  title: string
  working_title: string | null
  category_id: string | null
  campaign_id: string | null
  objective: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  current_status: ContentStatus
  publication_state: 'not_published' | 'partially_published' | 'fully_published' | 'needs_attention'
  current_owner_user_id: string | null
  owner_team_member_id: string | null
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
  planned_date: string | null
  planned_shoot_date?: string | null
  shoot_scheduled_at?: string | null
  ownership_name: string
  ownership_type: 'internal_brand' | 'external_client'
  is_default_brand: boolean
  tags: string[]
  contributors: Array<{ userId: string; roleId: string; notes: string | null; displayName?: string; roleCode?: string; roleName?: string }>
  publications?: Array<{ platformCode: string; scheduledAt: string | null; publishedAt: string | null; status: string }>
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
  const [tagLinks, contributors, publications, taxonomy] = await Promise.all([
    supabase.from('content_tags').select('content_id, tag_id').in('content_id', ids),
    supabase.from('content_contributors').select('content_id, user_profile_id, team_member_id, contribution_role_id, notes').in('content_id', ids).eq('status', 'active'),
    supabase.from('publications').select('content_id, platform_id, is_required, status, scheduled_at, published_at').in('content_id', ids),
    supabase.from('contents').select('id, content_type, content_format').in('id', ids),
  ])
  fail(tagLinks.error); fail(contributors.error); fail(publications.error); fail(taxonomy.error)
  const tagIds = [...new Set((tagLinks.data ?? []).map((row) => row.tag_id as string))]
  const contributorTeamIds = [...new Set((contributors.data ?? []).map((row) => row.team_member_id as string).filter(Boolean))]
  const ownerTeamIds = [...new Set(rows.map((row) => row.owner_team_member_id as string).filter(Boolean))]
  const contributorRoleIds = [...new Set((contributors.data ?? []).map((row) => row.contribution_role_id as string))]
  const platformIds = [...new Set((publications.data ?? []).map((row) => row.platform_id as string))]
  const [tags, contributorTeams, ownerTeams, contributorRoles, platforms] = await Promise.all([
    tagIds.length ? supabase.from('tags').select('id, name').in('id', tagIds) : Promise.resolve({ data: [], error: null }),
    contributorTeamIds.length ? supabase.from('team_members').select('id, name').in('id', contributorTeamIds) : Promise.resolve({ data: [], error: null }),
    ownerTeamIds.length ? supabase.from('team_members').select('id, name').in('id', ownerTeamIds) : Promise.resolve({ data: [], error: null }),
    contributorRoleIds.length ? supabase.from('contribution_roles').select('id, code, name').in('id', contributorRoleIds) : Promise.resolve({ data: [], error: null }),
    platformIds.length ? supabase.from('platforms').select('id, code').in('id', platformIds) : Promise.resolve({ data: [], error: null }),
  ])
  fail(tags.error); fail(contributorTeams.error); fail(ownerTeams.error); fail(contributorRoles.error); fail(platforms.error)
  return rows.map((row) => {
    const publicationRows = (publications.data ?? []).filter((item) => item.content_id === row.id)
    const required = publicationRows.filter((item) => item.is_required)
    const published = required.filter((item) => item.status === 'published').length
    const attention = publicationRows.some((item) => item.status === 'failed' || (item.is_required && item.status === 'cancelled'))
    const publication_state = attention ? 'needs_attention' : !required.length || !published ? 'not_published' : published < required.length ? 'partially_published' : 'fully_published'
    return ({
    ...row,
    publication_state,
    current_owner_name: (ownerTeams.data ?? []).find((member) => member.id === row.owner_team_member_id)?.name as string ?? row.current_owner_name,
    tags: (tagLinks.data ?? [])
      .filter((item) => item.content_id === row.id)
      .map((item) => (tags.data ?? []).find((tag) => tag.id === item.tag_id)?.name as string)
      .filter(Boolean),
    contributors: (contributors.data ?? [])
      .filter((item) => item.content_id === row.id)
      .map((item) => ({
        userId: item.team_member_id as string,
        roleId: item.contribution_role_id as string,
        notes: item.notes as string | null,
        displayName: (contributorTeams.data ?? []).find((member) => member.id === item.team_member_id)?.name as string ?? '',
        roleCode: (contributorRoles.data ?? []).find((role) => role.id === item.contribution_role_id)?.code as string ?? '',
        roleName: (contributorRoles.data ?? []).find((role) => role.id === item.contribution_role_id)?.name as string ?? '',
      })),
    publications: publicationRows.map((item) => ({
      platformCode: (platforms.data ?? []).find((platform) => platform.id === item.platform_id)?.code as string ?? '',
      scheduledAt: item.scheduled_at as string | null,
      publishedAt: item.published_at as string | null,
      status: item.status as string,
    })),
  })}) as ContentRecord[]
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

export async function confirmIdeaForProduction(idea: Pick<IdeaRecord, 'id' | 'content_format' | 'raw_content'>) {
  const skitSegments = idea.content_format === 'skit' ? parseSkitContent(idea.raw_content ?? '') : []
  const { data, error } = await supabase.rpc('confirm_idea_for_production_v2', { target_idea_id: idea.id, target_skit_segments: skitSegments })
  fail(error)
  const result = (data ?? [])[0] as { content_id: string; content_code: string; created_new: boolean } | undefined
  if (!result) throw new Error('Production Content was not returned')
  return result
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
