import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Columns3, LayoutList, Lightbulb, LoaderCircle, Plus, Search, Sparkles } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Input, Select } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { canManageIdeaDecisions } from '../features/auth/role-access'
import { useI18n } from '../features/i18n/i18n'
import { enumLabel } from '../features/i18n/labels'
import { bulkUpdateIdeas, generateShootingBriefs } from '../features/pilot/pilot-api'
import { toShootingBriefGenerationInput } from '../features/pilot/shooting-brief-templates'
import { IdeaBoardView } from '../features/research/IdeaPlannerView'
import { IdeaPlannerV2 } from '../features/research/IdeaPlannerV2'
import { QuickIdeaForm } from '../features/research/QuickIdeaForm'
import { readIdeaPlanViewState, writeIdeaPlanViewState } from '../features/research/idea-detail-navigation'
import type { IdeaPlanViewState } from '../features/research/idea-detail-navigation'
import { filterPlannerIdeas, planningStatusLabel } from '../features/research/idea-planner'
import { loadIdeaProviderOptions, loadIdeas, loadResearchCatalog } from '../features/research/research-api'
import type { IdeaProviderOption, IdeaRecord, PlanningStatus, ResearchCatalog } from '../features/research/research-api'
import { useDevMountCounter } from '../lib/dev-diagnostics'

const statuses:Array<PlanningStatus|'decision'|'all'>=['decision','new','evaluating','confirmed','paused','rejected','archived','all']
const SCROLL_KEY='contentos:ideas-scroll'

