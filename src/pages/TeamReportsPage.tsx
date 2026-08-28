import { useCallback,useEffect,useMemo,useState } from 'react'
import type { ReactNode } from 'react'
import { BarChart3,ChevronRight,LoaderCircle,Users } from 'lucide-react'
import { Button,Input,Select,StatusBadge } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { canViewTeamReports } from '../features/auth/role-access'
import { useI18n } from '../features/i18n/i18n'
import { loadTeamReport } from '../features/reports/team-report-api'
import { aggregateTeamReport,reportDateRange } from '../features/reports/team-report'
import type { TeamContribution,TeamReportAction,TeamReportData,TeamReportPreset } from '../features/reports/team-report'

const empty:TeamReportData={members:[],actions:[]}
const presets:TeamReportPreset[]=['today','week','month','last_month','custom']
const presetText:Record<TeamReportPreset,[string,string]>={today:['今天','Today'],week:['本周','This week'],month:['本月','This month'],last_month:['上月','Last month'],custom:['自定义日期','Custom dates']}
const metricLabels={ideas_submitted:['新增创意','New Ideas'],ideas_confirmed:['创意采用','Ideas Adopted'],shoots_completed:['完成拍摄','Shoots Completed'],edits_completed:['完成剪辑','Edits Completed'],reviews_completed:['完成审核','Reviews Completed'],published:['已发布','Published']} as const

