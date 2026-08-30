import { supabase } from '../../lib/supabase'

export interface NotificationRecord{id:string;type:string;title:string;body:string|null;entity_type:string;entity_id:string|null;route:string;created_at:string;read_at:string|null}
export interface NotificationPreferences{first_cut_review:boolean;revision_requested:boolean;task_due:boolean;access_requests:boolean;equipment_proposals:boolean}
const defaults:NotificationPreferences={first_cut_review:true,revision_requested:true,task_due:true,access_requests:true,equipment_proposals:true}
function fail(error:{message:string}|null){if(error)throw new Error(error.message)}
export async function loadNotifications(){const{data,error}=await supabase.rpc('list_my_notifications',{target_limit:40});fail(error);return(data??[]) as NotificationRecord[]}
export async function markNotificationRead(id:string){const{error}=await supabase.rpc('mark_notification_read',{target_notification_id:id});fail(error)}
export async function markAllNotificationsRead(){const{error}=await supabase.rpc('mark_all_notifications_read');fail(error)}
export async function loadNotificationPreferences(userId:string){const{data,error}=await supabase.from('notification_preferences').select('first_cut_review,revision_requested,task_due,access_requests,equipment_proposals').eq('user_profile_id',userId).maybeSingle();fail(error);return(data??defaults) as NotificationPreferences}
export async function saveNotificationPreferences(value:NotificationPreferences){const{error}=await supabase.rpc('save_notification_preferences',{target_first_cut_review:value.first_cut_review,target_revision_requested:value.revision_requested,target_task_due:value.task_due,target_access_requests:value.access_requests,target_equipment_proposals:value.equipment_proposals});fail(error)}
