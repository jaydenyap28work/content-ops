export type TeamReportMetric = 'ideas_submitted'|'ideas_confirmed'|'shoots_completed'|'edits_completed'|'reviews_completed'|'published'
export type TeamReportPreset = 'today'|'week'|'month'|'last_month'|'custom'

export interface TeamReportMember { id:string; name:string; status:'active'|'inactive' }
export interface TeamReportAction {
  eventKey:string
  metric:TeamReportMetric
  teamMemberId:string|null
  roleCode:string
  occurredAt:string
  entityType:'idea'|'content'
  entityId:string
  contentId:string|null
  title:string
  actionCode:string
  result:string
}
export interface TeamReportData { members:TeamReportMember[]; actions:TeamReportAction[] }
export interface TeamContribution {
  member:TeamReportMember
  ideasSubmitted:number
  ideasConfirmed:number
  directed:number
  shot:number
  edited:number
  reviewed:number
  published:number
  adoptionRate:number|null
  details:TeamReportAction[]
}

const METRICS:TeamReportMetric[]=['ideas_submitted','ideas_confirmed','shoots_completed','edits_completed','reviews_completed','published']
const uniqueCount=(actions:TeamReportAction[],metric:TeamReportMetric)=>new Set(actions.filter(item=>item.metric===metric).map(item=>item.eventKey)).size

export function aggregateTeamReport(data:TeamReportData){
  const overview=Object.fromEntries(METRICS.map(metric=>[metric,uniqueCount(data.actions,metric)])) as Record<TeamReportMetric,number>
  const contributions=data.members.map(member=>{
    const details=data.actions.filter(item=>item.teamMemberId===member.id)
    const ideasSubmitted=uniqueCount(details,'ideas_submitted')
    const ideasConfirmed=uniqueCount(details,'ideas_confirmed')
    return {
      member,ideasSubmitted,ideasConfirmed,
      directed:new Set(details.filter(item=>item.metric==='shoots_completed'&&item.roleCode==='director').map(item=>item.eventKey)).size,
      shot:new Set(details.filter(item=>item.metric==='shoots_completed'&&item.roleCode==='shooter').map(item=>item.eventKey)).size,
      edited:uniqueCount(details,'edits_completed'),reviewed:uniqueCount(details,'reviews_completed'),published:uniqueCount(details,'published'),
      adoptionRate:ideasSubmitted?ideasConfirmed/ideasSubmitted:null,details,
    } satisfies TeamContribution
  }).filter(item=>item.member.status==='active'||item.details.length>0)
  return {overview,contributions}
}

const TIME_ZONE='Asia/Kuala_Lumpur'
function dateKey(value:Date){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value)
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??''
  return `${get('year')}-${get('month')}-${get('day')}`
}
function addDays(key:string,days:number){return dateKey(new Date(new Date(`${key}T00:00:00+08:00`).getTime()+days*86400000))}
function monthStart(key:string){return `${key.slice(0,7)}-01`}
function monthOffset(key:string,offset:number){
  const [year,month]=key.split('-').map(Number)
  return dateKey(new Date(Date.UTC(year,month-1+offset,1,4)))
}
export function reportDateRange(preset:TeamReportPreset,now=new Date(),custom?:{from:string;to:string}){
  const today=dateKey(now)
  let from=today,to=today
  if(preset==='week'){
    const day=new Date(`${today}T12:00:00+08:00`).getUTCDay()
    from=addDays(today,-(day===0?6:day-1))
  }else if(preset==='month')from=monthStart(today)
  else if(preset==='last_month'){from=monthOffset(today,-1);to=addDays(monthStart(today),-1)}
  else if(preset==='custom'&&custom){from=custom.from;to=custom.to}
  return {from,to,fromIso:`${from}T00:00:00+08:00`,toIso:`${addDays(to,1)}T00:00:00+08:00`}
}
