import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, ExternalLink, Lightbulb, LoaderCircle, PauseCircle, Pencil, XCircle } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, StatusBadge } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { canManageIdeaDecisions } from '../features/auth/role-access'
import { confirmIdeaForProduction } from '../features/content/content-api'
import { useI18n } from '../features/i18n/i18n'
import { formatWorkspaceDate } from '../features/i18n/labels'
import { bulkUpdateIdeas } from '../features/pilot/pilot-api'
import { QuickIdeaForm } from '../features/research/QuickIdeaForm'
import { normalizeIdeaText, safeIdeaPlanBackPath } from '../features/research/idea-detail-navigation'
import { ideaFormatLabels, inferIdeaFormat } from '../features/research/idea-format'
import { planningStatusLabel } from '../features/research/idea-planner'
import { loadIdeas, loadReferences, loadResearchCatalog } from '../features/research/research-api'
import type { IdeaRecord, ReferenceRecord, ResearchCatalog } from '../features/research/research-api'

const sourceZh:Record<string,string>={douyin:'抖音',xhs:'小红书',tiktok:'TikTok',instagram:'Instagram',facebook:'Facebook',threads:'Threads',youtube:'YouTube',lemon8:'Lemon8',web:'网页'}
interface DetailLocationState{from?:string}

