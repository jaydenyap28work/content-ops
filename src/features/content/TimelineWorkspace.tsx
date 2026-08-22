import { Clock3, History } from 'lucide-react'
import { Card, StatusBadge } from '../../components/ui'
import type { ActivityLogRecord, WorkflowBundle, WorkflowEventRecord } from './workflow-api'

const label = (value: string) => value.split('_').map((part) => part[0]?.toUpperCase()+part.slice(1)).join(' ')
const formatDate = (value: string) => new Date(value).toLocaleString('en-MY')
function context(item: ActivityLogRecord) {
  const metadata=item.metadata??{}
  if(typeof metadata.reason==='string') return metadata.reason
  if(typeof metadata.user_name==='string'&&typeof metadata.contribution_role==='string') return `${metadata.user_name} · ${metadata.contribution_role}`
  if(typeof metadata.to==='string') return `New value: ${metadata.to}`
  return 'Internal change recorded'
}
function Event({ event }: { event: WorkflowEventRecord }) {
  return <li className="relative grid gap-1 pl-8 before:absolute before:left-[.42rem] before:top-6 before:h-[calc(100%+.5rem)] before:w-px before:bg-line last:before:hidden"><span className="absolute left-0 top-1.5 size-3.5 rounded-full border-2 border-paper bg-coral shadow-[0_0_0_1px_var(--color-coral)]"/><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{label(event.event_type)}</p><time className="font-mono text-[.68rem] text-ink-faint">{formatDate(event.occurred_at)}</time></div><p className="text-xs text-ink-muted">{event.actor_name} · {label(event.from_state)} → {label(event.to_state)}</p>{event.notes?<p className="mt-1 rounded-md border border-line bg-canvas-raised px-3 py-2 text-sm leading-6">{event.notes}</p>:null}</li>
}
export function TimelineWorkspace({ bundle }: { bundle: WorkflowBundle }) {
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)]"><Card><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="size-4 text-coral"/><p className="text-xs font-extrabold uppercase tracking-[.18em] text-ink-faint">Workflow timeline</p></div><StatusBadge tone="info">Immutable</StatusBadge></div>{bundle.events.length?<ol className="mt-6 space-y-6">{bundle.events.map((event)=><Event key={event.id} event={event}/>)}</ol>:<p className="mt-5 rounded-md border border-dashed border-line-strong p-5 text-sm text-ink-muted">No workflow event yet.</p>}</Card><Card tone="quiet"><div className="flex items-center gap-2"><Clock3 className="size-4 text-blue"/><p className="text-xs font-extrabold uppercase tracking-[.18em] text-ink-faint">Internal activity</p></div><p className="mt-2 text-xs leading-5 text-ink-muted">Management/data changes remain distinct from workflow transitions.</p>{bundle.activity.length?<ul className="mt-5 space-y-4">{bundle.activity.map((item)=><li key={item.id} className="border-l-2 border-blue/35 pl-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{label(item.action)}</p><time className="font-mono text-[.65rem] text-ink-faint">{formatDate(item.occurred_at)}</time></div><p className="mt-1 text-xs text-ink-muted">{item.actor_name} · {context(item)}</p></li>)}</ul>:<p className="mt-5 text-sm text-ink-muted">No internal activity yet.</p>}</Card></div>
}
