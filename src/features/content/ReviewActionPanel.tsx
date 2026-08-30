import { useMemo, useState } from 'react'
import { CheckCircle2, LoaderCircle, Send, Video } from 'lucide-react'
import { Button, Card, FormField, Input, StatusBadge, Textarea } from '../../components/ui'
import type { ContentRecord } from './content-api'
import type { ContentContributorRecord } from './workflow-api'
import type { MediaInput, ReviewBundle } from './review-api'
import { startReview, startRevision, submitFirstCut, submitRevision } from './review-api'
import { useI18n } from '../i18n/i18n'
import { enumLabel } from '../i18n/labels'

const empty:MediaInput={externalUrl:'',localPath:'',nasPath:'',note:''}
export function ReviewActionPanel({content,bundle,contributors,currentUserId,workspaceRoles,onChanged}:{content:ContentRecord;bundle:ReviewBundle;contributors:ContentContributorRecord[];currentUserId:string;workspaceRoles:string[];onChanged:()=>Promise<void>}){
 const{language}=useI18n();const zh=language==='zh-CN';const[media,setMedia]=useState(empty);const[busy,setBusy]=useState(false);const[error,setError]=useState('')
 const editor=workspaceRoles.includes('Editor')&&contributors.some(i=>i.status==='active'&&i.contribution_role_code==='editor'&&i.user_profile_id===currentUserId)
 const reviewer=contributors.some(i=>i.status==='active'&&i.contribution_role_code==='reviewer'&&i.user_profile_id===currentUserId)
 const openRevision=bundle.revisions.some(i=>i.status==='open')
 const nextVersion=(bundle.media[0]?.version_number??0)+1
 const action=useMemo(()=>{
  if(content.current_status==='editing'&&openRevision)return{label:zh?`提交修改版 V${nextVersion}`:`Submit Revision V${nextVersion}`,enabled:editor,run:()=>submitRevision(content.id,content.current_status,media,media.note)}
  if(content.current_status==='editing')return{label:zh?'提交初剪 V1':'Submit First Cut V1',enabled:editor,run:()=>submitFirstCut(content.id,content.current_status,media)}
  if(content.current_status==='first_cut_submitted')return{label:zh?'开始审核':'Start Review',enabled:reviewer,run:()=>startReview(content.id,content.current_status,media.note)}
  if(content.current_status==='revision_required')return{label:zh?'开始修改':'Start Revision',enabled:editor,run:()=>startRevision(content.id,content.current_status,media.note)}
  return null
 },[content,editor,media,nextVersion,openRevision,reviewer,zh])
 if(!action)return null
 async function submit(){setBusy(true);setError('');try{await action!.run();setMedia(empty);await onChanged()}catch(e){setError(e instanceof Error?e.message:'Workflow action failed')}finally{setBusy(false)}}
 return <Card className="overflow-hidden border-blue/30 p-0"><div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]"><section className="p-5"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone="info">{enumLabel(content.current_status,language)}</StatusBadge><p className="text-xs font-bold text-ink-muted">{zh?'当前操作':'Current action'}</p></div><h3 className="mt-3 text-2xl font-bold">{action.label}</h3>{['editing'].includes(content.current_status)?<div className="mt-4 grid gap-3 sm:grid-cols-2"><FormField label={zh?'Drive / 外部链接（选填）':'Drive / external link (optional)'}><Input value={media.externalUrl} onChange={e=>setMedia({...media,externalUrl:e.target.value})}/></FormField><FormField label={zh?'版本备注（选填）':'Version note (optional)'}><Input value={media.note} onChange={e=>setMedia({...media,note:e.target.value})}/></FormField></div>:<Textarea className="mt-4 min-h-20" placeholder={zh?'备注（选填）':'Note (optional)'} value={media.note} onChange={e=>setMedia({...media,note:e.target.value})}/>} {error?<p className="mt-3 text-sm text-coral-dark">{error}</p>:null}<Button className="mt-4" size="lg" disabled={!action.enabled||busy} onClick={()=>void submit()}>{busy?<LoaderCircle className="size-4 animate-spin"/>:content.current_status==='editing'?<Send className="size-4"/>:<CheckCircle2 className="size-4"/>}{action.label}</Button>{!action.enabled?<p className="mt-2 text-xs text-coral-dark">{zh?'需要当前内容的有效 Editor / Reviewer 分配与角色':'Requires the active Editor / Reviewer assignment and role'}</p>:null}</section><aside className="border-t border-line bg-ink p-5 text-white lg:border-l lg:border-t-0"><Video className="size-5 text-coral-light"/><p className="mt-4 text-sm font-bold">{zh?'状态不可手动选择':'No manual status selection'}</p><p className="mt-2 text-xs leading-5 text-white/55">{zh?'提交后由数据库原子记录版本、时间、人员与流程事件':'The database records version, time, actor, and workflow event atomically'}</p></aside></div></Card>
}