export function TeamReportsPage(){
  const{workspace}=useAuth();const{language}=useI18n();const zh=language==='zh-CN'
  const[preset,setPreset]=useState<TeamReportPreset>('month')
  const[customFrom,setCustomFrom]=useState(()=>reportDateRange('month').from)
  const[customTo,setCustomTo]=useState(()=>reportDateRange('month').to)
  const[memberId,setMemberId]=useState('all');const[selectedMember,setSelectedMember]=useState<string|null>(null)
  const[data,setData]=useState<TeamReportData>(empty);const[loading,setLoading]=useState(true);const[error,setError]=useState('')
  const allowed=workspace?canViewTeamReports(workspace.roles):false
  const range=useMemo(()=>reportDateRange(preset,new Date(),{from:customFrom,to:customTo}),[customFrom,customTo,preset])

  const refresh=useCallback(async()=>{
    if(!workspace||!allowed||!range.from||!range.to)return
    setLoading(true);setError('')
    try{setData(await loadTeamReport(workspace.id,range.fromIso,range.toIso,memberId==='all'?null:memberId))}
    catch(caught){setError(caught instanceof Error?caught.message:(zh?'无法读取团队报表':'Unable to load Team Report'))}
    finally{setLoading(false)}
  },[allowed,memberId,range.from,range.fromIso,range.to,range.toIso,workspace,zh])
  useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),0);return()=>window.clearTimeout(timer)},[refresh])

  if(!allowed)return <div className="mx-auto mt-12 max-w-xl border border-line bg-paper p-8 text-center"><BarChart3 className="mx-auto size-9 text-primary"/><h1 className="mt-4 text-2xl font-bold">{zh?'没有权限查看团队报表':'Team Report access required'}</h1></div>
  const{overview,contributions}=aggregateTeamReport(data)
  const visibleContributions=memberId==='all'?contributions:contributions.filter(item=>item.member.id===memberId)
  const detail=contributions.find(item=>item.member.id===selectedMember)??null

  return <div className="page-enter space-y-6">
    <header className="border-b border-line pb-5"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-primary">{zh?'团队实际产出':'Team output'}</p><h1 className="mt-1.5 font-display text-4xl font-semibold tracking-[-.03em]">{zh?'团队报表':'Team Report'}</h1><p className="mt-2 text-sm text-ink-muted">{zh?'只统计期间内实际发生的创意、拍摄、剪辑、审核与发布动作':'Counts completed operational actions in the selected period, not assignments'}</p></header>

    <section className="flex flex-col gap-3 border-b border-line pb-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex gap-2 overflow-x-auto">{presets.map(value=><button key={value} onClick={()=>setPreset(value)} className={`whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-bold ${preset===value?'bg-ink text-white':'border border-line bg-paper text-ink-muted hover:border-primary/40'}`}>{presetText[value][zh?0:1]}</button>)}</div>
      <div className="flex flex-wrap items-center gap-2">{preset==='custom'?<><Input aria-label={zh?'开始日期':'Start date'} type="date" value={customFrom} onChange={event=>setCustomFrom(event.target.value)} className="w-40"/><span className="text-ink-faint">—</span><Input aria-label={zh?'结束日期':'End date'} type="date" value={customTo} onChange={event=>setCustomTo(event.target.value)} className="w-40"/></>:<span className="text-sm font-semibold text-ink-muted">{range.from} — {range.to}</span>}<Select value={memberId} onChange={event=>{setMemberId(event.target.value);setSelectedMember(event.target.value==='all'?null:event.target.value)}} className="w-48"><option value="all">{zh?'全部成员':'All members'}</option>{data.members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</Select><Button variant="secondary" size="sm" onClick={()=>void refresh()} disabled={loading}>{loading?<LoaderCircle className="size-4 animate-spin"/>:null}{zh?'刷新':'Refresh'}</Button></div>
    </section>

    {error?<div role="alert" className="border-l-4 border-danger bg-danger/5 px-4 py-3 text-sm text-danger-dark">{error}</div>:null}
    <section aria-busy={loading}><div className="mb-3 flex items-baseline justify-between"><h2 className="text-xl font-bold">{zh?'期间团队产出':'Period output'}</h2><span className="text-xs text-ink-muted">Asia/Kuala Lumpur</span></div><div className="grid border-y border-line bg-paper sm:grid-cols-3 xl:grid-cols-6">{Object.entries(metricLabels).map(([metric,label],index)=><div key={metric} className={`px-4 py-5 ${index?'border-t border-line sm:border-l sm:border-t-0':''}`}><p className="text-xs font-bold text-ink-muted">{label[zh?0:1]}</p><p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{overview[metric as keyof typeof overview]}</p></div>)}</div></section>

    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">{zh?'成员贡献':'Member contributions'}</h2><p className="text-xs text-ink-muted">{zh?'点击成员查看实际动作':'Select a member for action details'}</p></div><div className="overflow-x-auto border border-line bg-paper"><table className="w-full min-w-[54rem] text-left text-sm"><thead className="bg-canvas-raised text-xs text-ink-muted"><tr><Th>{zh?'成员':'Member'}</Th><Th>{zh?'创意提供':'Ideas'}</Th><Th>{zh?'创意采用':'Adopted'}</Th><Th>{zh?'编导':'Director'}</Th><Th>{zh?'摄影':'Shooter'}</Th><Th>{zh?'剪辑':'Editor'}</Th><Th>{zh?'审核':'Review'}</Th><Th>{zh?'发布':'Publish'}</Th><th className="w-10"/></tr></thead><tbody>{visibleContributions.map(item=><ContributionRow key={item.member.id} item={item} selected={selectedMember===item.member.id} onSelect={()=>setSelectedMember(item.member.id)}/>)}</tbody></table>{!loading&&!visibleContributions.length?<div className="p-8 text-center text-sm text-ink-muted">{zh?'这个期间没有可归属的成员动作':'No attributable member actions in this period'}</div>:null}</div></section>

    {detail?<MemberDetails item={detail} language={language}/>:null}

    <section><h2 className="mb-3 text-xl font-bold">{zh?'创意贡献榜':'Idea contribution'}</h2><div className="overflow-x-auto border border-line bg-paper"><table className="w-full min-w-[36rem] text-left text-sm"><thead className="bg-canvas-raised text-xs text-ink-muted"><tr><Th>{zh?'成员':'Member'}</Th><Th>{zh?'提交':'Submitted'}</Th><Th>{zh?'采用':'Adopted'}</Th><Th>{zh?'采用率':'Adoption rate'}</Th></tr></thead><tbody>{visibleContributions.slice().sort((a,b)=>b.ideasConfirmed-a.ideasConfirmed||b.ideasSubmitted-a.ideasSubmitted).map(item=><tr key={item.member.id} className="border-t border-line"><Td strong>{item.member.name}</Td><Td>{item.ideasSubmitted}</Td><Td>{item.ideasConfirmed}</Td><Td>{item.adoptionRate===null?'—':`${Math.round(item.adoptionRate*100)}%`}</Td></tr>)}</tbody></table></div><p className="mt-2 text-xs text-ink-muted">{zh?'采用率 = 期间内确认拍摄 ÷ 期间内提交；只呈现事实，不计算员工综合评分':'Adoption rate = confirmed in period ÷ submitted in period. No composite employee score is calculated'}</p></section>
  </div>
}

