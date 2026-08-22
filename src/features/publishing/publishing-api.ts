import { supabase } from '../../lib/supabase'

export type PublicationStatus = 'draft'|'scheduled'|'published'|'failed'|'cancelled'
export type SnapshotType = '24h'|'7d'|'30d'|'current'
export type PublicationState = 'not_published'|'partially_published'|'fully_published'|'needs_attention'
export interface PlatformRecord { id:string; code:string; name:string }
export interface SocialAccountRecord { id:string; client_id:string; platform_id:string; account_name:string; account_handle:string; external_url:string|null; is_active:boolean }
export interface PublicationRecord { id:string; workspace_id:string; client_id:string; content_id:string; platform_id:string; social_account_id:string; publication_sequence:number; is_required:boolean; assigned_publisher_user_id:string; scheduled_at:string|null; published_at:string|null; post_url:string|null; status:PublicationStatus; note:string|null; failure_reason:string|null; created_at:string; updated_at:string }
export interface AnalyticsSnapshotRecord { id:string; workspace_id:string; client_id:string; publication_id:string; captured_at:string; snapshot_type:SnapshotType; data_source:'manual'|'csv'|'scraper'|'api'|'client_backend'; views_or_plays:number|null; reach:number|null; impressions:number|null; likes:number|null; comments:number|null; shares:number|null; saves_or_collects:number|null; clicks:number|null; followers_gained:number|null; platform_metrics:Record<string,unknown>; entered_by:string; note:string|null; created_at:string }
export interface PublishingBundle { platforms:PlatformRecord[]; accounts:SocialAccountRecord[]; publications:PublicationRecord[]; snapshots:AnalyticsSnapshotRecord[]; aggregate:PublicationState }
export interface MetricInput { viewsOrPlays:string; reach:string; impressions:string; likes:string; comments:string; shares:string; savesOrCollects:string; clicks:string; followersGained:string }

function fail(error:{message:string}|null){if(error)throw new Error(error.message)}
export async function loadPublishingBundle(contentId:string):Promise<PublishingBundle>{
  const [platforms,accounts,publications,snapshots,aggregate]=await Promise.all([
    supabase.from('platforms').select('id,code,name').eq('is_active',true).order('sort_order'),
    supabase.from('social_accounts').select('*').eq('is_active',true).order('account_name'),
    supabase.from('publications').select('*').eq('content_id',contentId).order('created_at'),
    supabase.from('analytics_snapshots').select('*').order('captured_at',{ascending:false}),
    supabase.rpc('content_publication_state',{target_content_id:contentId}),
  ]);[platforms,accounts,publications,snapshots,aggregate].forEach((r)=>fail(r.error))
  const pubs=(publications.data??[]) as PublicationRecord[]; const ids=new Set(pubs.map((p)=>p.id))
  return {platforms:(platforms.data??[]) as PlatformRecord[],accounts:(accounts.data??[]) as SocialAccountRecord[],publications:pubs,snapshots:((snapshots.data??[]) as AnalyticsSnapshotRecord[]).filter((s)=>ids.has(s.publication_id)),aggregate:(aggregate.data??'not_published') as PublicationState}
}
async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await supabase.rpc(name,args);fail(error);return data}
export const saveSocialAccount=(values:{id?:string;clientId:string;platformId:string;name:string;handle:string;url:string;active?:boolean})=>rpc('save_social_account',{target_account_id:values.id??null,target_client_id:values.clientId,target_platform_id:values.platformId,target_account_name:values.name,target_account_handle:values.handle,target_external_url:values.url,target_active:values.active??true})
export const createPublication=(values:{contentId:string;platformId:string;accountId:string;publisherId:string;required:boolean;note:string})=>rpc('create_publication',{target_content_id:values.contentId,target_platform_id:values.platformId,target_social_account_id:values.accountId,target_publisher_user_id:values.publisherId,target_required:values.required,target_note:values.note})
export const schedulePublication=(id:string,status:PublicationStatus,scheduledAt:string,note:string)=>rpc('schedule_publication',{target_publication_id:id,expected_status:status,target_scheduled_at:scheduledAt,target_note:note})
export const markPublicationPublished=(id:string,status:PublicationStatus,publishedAt:string,url:string,note:string)=>rpc('mark_publication_published',{target_publication_id:id,expected_status:status,target_published_at:publishedAt,target_post_url:url,target_note:note})
export const markPublicationFailed=(id:string,status:PublicationStatus,reason:string,note:string)=>rpc('mark_publication_failed',{target_publication_id:id,expected_status:status,target_reason:reason,target_note:note})
export const cancelPublication=(id:string,status:PublicationStatus,reason:string)=>rpc('cancel_publication',{target_publication_id:id,expected_status:status,target_reason:reason})
const metric=(value:string)=>value.trim()===''?null:Number(value)
export const addManualSnapshot=(publicationId:string,capturedAt:string,type:SnapshotType,metrics:MetricInput,note:string,platformMetrics:Record<string,unknown>={})=>rpc('add_manual_analytics_snapshot',{target_publication_id:publicationId,target_captured_at:capturedAt,target_snapshot_type:type,target_views_or_plays:metric(metrics.viewsOrPlays),target_reach:metric(metrics.reach),target_impressions:metric(metrics.impressions),target_likes:metric(metrics.likes),target_comments:metric(metrics.comments),target_shares:metric(metrics.shares),target_saves_or_collects:metric(metrics.savesOrCollects),target_clicks:metric(metrics.clicks),target_followers_gained:metric(metrics.followersGained),target_platform_metrics:platformMetrics,target_note:note})
export const completeContentAnalytics=(contentId:string,state:string,note:string)=>rpc('complete_content_analytics',{target_content_id:contentId,expected_from_state:state,target_note:note})

export async function loadAnalyticsQueue(workspaceId:string){
  const [publications,snapshots,platforms,accounts,contents]=await Promise.all([
    supabase.from('publications').select('*').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}),
    supabase.from('analytics_snapshots').select('*').eq('workspace_id',workspaceId).order('captured_at',{ascending:false}),
    supabase.from('platforms').select('id,code,name').eq('is_active',true),
    supabase.from('social_accounts').select('*').eq('is_active',true),
    supabase.rpc('list_contents',{target_workspace_id:workspaceId,target_content_id:null}),
  ]);[publications,snapshots,platforms,accounts,contents].forEach((r)=>fail(r.error))
  return {publications:(publications.data??[]) as PublicationRecord[],snapshots:(snapshots.data??[]) as AnalyticsSnapshotRecord[],platforms:(platforms.data??[]) as PlatformRecord[],accounts:(accounts.data??[]) as SocialAccountRecord[],contents:(contents.data??[]) as Array<{id:string;client_id:string;content_code:string;title:string}>}
}
