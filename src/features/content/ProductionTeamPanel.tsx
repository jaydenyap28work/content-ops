import { useEffect, useState } from 'react'
import { LoaderCircle, UserPlus } from 'lucide-react'
import { Button, Card, Select } from '../../components/ui'
import { useI18n } from '../i18n/i18n'
import { assignContentTeamMember, loadWorkflowAssignmentCatalog } from './workflow-api'
import type { ContentContributorRecord, ProductionRoleCode } from './workflow-api'

const roles:ProductionRoleCode[]=['owner','talent','director','shooter','editor','reviewer','publisher']
const labels:Record<ProductionRoleCode,[string,string]>={
 owner:['内容负责人','Content Owner'],talent:['出镜','Talent'],director:['编导','Director'],shooter:['摄影','Shooter'],
 editor:['剪辑','Editor'],reviewer:['审核','Reviewer'],publisher:['发布','Publisher'],
}
export function ProductionTeamPanel({workspaceId,clientId,contentId,contributors,ideaProviderName,canManage,onChanged}:{workspaceId:string;clientId:string;contentId:string;contributors:ContentContributorRecord[];ideaProviderName:string|null;canManage:boolean;onChanged:()=>Promise<void>}){
 const{language}=useI18n();const zh=language==='zh-CN';const[people,setPeople]=useState<Array<{id:string;name:string}>>([]);const[editing,setEditing]=useState<ProductionRoleCode|null>(null);const[selected,setSelected]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('')
 useEffect(()=>{if(!canManage)return;let active=true;void loadWorkflowAssignmentCatalog(workspaceId,clientId).then(catalog=>{if(active)setPeople(catalog.people.map(person=>({id:person.id,name:person.name}))) }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load Team')});return()=>{active=false}},[canManage,clientId,workspaceId])
 const assigned=(code:ProductionRoleCode)=>contributors.find(item=>item.status==='active'&&item.contribution_role_code===code)
 async function save(code:ProductionRoleCode){if(!selected)return;setBusy(true);setError('');try{await assignContentTeamMember({contentId,teamMemberId:selected,roleCode:code,notes:''});setEditing(null);setSelected('');await onChanged()}catch(e){setError(e instanceof Error?e.message:'Unable to assign Team Member')}finally{setBusy(false)}}
 return <Card><p className="text-xs font-extrabold uppercase tracking-[.18em] text-coral">{zh?'制作团队':'Production Team'}</p>{error?<p className="mt-3 text-xs text-coral-dark">{error}</p>:null}<div className="mt-4 border-b border-line pb-4"><p className="text-xs text-ink-muted">{zh?'创意提供者':'Idea provider'}</p><p className="mt-1 font-bold">{ideaProviderName??(zh?'待指定':'Not assigned')}</p><p className="mt-1 text-xs text-ink-faint">{zh?'来自内容计划 · 只读归属':'From Content Plan · read-only attribution'}</p></div><div className="divide-y divide-line">{roles.map(code=>{const member=assigned(code);return <div key={code} className="py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-ink-muted">{labels[code][zh?0:1]}</p><p className="mt-1 font-bold">{member?.display_name??(zh?'未分配':'Unassigned')}</p></div>{canManage?<Button size="sm" variant="ghost" onClick={()=>{setEditing(editing===code?null:code);setSelected(member?.team_member_id??'')}}>{member?(zh?'更换':'Change'):<><UserPlus className="size-3.5"/>{zh?'指派':'Assign'}</>}</Button>:null}</div>{editing===code?<div className="mt-3 flex gap-2"><Select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">{zh?'选择团队成员':'Choose Team Member'}</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</Select><Button size="sm" disabled={!selected||busy} onClick={()=>void save(code)}>{busy?<LoaderCircle className="size-4 animate-spin"/>:null}{zh?'保存':'Save'}</Button></div>:null}</div>})}</div></Card>
}