export function IdeaDetailPage(){
  const {ideaId}=useParams()
  const {workspace}=useAuth()
  const {language}=useI18n()
  const zh=language==='zh-CN'
  const navigate=useNavigate()
  const location=useLocation()
  const roles=workspace?.roles??[]
  const canDecide=canManageIdeaDecisions(roles)
  const hasAccess=canDecide||roles.includes('Idea Contributor')
  const [idea,setIdea]=useState<IdeaRecord|null>(null)
  const [references,setReferences]=useState<ReferenceRecord[]>([])
  const [catalog,setCatalog]=useState<ResearchCatalog>({clients:[],platforms:[],categories:[],contributionRoles:[]})
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [notice,setNotice]=useState<string|null>(null)
  const [editing,setEditing]=useState(false)
  const backPath=safeIdeaPlanBackPath((location.state as DetailLocationState|null)?.from)

  const refresh=useCallback(async()=>{
    if(!workspace||!ideaId||!hasAccess)return
    setLoading(true);setError(null)
    try{
      const[nextCatalog,ideas,nextReferences]=await Promise.all([loadResearchCatalog(workspace.id),loadIdeas(workspace.id),canDecide?loadReferences(workspace.id):Promise.resolve([])])
      setCatalog(nextCatalog);setReferences(nextReferences);setIdea(ideas.find(item=>item.id===ideaId)??null)
    }catch(caught){setError(caught instanceof Error?caught.message:(zh?'无法读取选题':'Unable to load Idea'))}
    finally{setLoading(false)}
  },[canDecide,hasAccess,ideaId,workspace,zh])

  useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),0);return()=>window.clearTimeout(timer)},[refresh])
  async function decide(status:'paused'|'rejected'){if(!idea)return;setBusy(true);setError(null);try{await bulkUpdateIdeas([idea.id],'planning_status',[status]);setNotice(zh?'策划决定已更新':'Planning decision updated');await refresh()}catch(caught){setError(caught instanceof Error?caught.message:(zh?'无法更新策划决定':'Unable to update decision'))}finally{setBusy(false)}}
  async function confirm(){if(!idea)return;if(idea.linked_content_id){navigate('/content/'+idea.linked_content_id);return}setBusy(true);setError(null);try{const result=await confirmIdeaForProduction(idea);navigate(`/content/${result.content_id}`)}catch(caught){setError(caught instanceof Error?caught.message:(zh?'无法确认拍摄':'Unable to confirm Idea'))}finally{setBusy(false)}}

  if(!hasAccess)return <Card className="mx-auto mt-12 max-w-xl text-center"><Lightbulb className="mx-auto size-9 text-primary"/><h1 className="mt-4 text-2xl font-bold">{zh?'没有权限查看内容计划':'Idea pool access required'}</h1></Card>
  if(loading)return <div className="grid min-h-[55vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-primary"/></div>
  if(error&&!idea)return <Card className="mx-auto mt-10 max-w-2xl"><p role="alert" className="text-danger-dark">{error}</p><Button className="mt-4" variant="secondary" onClick={()=>navigate(backPath)}><ArrowLeft className="size-4"/>{zh?'返回内容计划':'Back to Content Plan'}</Button></Card>
  if(!idea)return <Card className="mx-auto mt-10 max-w-2xl text-center"><Lightbulb className="mx-auto size-8 text-ink-faint"/><h1 className="mt-4 text-2xl font-bold">{zh?'找不到这条选题':'Idea not found'}</h1><Button className="mt-5" variant="secondary" onClick={()=>navigate(backPath)}>{zh?'返回内容计划':'Back to Content Plan'}</Button></Card>

  const format=idea.content_format??inferIdeaFormat(idea.suggested_format)
  const linked=idea.status==='converted'&&Boolean(idea.linked_content_id)
  const canEdit=canDecide||Boolean(idea.can_edit_submission)
  const sources=references.filter(item=>idea.referenceIds.includes(item.id))
  const sourceLabel=zh?(sourceZh[idea.source_platform??'web']??'网页'):(idea.source_platform??'Web')
  const moreDetails=Boolean(idea.notes||idea.tags.length||idea.planned_date||idea.planned_shoot_date||idea.referenceIds.length)
  const shootingDirection=normalizeIdeaText([idea.original_hook,idea.suggested_format].filter(Boolean).join('\n\n'))

  return <article className="page-enter -mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:-mx-8 lg:-my-10">
    <div className="sticky top-[4.5rem] z-10 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[84rem] flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={()=>navigate(backPath)}><ArrowLeft className="size-4"/>{zh?'返回内容计划':'Back to Content Plan'}</Button>
        <StatusBadge className="mr-auto" tone={idea.planning_status==='confirmed'?'success':idea.planning_status==='rejected'?'critical':idea.planning_status==='paused'?'warning':'info'}>{planningStatusLabel(idea.planning_status,language)}</StatusBadge>
        {canEdit?<Button size="sm" variant="secondary" disabled={busy} onClick={()=>setEditing(true)}><Pencil className="size-4"/>{zh?'编辑':'Edit'}</Button>:null}
        {canDecide&&!linked?<><Button size="sm" variant="secondary" disabled={busy} onClick={()=>void decide('paused')}><PauseCircle className="size-4"/>{zh?'暂缓':'Pause'}</Button><Button size="sm" variant="danger" disabled={busy} onClick={()=>void decide('rejected')}><XCircle className="size-4"/>{zh?'不采用':'Not Selected'}</Button></>:null}
        {canDecide?<Button size="sm" disabled={busy} onClick={()=>void confirm()}>{busy?<LoaderCircle className="size-4 animate-spin"/>:<CheckCircle2 className="size-4"/>}{linked?(zh?'打开制作内容':'Open Production'):(zh?'确认拍摄':'Confirm to Shoot')}</Button>:null}
      </div>
    </div>

    <div className="bg-paper px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[65rem]">
        {error?<div role="alert" className="mb-5 border-l-4 border-danger bg-danger/5 px-4 py-3 text-sm text-danger-dark">{error}</div>:null}
        {notice?<div className="mb-5 border-l-4 border-green bg-green/5 px-4 py-3 text-sm text-green">{notice}</div>:null}
        <header className="border-b border-line pb-7">
          <h1 className="max-w-[58rem] font-display text-3xl font-bold leading-[1.2] tracking-[-.035em] text-ink sm:text-4xl lg:text-[2.75rem]">{idea.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-muted">
            <span>{ideaFormatLabels[format][zh?0:1]}</span><span aria-hidden="true">·</span>
            {idea.source_url?<a href={idea.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">{sourceLabel}<ExternalLink className="size-3.5"/></a>:<span>{zh?'原创':'Original'}</span>}
            <span aria-hidden="true">·</span><span>{zh?'创意提供：':'Idea provider: '}{idea.provider_name||(zh?'待指定':'Not assigned')}</span>
          </div>
        </header>

        <div className="divide-y divide-line">
          <ReadingSection title={zh?'原始灵感':'Raw inspiration'} value={idea.raw_content??idea.original_topic} primary/>
          <ReadingSection title={zh?'内容整理':'Content concept'} value={idea.our_angle}/>
          <ReadingSection title={zh?'为什么值得拍':'Why it is worth making'} value={idea.why_it_works}/>
          <ReadingSection title={zh?'拍摄方向':'Shooting direction'} value={shootingDirection}/>
          {moreDetails?<section className="py-8 sm:py-9"><h2 className="text-lg font-bold text-ink sm:text-xl">{zh?'更多资料':'More details'}</h2><dl className="mt-5 grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
            {idea.planned_shoot_date?<Detail label={zh?'计划拍摄日期':'Planned shoot date'} value={formatWorkspaceDate(idea.planned_shoot_date,language)}/>:null}
            {idea.planned_date?<Detail label={zh?'目标发布日期':'Target publish date'} value={formatWorkspaceDate(idea.planned_date,language)}/>:null}
            {idea.tags.length?<Detail label={zh?'标签':'Tags'} value={idea.tags.join(' · ')}/>:null}
            {idea.referenceIds.length?<Detail label={zh?'关联来源':'Linked sources'} value={sources.length?sources.map(source=>source.title).join(' · '):(zh?`${idea.referenceIds.length} 条来源`:`${idea.referenceIds.length} sources`)}/>:null}
            {idea.notes?<div className="sm:col-span-2"><Detail label={zh?'内部备注':'Internal notes'} value={normalizeIdeaText(idea.notes)}/></div>:null}
          </dl></section>:null}
        </div>
      </div>
    </div>
    {editing&&workspace?<QuickIdeaForm workspaceId={workspace.id} idea={idea} catalog={catalog} onClose={()=>setEditing(false)} onSaved={async message=>{setEditing(false);setNotice(message);await refresh()}}/>:null}
  </article>
}

function ReadingSection({title,value,primary=false}:{title:string;value:string|null|undefined;primary?:boolean}){
  const text=normalizeIdeaText(value)
  if(!text)return null
  return <section className="py-8 sm:py-9"><h2 className="text-lg font-bold text-ink sm:text-xl">{title}</h2><div className={`mt-4 max-w-[62rem] whitespace-pre-wrap text-ink-soft ${primary?'text-[1rem] leading-[1.65] sm:text-[1.0625rem]':'text-[.98rem] leading-[1.7]'}`}>{text}</div></section>
}
function Detail({label,value}:{label:string;value:string}){return <div><dt className="text-xs font-bold uppercase tracking-[.12em] text-ink-muted">{label}</dt><dd className="mt-1.5 whitespace-pre-wrap leading-6 text-ink-soft">{value}</dd></div>}