export function IdeasPage(){
  useDevMountCounter('IdeasPage')
  const {workspace}=useAuth()
  const {language}=useI18n()
  const zh=language==='zh-CN'
  const navigate=useNavigate()
  const [searchParams,setSearchParams]=useSearchParams()
  const initial=readIdeaPlanViewState(searchParams)
  const [catalog,setCatalog]=useState<ResearchCatalog>({clients:[],platforms:[],categories:[],contributionRoles:[]})
  const [ideas,setIdeas]=useState<IdeaRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [notice,setNotice]=useState<string|null>(null)
  const [search,setSearch]=useState(initial.search)
  const [statusFilter,setStatusFilter]=useState<IdeaPlanViewState['status']>(initial.status)
  const [clientFilter,setClientFilter]=useState(initial.clientId)
  const [categoryFilter,setCategoryFilter]=useState(initial.categoryId)
  const [referenceFilter,setReferenceFilter]=useState<IdeaPlanViewState['reference']>(initial.reference)
  const [view,setView]=useState<IdeaPlanViewState['view']>(initial.view)
  const [editing,setEditing]=useState<IdeaRecord|null|undefined>(undefined)
  const [selectedIds,setSelectedIds]=useState<string[]>([])
  const [bulkField,setBulkField]=useState<'planning_status'|'provider'|'target_publish_date'|'planned_shoot_date'|'priority'|'category'|'tags'>('planning_status')
  const [bulkValue,setBulkValue]=useState('')
  const [providerOptions,setProviderOptions]=useState<IdeaProviderOption[]>([])
  const restoredScroll=useRef(false)
  const roles=workspace?.roles??[]
  const hasResearchRole=roles.includes('Idea Contributor')||canManageIdeaDecisions(roles)
  const canDecide=canManageIdeaDecisions(roles)

  const refresh=useCallback(async()=>{
    if(!workspace||!hasResearchRole)return
    setLoading(true);setError(null)
    try{const[nextCatalog,nextIdeas]=await Promise.all([loadResearchCatalog(workspace.id),loadIdeas(workspace.id)]);setCatalog(nextCatalog);setIdeas(nextIdeas)}
    catch(caught){setError(caught instanceof Error?caught.message:'Could not load Ideas')}
    finally{setLoading(false)}
  },[hasResearchRole,workspace])

  useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),0);return()=>window.clearTimeout(timer)},[refresh])
  useEffect(()=>{const timer=window.setTimeout(()=>{if(clientFilter==='all'){setProviderOptions([]);return}void loadIdeaProviderOptions(clientFilter).then(setProviderOptions)},0);return()=>window.clearTimeout(timer)},[clientFilter])
  useEffect(()=>{const next=writeIdeaPlanViewState({search,status:statusFilter,clientId:clientFilter,categoryId:categoryFilter,reference:referenceFilter,view});if(next.toString()!==searchParams.toString())setSearchParams(next,{replace:true})},[categoryFilter,clientFilter,referenceFilter,search,searchParams,setSearchParams,statusFilter,view])
  useEffect(()=>{if(loading||restoredScroll.current)return;restoredScroll.current=true;const saved=sessionStorage.getItem(SCROLL_KEY);if(saved){sessionStorage.removeItem(SCROLL_KEY);requestAnimationFrame(()=>window.scrollTo({top:Number(saved),behavior:'instant'}))}},[loading])

  const filtered=useMemo(()=>filterPlannerIdeas(ideas,{search,status:statusFilter,clientId:clientFilter,categoryId:categoryFilter,reference:referenceFilter}),[categoryFilter,clientFilter,ideas,referenceFilter,search,statusFilter])
  function openIdea(idea:IdeaRecord){const query=writeIdeaPlanViewState({search,status:statusFilter,clientId:clientFilter,categoryId:categoryFilter,reference:referenceFilter,view}).toString();const from='/ideas'+(query?'?'+query:'');sessionStorage.setItem(SCROLL_KEY,String(window.scrollY));navigate(`/ideas/${idea.id}`,{state:{from}})}
  async function applyBulk(){if(!selectedIds.length||!bulkValue.trim())return;setBusy(true);setError(null);try{const values=bulkField==='tags'?bulkValue.split(',').map(value=>value.trim()).filter(Boolean):[bulkField==='planned_shoot_date'?`${bulkValue}:00+08:00`:bulkValue];await bulkUpdateIdeas(selectedIds,bulkField,values);setNotice(zh?`已更新 ${selectedIds.length} 条选题`:`${selectedIds.length} Ideas updated`);setSelectedIds([]);setBulkValue('');await refresh()}catch(caught){setError(caught instanceof Error?caught.message:(zh?'批量更新失败':'Bulk update failed'))}finally{setBusy(false)}}
  async function generateSelectedBriefs(){const selectedIdeas=ideas.filter(idea=>selectedIds.includes(idea.id));const invalid=selectedIdeas.filter(idea=>idea.status!=='converted');if(invalid.length){setError(zh?'拍摄简报只属于已进入制作的内容':'Shooting Briefs belong to confirmed Production Content');return}setBusy(true);setError(null);try{await generateShootingBriefs(selectedIdeas.map(toShootingBriefGenerationInput));setNotice(zh?`已为 ${selectedIdeas.length} 条制作内容填补空白拍摄简报`:`Briefs generated for ${selectedIdeas.length} Production items`);setSelectedIds([])}catch(caught){setError(caught instanceof Error?caught.message:'Unable to generate briefs')}finally{setBusy(false)}}

  if(!hasResearchRole)return <Card className="mx-auto mt-12 max-w-2xl text-center"><Lightbulb className="mx-auto size-9 text-primary"/><h2 className="mt-4 font-display text-3xl font-semibold">{zh?'需要内部选题权限':'Internal ideation access required'}</h2></Card>
  return <div className="page-enter space-y-5" aria-busy={busy}>
    <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.22em] text-primary">{zh?'选题决策池':'Idea Decision Pool'}</p><h1 className="mt-1.5 font-display text-4xl font-semibold tracking-[-.03em] sm:text-5xl">{zh?'内容计划':'Content Plan'}</h1><p className="mt-2 text-sm text-ink-muted">{zh?'这里只决定“这个主题要不要做”；拍摄、剪辑、审核与发布统一在制作中心推进':'Decide whether a topic should be made. Production execution stays in Production Center'}</p></div><Button onClick={()=>setEditing(null)}><Plus className="size-4"/>{zh?'新增选题':'New Idea'}</Button></header>
    {error?<div role="alert" className="rounded-lg border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger-dark">{error}</div>:null}
    {notice?<div className="rounded-lg border border-green/25 bg-green/8 px-4 py-3 text-sm text-green">{notice}</div>:null}
    <div className="flex gap-2 overflow-x-auto border-b border-line pb-3">{statuses.map(status=><button key={status} onClick={()=>setStatusFilter(status)} className={`rounded-full border px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider ${statusFilter===status?'border-primary bg-primary text-white':'border-line bg-paper text-ink-muted hover:border-primary/30'}`}>{status==='decision'?(zh?'待决定':'Decision Queue'):status==='all'?(zh?'全部历史':'All History'):planningStatusLabel(status,language)}<span className="ml-2 opacity-55">{status==='decision'?ideas.filter(idea=>['new','evaluating'].includes(idea.planning_status)).length:status==='all'?ideas.length:ideas.filter(idea=>idea.planning_status===status).length}</span></button>)}</div>
    <Card className="p-3.5"><div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,auto))_auto]"><label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"/><Input value={search} onChange={event=>setSearch(event.target.value)} placeholder={zh?'搜索标题、方向或标签':'Search title, direction, or tag'} className="pl-10"/></label><Select value={clientFilter} onChange={event=>setClientFilter(event.target.value)}><option value="all">{zh?'所有品牌':'All Brands'}</option>{catalog.clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</Select><Select value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}><option value="all">{zh?'所有分类':'All Categories'}</option>{catalog.categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</Select><Select value={referenceFilter} onChange={event=>setReferenceFilter(event.target.value as IdeaPlanViewState['reference'])}><option value="all">{zh?'所有来源':'Any Source'}</option><option value="with">{zh?'有来源':'Has Source'}</option><option value="without">{zh?'没有来源':'No Source'}</option></Select><div className="inline-flex rounded-lg border border-line bg-canvas-raised p-1"><button onClick={()=>setView('planner')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold ${view==='planner'?'bg-paper text-ink shadow-sm':'text-ink-muted'}`}><LayoutList className="size-4"/>{zh?'列表':'List'}</button><button onClick={()=>setView('board')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold ${view==='board'?'bg-paper text-ink shadow-sm':'text-ink-muted'}`}><Columns3 className="size-4"/>{zh?'看板':'Board'}</button></div></div></Card>
    {selectedIds.length?<Card className="flex flex-col gap-3 border-primary/25 bg-primary/[.035] p-3 sm:flex-row sm:flex-wrap sm:items-center"><p className="text-sm font-bold">{zh?`已选择 ${selectedIds.length} 条`:`${selectedIds.length} selected`}</p><Select value={bulkField} onChange={e=>{setBulkField(e.target.value as typeof bulkField);setBulkValue('')}} className="sm:w-48"><option value="planning_status">{zh?'策划状态':'Planning Status'}</option><option value="provider">{zh?'创意提供者':'Idea provider'}</option><option value="target_publish_date">{zh?'目标发布日期':'Target Publish Date'}</option><option value="planned_shoot_date">{zh?'计划拍摄日期':'Planned Shoot Date'}</option><option value="priority">{zh?'优先级':'Priority'}</option><option value="category">{zh?'分类':'Category'}</option><option value="tags">{zh?'标签':'Tags'}</option></Select>{bulkField==='planning_status'?<Select value={bulkValue} onChange={e=>setBulkValue(e.target.value)} className="sm:w-48"><option value="">{zh?'选择策划状态':'Choose Status'}</option>{statuses.filter((value):value is PlanningStatus=>!['all','decision'].includes(value)).map(value=><option key={value} value={value}>{planningStatusLabel(value,language)}</option>)}</Select>:bulkField==='provider'?<Select value={bulkValue} onChange={e=>setBulkValue(e.target.value)} disabled={clientFilter==='all'} className="sm:w-52"><option value="">{clientFilter==='all'?(zh?'先筛选单一品牌':'Filter one brand first'):(zh?'选择创意提供者':'Choose Idea provider')}</option>{providerOptions.map(option=><option key={option.team_member_id} value={option.team_member_id}>{option.display_name}</option>)}</Select>:bulkField==='priority'?<Select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}><option value="">{zh?'选择优先级':'Choose Priority'}</option>{(['low','normal','high','urgent'] as const).map(value=><option key={value} value={value}>{enumLabel(value,language)}</option>)}</Select>:bulkField==='category'?<Select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}><option value="">{zh?'选择分类':'Choose Category'}</option>{catalog.categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</Select>:<Input type={bulkField==='target_publish_date'?'date':bulkField==='planned_shoot_date'?'date':'text'} placeholder={bulkField==='tags'?(zh?'用逗号分隔标签':'Comma-separated tags'):''} value={bulkValue} onChange={e=>setBulkValue(e.target.value)} className="sm:max-w-xs"/>}<Button size="sm" onClick={()=>void applyBulk()} disabled={busy||!bulkValue}>{zh?'套用':'Apply'}</Button><Button size="sm" variant="secondary" onClick={()=>void generateSelectedBriefs()} disabled={busy}><Sparkles className="size-4"/>{zh?'生成拍摄简报':'Generate Briefs'}</Button><Button size="sm" variant="ghost" onClick={()=>setSelectedIds([])}>{zh?'清除选择':'Clear'}</Button></Card>:null}
    <Card className="overflow-hidden p-0">{loading?<div className="grid min-h-72 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary"/></div>:filtered.length===0?<div className="grid min-h-72 place-items-center text-center"><div><Lightbulb className="mx-auto size-8 text-ink-faint"/><h3 className="mt-4 font-display text-2xl font-semibold">{zh?'目前没有待决定选题':'No Ideas in this view'}</h3><p className="mt-2 text-sm text-ink-muted">{zh?'已确认内容会进入制作中心，可从“已确认”筛选查看历史':'Confirmed Ideas move to Production Center and remain available under Confirmed history'}</p></div></div>:view==='planner'?<IdeaPlannerV2 ideas={filtered} allowSelection={canDecide} selectedIds={selectedIds} onToggle={(ideaId,checked)=>setSelectedIds(current=>checked?[...current,ideaId]:current.filter(id=>id!==ideaId))} onSelect={openIdea}/>:<IdeaBoardView ideas={filtered} onSelect={openIdea}/>}</Card>
    {editing!==undefined&&workspace?<QuickIdeaForm workspaceId={workspace.id} idea={editing} catalog={catalog} onClose={()=>setEditing(undefined)} onSaved={async message=>{setEditing(undefined);setNotice(message);await refresh()}}/>:null}
  </div>
}