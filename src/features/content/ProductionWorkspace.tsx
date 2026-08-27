import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  History,
  LoaderCircle,
  Scissors,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  Video,
} from 'lucide-react'
import { Button, Card, FormField, Input, Select, StatusBadge, Textarea } from '../../components/ui'
import type { ContentRecord } from './content-api'
import {
  assignContentTeamMember,
  loadWorkflowAssignmentCatalog,
  performWorkflowAction,
  removeContentContributor,
  setShootSchedule,
} from './workflow-api'
import type {
  ActivityLogRecord,
  ContentContributorRecord,
  WorkflowAction,
  WorkflowBundle,
  WorkflowEventRecord,
  ProductionTeamMember,
} from './workflow-api'
import type { ContributionRoleRecord } from '../research/research-api'
import { useI18n } from '../i18n/i18n'
import { enumLabel, formatWorkspaceDate } from '../i18n/labels'

interface ProductionWorkspaceProps {
  workspaceId: string
  content: ContentRecord
  bundle: WorkflowBundle
  currentUserId: string
  workspaceRoles: string[]
  canManage: boolean
  onChanged: () => Promise<void>
}

const actionByStatus: Partial<Record<ContentRecord['current_status'], {
  action: WorkflowAction
  label: string
  support: string
  icon: typeof CheckCircle2
}>> = {
  draft: {
    action: 'mark_ready_to_shoot',
    label: 'Mark Ready to Shoot',
    support: 'Confirms the brief is ready for the assigned shooting team.',
    icon: CheckCircle2,
  },
  ready_to_shoot: {
    action: 'start_shooting',
    label: 'Start Shooting',
    support: 'Records the actual start time. Only an assigned Shooter can execute it.',
    icon: Video,
  },
  shooting: {
    action: 'complete_shooting',
    label: 'Complete Shooting',
    support: 'Records completion without requiring an Asset location yet.',
    icon: CheckCircle2,
  },
  shot_awaiting_edit: {
    action: 'start_editing',
    label: 'Start Editing',
    support: 'Records the actual editing start. Only an assigned Editor can execute it.',
    icon: Scissors,
  },
}

const eventLabels: Record<string, string> = {
  marked_ready_to_shoot: 'Marked Ready to Shoot',
  shoot_started: 'Started Shooting',
  shoot_completed: 'Completed Shooting',
  editing_started: 'Started Editing',
}

const activityLabels: Record<string, string> = {
  contributor_assigned: 'Assigned contributor',
  contributor_removed: 'Removed contributor access',
  shoot_scheduled: 'Scheduled shooting',
  shoot_rescheduled: 'Rescheduled shooting',
  shoot_schedule_cleared: 'Cleared shooting schedule',
}

function label(value: string) {
  return value.split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ')
}

const contributionRoleZh: Record<string,string> = { owner:'内容负责人',talent:'出镜',director:'编导',shooter:'摄影',editor:'剪辑负责人',reviewer:'审核人',publisher:'发布负责人' }

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('en-MY') : 'Not recorded'
}

function toLocalInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function activityContext(item: ActivityLogRecord) {
  const metadata = item.metadata ?? {}
  if (typeof metadata.user_name === 'string' && typeof metadata.contribution_role === 'string') {
    return `${metadata.user_name} · ${metadata.contribution_role}`
  }
  if (typeof metadata.to === 'string') return `New time: ${formatDate(metadata.to)}`
  return 'Management change recorded'
}

function TimelineEvent({ event, language }: { event: WorkflowEventRecord; language:'zh-CN'|'en' }) {
  const zh=language==='zh-CN';const zhEvents:Record<string,string>={marked_ready_to_shoot:'标记待拍摄',shoot_started:'开始拍摄',shoot_completed:'完成拍摄',editing_started:'开始剪辑'}
  return (
    <li className="relative grid gap-1 pl-8 before:absolute before:left-[0.42rem] before:top-6 before:h-[calc(100%+0.5rem)] before:w-px before:bg-line last:before:hidden">
      <span className="absolute left-0 top-1.5 grid size-3.5 place-items-center rounded-full border-2 border-paper bg-coral shadow-[0_0_0_1px_var(--color-coral)]" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{zh?(zhEvents[event.event_type]??enumLabel(event.event_type,language)):(eventLabels[event.event_type]??label(event.event_type))}</p>
        <time className="font-mono text-[0.68rem] text-ink-faint">{formatDate(event.occurred_at)}</time>
      </div>
      <p className="text-xs text-ink-muted">{event.actor_name} · {enumLabel(event.from_state,language)} → {enumLabel(event.to_state,language)}</p>
      {event.notes ? <p className="mt-1 rounded-md border border-line bg-canvas-raised px-3 py-2 text-sm leading-6">{event.notes}</p> : null}
    </li>
  )
}

