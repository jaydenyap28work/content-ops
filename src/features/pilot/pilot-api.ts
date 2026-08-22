import {supabase} from '../../lib/supabase'
import type {IdeaRecord} from '../research/research-api'

function fail(error:{message:string}|null){if(error)throw new Error(error.message)}
export interface CalendarEvent{event_key:string;event_type:'PLAN'|'SHOOT'|'PUBLISH';event_at:string;title:string;client_name:string;status:string;entity_type:'idea'|'content';entity_id:string}
export async function loadCalendarEvents(workspaceId:string,from:string,to:string){const{data,error}=await supabase.rpc('list_calendar_events',{target_workspace_id:workspaceId,target_from:from,target_to:to});fail(error);return(data??[]) as CalendarEvent[]}

export async function bulkUpdateIdeas(ids:string[],field:'owner'|'planned_date'|'priority'|'category'|'tags',values:string[]){const{data,error}=await supabase.rpc('bulk_update_ideas',{target_idea_ids:ids,target_field:field,target_values:values});fail(error);return data as number}

export interface ShootingBrief{idea_id:string;why_now:string|null;interview_questions:string[];key_talking_points:string[];key_takeaway:string|null;suggested_cta:string|null;target_duration:string|null;b_roll_visual_suggestions:string[];risk_fact_check_notes:string[];talent:string|null;shoot_date:string|null;location:string|null;shooter_user_id:string|null;generation_source:'template'|'manual'|null;generated_at:string|null}
export type ShootingBriefGenerationInput={ideaId:string;whyNow:string;interviewQuestions:string[];keyTalkingPoints:string[];keyTakeaway:string;suggestedCta:string;targetDuration:string;bRollVisualSuggestions:string[];riskFactCheckNotes:string[]}
export async function loadShootingBrief(ideaId:string){const{data,error}=await supabase.from('idea_shooting_briefs').select('idea_id,why_now,interview_questions,key_talking_points,key_takeaway,suggested_cta,target_duration,b_roll_visual_suggestions,risk_fact_check_notes,talent,shoot_date,location,shooter_user_id,generation_source,generated_at').eq('idea_id',ideaId).maybeSingle();fail(error);return data as ShootingBrief|null}
export async function saveShootingBrief(ideaId:string,brief:Omit<ShootingBrief,'idea_id'|'generation_source'|'generated_at'>){const{error}=await supabase.rpc('save_complete_idea_shooting_brief',{target_idea_id:ideaId,target_why_now:brief.why_now??'',target_interview_questions:brief.interview_questions,target_key_talking_points:brief.key_talking_points,target_key_takeaway:brief.key_takeaway??'',target_suggested_cta:brief.suggested_cta??'',target_target_duration:brief.target_duration??'',target_b_roll_visual_suggestions:brief.b_roll_visual_suggestions,target_risk_fact_check_notes:brief.risk_fact_check_notes,target_talent:brief.talent??'',target_shoot_date:brief.shoot_date||null,target_location:brief.location??'',target_shooter_user_id:brief.shooter_user_id||null});fail(error)}
export async function generateShootingBriefs(items:ShootingBriefGenerationInput[]){const{data,error}=await supabase.rpc('generate_idea_shooting_briefs',{target_items:items});fail(error);return data as number}

export async function loadSettings(workspaceId:string,userId:string){const[profile,workspace]=await Promise.all([supabase.from('user_profiles').select('display_name,preferred_language,timezone').eq('id',userId).single(),supabase.from('workspaces').select('name,default_timezone').eq('id',workspaceId).single()]);fail(profile.error);fail(workspace.error);return{profile:profile.data as{display_name:string;preferred_language:'zh-CN'|'en';timezone:string},workspace:workspace.data as{name:string;default_timezone:string}}}
export async function saveUserSettings(displayName:string,language:string,timezone:string){const{error}=await supabase.rpc('save_user_preferences',{target_display_name:displayName,target_language:language,target_timezone:timezone});fail(error)}
export async function saveWorkspaceSettings(workspaceId:string,name:string,timezone:string){const{error}=await supabase.rpc('save_workspace_settings',{target_workspace_id:workspaceId,target_name:name,target_timezone:timezone});fail(error)}

export function deriveDashboard(events:CalendarEvent[],contents:Array<{id:string;title:string;client_id:string;current_status:string}>,now=new Date()){
  const dateInWorkspace=(value:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(value)
  const today=dateInWorkspace(now);const weekEnd=new Date(now);weekEnd.setDate(weekEnd.getDate()+7);const end=dateInWorkspace(weekEnd)
  const todayItems=events.filter((event)=>event.event_at.slice(0,10)===today)
  const weekItems=events.filter((event)=>event.event_at.slice(0,10)>=today&&event.event_at.slice(0,10)<=end)
  const attentionStatuses=new Set(['first_cut_submitted','internal_review','revision_required','client_review'])
  const attention=contents.filter((content)=>attentionStatuses.has(content.current_status))
  const overview=contents.reduce<Record<string,number>>((result,content)=>{result[content.current_status]=(result[content.current_status]??0)+1;return result},{})
  return{todayItems,weekItems,attention,overview}
}
export function nextIdeaAction(idea:IdeaRecord){if(idea.status==='new')return'evaluating';if(idea.status==='evaluating')return'approved';if(idea.status==='rejected')return'evaluating';return null}

export function derivePublicationAttention(publications:Array<{id:string;content_id:string;status:string;published_at:string|null;failure_reason?:string|null}>,snapshots:Array<{publication_id:string;snapshot_type:string}>,now=new Date()){const items:Array<{contentId:string;type:string}>=[];for(const publication of publications){if(publication.status==='failed')items.push({contentId:publication.content_id,type:'Publication Failed'});if(publication.status!=='published'||!publication.published_at)continue;const age=(now.getTime()-new Date(publication.published_at).getTime())/3600000;for(const[hours,type]of[[24,'24h'],[168,'7d']]as const){if(age>=hours&&!snapshots.some(snapshot=>snapshot.publication_id===publication.id&&snapshot.snapshot_type===type))items.push({contentId:publication.content_id,type:'Analytics '+type+' overdue'})}}return items}
