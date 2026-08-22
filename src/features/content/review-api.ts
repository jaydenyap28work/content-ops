import { supabase } from '../../lib/supabase'
import type { ContentStatus } from './content-api'

export type ApprovalType = 'topic' | 'script' | 'internal_video' | 'client' | 'final'

export interface ScriptVersionRecord {
  id: string; content_id: string; version_number: number; body: string
  status: 'draft' | 'submitted' | 'approved' | 'superseded'
  created_by: string; created_at: string; note: string | null
}
export interface MediaVersionRecord {
  id: string; content_id: string; version_number: number
  version_type: 'first_cut' | 'revision' | 'final'
  external_url: string | null; local_path: string | null; nas_path: string | null
  submitted_by: string; submitted_at: string; note: string | null; is_client_visible: boolean
}
export interface ApprovalRequirementRecord {
  id: string; content_id: string; approval_type: ApprovalType; is_required: boolean
  assigned_reviewer_user_id: string | null
  status: 'not_required' | 'pending' | 'approved' | 'revision_required' | 'waived'
  notes: string | null; updated_at: string
}
export interface ApprovalRecord {
  id: string; approval_type: ApprovalType; target_type: 'content' | 'script_version' | 'media_version'
  script_version_id: string | null; media_version_id: string | null
  approver_user_id: string | null; external_approver_name: string | null
  result: 'approved' | 'revision_required'; decided_at: string; channel: string
  recorded_by: string; note: string | null; evidence_url: string | null
}
export interface RevisionRequestRecord {
  id: string; review_scope: 'internal' | 'client'; target_type: 'script_version' | 'media_version'
  script_version_id: string | null; media_version_id: string | null; requested_by: string | null
  external_reviewer_name: string | null; reason_code: string; reason_notes: string | null
  requested_at: string; status: 'open' | 'resolved' | 'cancelled'; resolved_at: string | null
  resolution_note: string | null; resulting_media_version_id: string | null
}
export interface ReviewBundle {
  scripts: ScriptVersionRecord[]; media: MediaVersionRecord[]
  requirements: ApprovalRequirementRecord[]; approvals: ApprovalRecord[]
  revisions: RevisionRequestRecord[]
}

function fail(error: { message: string } | null) { if (error) throw new Error(error.message) }

export async function loadReviewBundle(contentId: string): Promise<ReviewBundle> {
  const [scripts, media, requirements, approvals, revisions] = await Promise.all([
    supabase.from('script_versions').select('*').eq('content_id', contentId).order('version_number', { ascending: false }),
    supabase.from('media_versions').select('*').eq('content_id', contentId).order('version_number', { ascending: false }),
    supabase.from('content_approval_requirements').select('*').eq('content_id', contentId).order('created_at'),
    supabase.from('approvals').select('*').eq('content_id', contentId).order('decided_at', { ascending: false }),
    supabase.from('revision_requests').select('*').eq('content_id', contentId).order('requested_at', { ascending: false }),
  ])
  ;[scripts, media, requirements, approvals, revisions].forEach((result) => fail(result.error))
  return {
    scripts: (scripts.data ?? []) as ScriptVersionRecord[], media: (media.data ?? []) as MediaVersionRecord[],
    requirements: (requirements.data ?? []) as ApprovalRequirementRecord[], approvals: (approvals.data ?? []) as ApprovalRecord[],
    revisions: (revisions.data ?? []) as RevisionRequestRecord[],
  }
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args); fail(error); return data
}
export const createScriptVersion = (contentId: string, body: string, status: string, note: string) =>
  rpc('create_script_version', { target_content_id: contentId, target_body: body, target_status: status, target_note: note })
export const configureApprovalRequirement = (contentId: string, type: ApprovalType, required: boolean, reviewerId: string | null, notes: string) =>
  rpc('configure_approval_requirement', { target_content_id: contentId, target_approval_type: type, target_required: required, target_reviewer_user_id: reviewerId, target_notes: notes })
export const submitFirstCut = (contentId: string, state: ContentStatus, links: MediaInput) =>
  rpc('submit_first_cut', mediaArgs(contentId, state, links))
export const startReview = (contentId: string, state: ContentStatus, note: string) =>
  rpc('start_content_review', { target_content_id: contentId, expected_from_state: state, target_note: note })
export const requestRevision = (contentId: string, state: ContentStatus, reasonCode: string, reasonNotes: string, note: string) =>
  rpc('request_content_revision', { target_content_id: contentId, expected_from_state: state, target_reason_code: reasonCode, target_reason_notes: reasonNotes, target_note: note })
export const startRevision = (contentId: string, state: ContentStatus, note: string) =>
  rpc('start_content_revision', { target_content_id: contentId, expected_from_state: state, target_note: note })
export const submitRevision = (contentId: string, state: ContentStatus, links: MediaInput, resolutionNote: string) =>
  rpc('submit_content_revision', { ...mediaArgs(contentId, state, links), target_resolution_note: resolutionNote })
export const sendToClientReview = (contentId: string, state: ContentStatus, note: string) =>
  rpc('send_content_to_client_review', { target_content_id: contentId, expected_from_state: state, target_note: note })
export const submitFinalMedia = (contentId: string, state: ContentStatus, links: MediaInput) =>
  rpc('submit_final_media', mediaArgs(contentId, state, links))

export interface MediaInput { externalUrl: string; localPath: string; nasPath: string; note: string }
function mediaArgs(contentId: string, state: ContentStatus, links: MediaInput) {
  return { target_content_id: contentId, expected_from_state: state, target_external_url: links.externalUrl, target_local_path: links.localPath, target_nas_path: links.nasPath, target_note: links.note }
}
export const approveStage = (contentId: string, type: ApprovalType, targetType: string, targetId: string, state: ContentStatus, note: string, evidence: string) =>
  rpc('approve_content_stage', { target_content_id: contentId, target_approval_type: type, target_type: targetType, target_id: targetId, expected_from_state: state, target_note: note, target_evidence_url: evidence })
export const recordExternalApproval = (contentId: string, type: ApprovalType, targetType: string, targetId: string, state: ContentStatus, values: ExternalApprovalInput) =>
  rpc('record_external_approval', { target_content_id: contentId, target_approval_type: type, target_type: targetType, target_id: targetId, expected_from_state: state, target_name: values.name, target_channel: values.channel, target_decided_at: values.decidedAt, target_note: values.note, target_evidence_url: values.evidence })
export interface ExternalApprovalInput { name: string; channel: string; decidedAt: string; note: string; evidence: string }
export const overrideApproval = (requirementId: string, reason: string) => rpc('override_approval_requirement', { target_requirement_id: requirementId, target_reason: reason })