export function ProductionWorkspace({
  workspaceId,
  content,
  bundle,
  currentUserId,
  workspaceRoles,
  canManage,
  onChanged,
}: ProductionWorkspaceProps) {
  const {language}=useI18n(); const zh=language==='zh-CN'
  const [note, setNote] = useState('')
  const [schedule, setSchedule] = useState(() => toLocalInput(bundle.production.shoot_scheduled_at))
  const [people, setPeople] = useState<ProductionTeamMember[]>([])
  const [roles, setRoles] = useState<ContributionRoleRecord[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [contributorNotes, setContributorNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canManage) return
    let active = true
    void loadWorkflowAssignmentCatalog(workspaceId, content.client_id)
      .then((catalog) => {
        if (!active) return
        setPeople(catalog.people); setRoles(catalog.roles)
        setSelectedUser((current) => current || catalog.people[0]?.id || '')
        setSelectedRole((current) => current || catalog.roles[0]?.id || '')
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not load assignment options') })
    return () => { active = false }
  }, [canManage, content.client_id, workspaceId])

  const activeContributors = bundle.contributors.filter((item) => item.status === 'active')
  const historicalContributors = bundle.contributors.filter((item) => item.status === 'removed')
  const nextAction = actionByStatus[content.current_status]
  const actionCopy=nextAction?({mark_ready_to_shoot:['待拍摄','确认拍摄简报已准备好，可交给拍摄团队。'],start_shooting:['开始拍摄','记录实际开始时间；只有已分配的拍摄负责人可执行。'],complete_shooting:['完成拍摄','记录完成时间；不强制立即填写素材位置。'],start_editing:['开始剪辑','记录实际剪辑开始时间；只有已分配的剪辑负责人可执行。']} as Record<string,[string,string]>)[nextAction.action]:null
  const nextActionLabel=zh&&actionCopy?actionCopy[0]:nextAction?.label
  const nextActionSupport=zh&&actionCopy?actionCopy[1]:nextAction?.support
  const assignedShooter = activeContributors.some((item) => item.user_profile_id === currentUserId && item.contribution_role_code === 'shooter')
  const assignedEditor = activeContributors.some((item) => item.user_profile_id === currentUserId && item.contribution_role_code === 'editor')
  const canExecute = !nextAction ? false
    : nextAction.action === 'mark_ready_to_shoot' ? canManage
      : ['start_shooting', 'complete_shooting'].includes(nextAction.action)
        ? workspaceRoles.includes('Shooter') && assignedShooter
        : workspaceRoles.includes('Editor') && assignedEditor

  const productionMilestones = useMemo(() => [
    [zh?'计划拍摄':'Shoot scheduled', bundle.production.shoot_scheduled_at],
    [zh?'开始拍摄':'Shooting started', bundle.production.shooting_started_at],
    [zh?'完成拍摄':'Shooting completed', bundle.production.shooting_completed_at],
    [zh?'开始剪辑':'Editing started', bundle.production.editing_started_at],
  ], [bundle.production, zh])

  async function runAction() {
    if (!nextAction) return
    setBusy('action'); setError(null)
    try {
      await performWorkflowAction(content.id, nextAction.action, content.current_status, note)
      setNote(''); await onChanged()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Workflow action failed') }
    finally { setBusy(null) }
  }

  async function saveSchedule() {
    setBusy('schedule'); setError(null)
    try {
      await setShootSchedule(content.id, schedule ? new Date(schedule).toISOString() : null)
      await onChanged()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update shoot schedule') }
    finally { setBusy(null) }
  }

  async function assign(event: FormEvent) {
    event.preventDefault()
    if (!selectedUser || !selectedRole) return
    setBusy('assign'); setError(null)
    try {
      const role = roles.find((item) => item.id === selectedRole)
      if (!role) throw new Error('Contribution role is unavailable')
      await assignContentTeamMember({ contentId: content.id, teamMemberId: selectedUser, roleCode: role.code, notes: contributorNotes })
      setContributorNotes(''); await onChanged()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not assign contributor') }
    finally { setBusy(null) }
  }

  async function remove(contributor: ContentContributorRecord) {
    if (!window.confirm(`Remove ${contributor.display_name} as ${contributor.contribution_role_name}? The history will remain.`)) return
    setBusy(contributor.id); setError(null)
    try { await removeContentContributor(contributor.id); await onChanged() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not remove contributor') }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-md border border-coral/30 bg-coral/8 p-3 text-sm text-coral-dark">{error}</div> : null}

      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="p-5 sm:p-6">
            <div className="flex items-center gap-2"><CircleDot className="size-4 text-coral" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">{zh?'主要流程动作':'Primary workflow action'}</p></div>
            {nextAction ? <div className="mt-5"><div className="flex items-start gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink text-paper"><nextAction.icon className="size-5 text-coral-light" /></div><div><h3 className="font-display text-2xl font-semibold">{nextActionLabel}</h3><p className="mt-1 max-w-xl text-sm leading-6 text-ink-muted">{nextActionSupport}</p></div></div><Textarea className="mt-5 min-h-20" aria-label="Workflow action note" placeholder={zh?'执行备注（选填）':'Optional execution note…'} value={note} onChange={(event) => setNote(event.target.value)} /><div className="mt-4 flex flex-wrap items-center gap-3"><Button size="lg" disabled={!canExecute || busy !== null} onClick={() => void runAction()}>{busy === 'action' ? <LoaderCircle className="size-4 animate-spin" /> : <nextAction.icon className="size-4" />}{nextActionLabel}</Button>{!canExecute ? <p className="max-w-md text-xs leading-5 text-coral-dark">{zh?'你的角色与当前内容分配尚未符合权限要求':'This action is locked until your role and active Content assignment satisfy the permission matrix.'}</p> : null}</div></div> : <div className="mt-5 rounded-lg border border-dashed border-line-strong p-5"><p className="font-bold">{zh?'当前制作阶段已完成':'Current production stage complete'}</p><p className="mt-2 text-sm leading-6 text-ink-muted">{zh?'下一步从初剪与审核继续':'The next step continues with First Cut and Review'}</p></div>}
          </section>
          <aside className="border-t border-line bg-canvas-raised p-5 lg:border-l lg:border-t-0"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">{zh?'当前阶段':'Current stage'}</p><p className="mt-3 font-display text-2xl font-semibold">{enumLabel(content.current_status,language)}</p><p className="mt-2 text-xs leading-5 text-ink-muted">{zh?'状态只能由合法流程动作更新，不能任意选择。':'Status is read-only metadata. Only a valid workflow action can update it.'}</p></aside>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2"><CalendarClock className="size-4 text-blue" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">{zh?'制作日期':'Production dates'}</p></div>
          {canManage ? <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"><FormField className="flex-1" label={zh?'计划拍摄时间':'Shoot scheduled at'} htmlFor="shoot-scheduled-at" hint={zh?'这是计划时间；实际时间由流程动作自动记录':'Planning time; actual timestamps are recorded by actions.'}><Input id="shoot-scheduled-at" type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></FormField><Button variant="secondary" disabled={busy !== null} onClick={() => void saveSchedule()}>{busy === 'schedule' ? <LoaderCircle className="size-4 animate-spin" /> : null}{zh?'保存排期':'Save schedule'}</Button></div> : null}
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">{productionMilestones.map(([term, value]) => <div key={term} className="rounded-md border border-line p-3"><dt className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-faint">{term}</dt><dd className="mt-1.5 text-sm font-semibold">{formatWorkspaceDate(value,language)}</dd></div>)}</dl>
          {content.current_status === 'shot_awaiting_edit' && !bundle.production.shooting_completed_at ? <p className="mt-4 text-xs text-coral-dark">Completion timestamp is pending verification.</p> : null}
          {bundle.production.shooting_completed_at ? <p className="mt-4 text-xs text-ink-muted">Asset location may remain pending after Complete Shooting; it does not block the workflow.</p> : null}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><UserRoundCheck className="size-4 text-gold" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">{zh?'协作人员':'Contributors'}</p></div><StatusBadge>{activeContributors.length} active</StatusBadge></div>
          <div className="mt-5 space-y-3">{activeContributors.length ? activeContributors.map((contributor) => <div key={contributor.id} className="flex items-start justify-between gap-3 rounded-md border border-line p-3"><div><p className="font-bold">{contributor.display_name}</p><p className="mt-1 text-xs text-ink-muted">{zh?(contributionRoleZh[contributor.contribution_role_code]??contributor.contribution_role_name):contributor.contribution_role_name}{contributor.notes ? ` · ${contributor.notes}` : ''}</p></div>{canManage ? <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void remove(contributor)}><UserRoundX className="size-3.5" />{zh?'移除':'Remove'}</Button> : null}</div>) : <p className="rounded-md border border-dashed border-line-strong p-4 text-sm text-ink-muted">{zh?'还没有分配协作人员':'No active contributor assignments.'}</p>}</div>
          {historicalContributors.length ? <details className="mt-4 border-t border-line pt-4"><summary className="cursor-pointer text-xs font-bold text-ink-muted">{zh?'已移除记录':'Removed history'} · {historicalContributors.length}</summary><div className="mt-3 space-y-2">{historicalContributors.map((item) => <p key={item.id} className="text-xs text-ink-muted">{item.display_name} · {zh?(contributionRoleZh[item.contribution_role_code]??item.contribution_role_name):item.contribution_role_name} · {zh?'已移除':'removed'} {formatDate(item.removed_at)}</p>)}</div></details> : null}
          {canManage ? <form className="mt-5 grid gap-3 border-t border-line pt-5" onSubmit={assign}><div className="grid gap-3 sm:grid-cols-2"><FormField label={zh?'人员':'Person'} htmlFor="contributor-person"><Select id="contributor-person" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></FormField><FormField label={zh?'协作角色':'Contribution role'} htmlFor="contributor-role"><Select id="contributor-role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select></FormField></div><Input aria-label="Contributor notes" placeholder={zh?'分配说明（选填）':'Optional assignment context'} value={contributorNotes} onChange={(event) => setContributorNotes(event.target.value)} /><Button className="justify-self-start" type="submit" disabled={busy !== null || !selectedUser || !selectedRole}>{busy === 'assign' ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}Assign contributor</Button></form> : null}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <Card>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="size-4 text-coral" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">{zh?'制作时间线':'Production timeline'}</p></div><StatusBadge tone="info">Immutable</StatusBadge></div>
          {bundle.events.length ? <ol className="mt-6 space-y-6">{bundle.events.map((event) => <TimelineEvent key={event.id} event={event} language={language} />)}</ol> : <div className="mt-5 rounded-lg border border-dashed border-line-strong p-6 text-center"><Clock3 className="mx-auto size-6 text-ink-faint" /><p className="mt-3 font-bold">No workflow events yet</p><p className="mt-1 text-sm text-ink-muted">The first legal action will start this immutable timeline.</p></div>}
        </Card>

        <Card tone="quiet">
          <div className="flex items-center gap-2"><Clock3 className="size-4 text-blue" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">{zh?'内部 Activity':'Internal activity'}</p></div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">Management and data changes are separate from production transitions.</p>
          {bundle.activity.length ? <ul className="mt-5 space-y-4">{bundle.activity.map((item) => <li key={item.id} className="border-l-2 border-blue/35 pl-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{activityLabels[item.action] ?? label(item.action)}</p><time className="font-mono text-[0.65rem] text-ink-faint">{formatDate(item.occurred_at)}</time></div><p className="mt-1 text-xs text-ink-muted">{item.actor_name} · {activityContext(item)}</p></li>)}</ul> : <p className="mt-5 rounded-md border border-dashed border-line-strong p-4 text-sm text-ink-muted">No management activity recorded in M06 yet.</p>}
        </Card>
      </div>
    </div>
  )
}