function ContributionRow({item,selected,onSelect}:{item:TeamContribution;selected:boolean;onSelect:()=>void}){return <tr onClick={onSelect} className={`cursor-pointer border-t border-line transition hover:bg-primary/[.035] ${selected?'bg-primary/[.06]':''}`}><Td strong>{item.member.name}</Td><Td>{item.ideasSubmitted}</Td><Td>{item.ideasConfirmed}</Td><Td>{item.directed}</Td><Td>{item.shot}</Td><Td>{item.edited}</Td><Td>{item.reviewed}</Td><Td>{item.published}</Td><td><ChevronRight className="size-4 text-ink-faint"/></td></tr>}
function MemberDetails({item,language}:{item:TeamContribution;language:'zh-CN'|'en'}){const zh=language==='zh-CN';return <section className="border-y border-primary/25 bg-primary/[.035] px-4 py-5 sm:px-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-primary text-white"><Users className="size-5"/></div><div><h2 className="text-xl font-bold">{item.member.name}</h2><p className="text-xs text-ink-muted">{zh?'参与内容明细':'Completed action details'}</p></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="text-xs text-ink-muted"><tr><Th>{zh?'日期':'Date'}</Th><Th>{zh?'内容':'Content'}</Th><Th>{zh?'角色 / 动作':'Role / Action'}</Th><Th>{zh?'结果':'Result'}</Th></tr></thead><tbody>{item.details.map((action,index)=><tr key={`${action.eventKey}-${action.roleCode}-${index}`} className="border-t border-primary/10"><Td>{new Intl.DateTimeFormat(zh?'zh-CN':'en-MY',{timeZone:'Asia/Kuala_Lumpur',month:'short',day:'numeric'}).format(new Date(action.occurredAt))}</Td><Td strong>{action.title}</Td><Td>{actionText(action,zh)}</Td><Td><StatusBadge tone="neutral">{resultText(action.result,zh,action.actionCode)}</StatusBadge></Td></tr>)}</tbody></table></div></section>}
function actionText(action:TeamReportAction,zh:boolean){const roles:Record<string,[string,string]>={idea_provider:['创意','Idea'],director:['编导','Director'],shooter:['摄影','Shooter'],editor:['剪辑','Editor'],reviewer:['审核','Reviewer'],publisher:['发布','Publisher']};const actions:Record<string,[string,string]>={idea_submitted:['提交创意','Idea submitted'],confirmed_for_production:['确认拍摄','Confirmed to shoot'],shoot_completed:['完成拍摄','Shoot completed'],first_cut_submitted:['提交初剪','First cut submitted'],revision_submitted:['提交修改版','Revision submitted'],final_media_submitted:['提交完成版','Final submitted'],review_decided:['完成审核','Review decided'],publication_published:['标记已发布','Marked published']};return `${roles[action.roleCode]?.[zh?0:1]??action.roleCode} · ${actions[action.actionCode]?.[zh?0:1]??action.actionCode}`}
function resultText(value:string,zh:boolean,actionCode:string){if(actionCode==='idea_submitted')return zh?'已提交':'Submitted';const labels:Record<string,[string,string]>={confirmed:['已确认拍摄','Confirmed'],shot_awaiting_edit:['已拍摄','Shot'],first_cut_submitted:['初剪已提交','First cut submitted'],revision_submitted:['修改版已提交','Revision submitted'],internal_review:['待审核','In review'],client_review:['客户审核','Client review'],approved:['已通过','Approved'],revision_required:['需要修改','Revision required'],published:['已发布','Published'],new:['新选题','New'],evaluating:['评估中','Evaluating'],paused:['暂缓','Paused'],rejected:['不采用','Not selected'],archived:['已归档','Archived']};return labels[value]?.[zh?0:1]??(zh?'已记录':value.replaceAll('_',' '))}
function Th({children}:{children:ReactNode}){return <th className="px-4 py-3 font-bold">{children}</th>}
function Td({children,strong=false}:{children:ReactNode;strong?:boolean}){return <td className={`px-4 py-3 tabular-nums ${strong?'font-bold text-ink':'text-ink-soft'}`}>{children}</td>}
