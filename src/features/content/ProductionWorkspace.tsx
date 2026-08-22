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
  assignContentContributor,
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
} from './workflow-api'
import type { ContributionRoleRecord, ContributorOption } from '../research/research-api'

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

function TimelineEvent({ event }: { event: WorkflowEventRecord }) {
  return (
    <li className="relative grid gap-1 pl-8 before:absolute before:left-[0.42rem] before:top-6 before:h-[calc(100%+0.5rem)] before:w-px before:bg-line last:before:hidden">
      <span className="absolute left-0 top-1.5 grid size-3.5 place-items-center rounded-full border-2 border-paper bg-coral shadow-[0_0_0_1px_var(--color-coral)]" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{eventLabels[event.event_type] ?? label(event.event_type)}</p>
        <time className="font-mono text-[0.68rem] text-ink-faint">{formatDate(event.occurred_at)}</time>
      </div>
      <p className="text-xs text-ink-muted">{event.actor_name} · {label(event.from_state)} → {label(event.to_state)}</p>
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
  const [note, setNote] = useState('')
  const [schedule, setSchedule] = useState(() => toLocalInput(bundle.production.shoot_scheduled_at))
  const [people, setPeople] = useState<ContributorOption[]>([])
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
        setSelectedUser((current) => current || catalog.people[0]?.user_profile_id || '')
        setSelectedRole((current) => current || catalog.roles[0]?.id || '')
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not load assignment options') })
    return () => { active = false }
  }, [canManage, content.client_id, workspaceId])

  const activeContributors = bundle.contributors.filter((item) => item.status === 'active')
  const historicalContributors = bundle.contributors.filter((item) => item.status === 'removed')
  const nextAction = actionByStatus[content.current_status]
  const assignedShooter = activeContributors.some((item) => item.user_profile_id === currentUserId && item.contribution_role_code === 'shooter')
  const assignedEditor = activeContributors.some((item) => item.user_profile_id === currentUserId && item.contribution_role_code === 'editor')
  const canExecute = !nextAction ? false
    : nextAction.action === 'mark_ready_to_shoot' ? canManage
      : ['start_shooting', 'complete_shooting'].includes(nextAction.action)
        ? workspaceRoles.includes('Shooter') && assignedShooter
        : workspaceRoles.includes('Editor') && assignedEditor

  const productionMilestones = useMemo(() => [
    ['Shoot scheduled', bundle.production.shoot_scheduled_at],
    ['Shooting started', bundle.production.shooting_started_at],
    ['Shooting completed', bundle.production.shooting_completed_at],
    ['Editing started', bundle.production.editing_started_at],
  ], [bundle.production])

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
      await assignContentContributor({ contentId: content.id, userId: selectedUser, contributionRoleId: selectedRole, notes: contributorNotes })
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
            <div className="flex items-center gap-2"><CircleDot className="size-4 text-coral" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Primary workflow action</p></div>
            {nextAction ? <div className="mt-5"><div className="flex items-start gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink text-paper"><nextAction.icon className="size-5 text-coral-light" /></div><div><h3 className="font-display text-2xl font-semibold">{nextAction.label}</h3><p className="mt-1 max-w-xl text-sm leading-6 text-ink-muted">{nextAction.support}</p></div></div><Textarea className="mt-5 min-h-20" aria-label="Workflow action note" placeholder="Optional execution note…" value={note} onChange={(event) => setNote(event.target.value)} /><div className="mt-4 flex flex-wrap items-center gap-3"><Button size="lg" disabled={!canExecute || busy !== null} onClick={() => void runAction()}>{busy === 'action' ? <LoaderCircle className="size-4 animate-spin" /> : <nextAction.icon className="size-4" />}{nextAction.label}</Button>{!canExecute ? <p className="max-w-md text-xs leading-5 text-coral-dark">This action is locked until your role and active Content assignment satisfy the permission matrix.</p> : null}</div></div> : <div className="mt-5 rounded-lg border border-dashed border-line-strong p-5"><p className="font-bold">Phase 6 workflow complete</p><p className="mt-2 text-sm leading-6 text-ink-muted">The next transition begins with First Cut and Review in Phase 7.</p></div>}
          </section>
          <aside className="border-t border-line bg-canvas-raised p-5 lg:border-l lg:border-t-0"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Current stage</p><p className="mt-3 font-display text-2xl font-semibold">{label(content.current_status)}</p><p className="mt-2 text-xs leading-5 text-ink-muted">Status is read-only metadata. Only a valid workflow action can update it.</p></aside>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2"><CalendarClock className="size-4 text-blue" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Production dates</p></div>
          {canManage ? <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"><FormField className="flex-1" label="Shoot scheduled at" htmlFor="shoot-scheduled-at" hint="Planning time; actual timestamps are recorded by actions."><Input id="shoot-scheduled-at" type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></FormField><Button variant="secondary" disabled={busy !== null} onClick={() => void saveSchedule()}>{busy === 'schedule' ? <LoaderCircle className="size-4 animate-spin" /> : null}Save schedule</Button></div> : null}
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">{productionMilestones.map(([term, value]) => <div key={term} className="rounded-md border border-line p-3"><dt className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-faint">{term}</dt><dd className="mt-1.5 text-sm font-semibold">{formatDate(value)}</dd></div>)}</dl>
          {content.current_status === 'shot_awaiting_edit' && !bundle.production.shooting_completed_at ? <p className="mt-4 text-xs text-coral-dark">Completion timestamp is pending verification.</p> : null}
          {bundle.production.shooting_completed_at ? <p className="mt-4 text-xs text-ink-muted">Asset location may remain pending after Complete Shooting; it does not block the workflow.</p> : null}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><UserRoundCheck className="size-4 text-gold" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Contributors</p></div><StatusBadge>{activeContributors.length} active</StatusBadge></div>
          <div className="mt-5 space-y-3">{activeContributors.length ? activeContributors.map((contributor) => <div key={contributor.id} className="flex items-start justify-between gap-3 rounded-md border border-line p-3"><div><p className="font-bold">{contributor.display_name}</p><p className="mt-1 text-xs text-ink-muted">{contributor.contribution_role_name}{contributor.notes ? ` · ${contributor.notes}` : ''}</p></div>{canManage ? <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void remove(contributor)}><UserRoundX className="size-3.5" />Remove</Button> : null}</div>) : <p className="rounded-md border border-dashed border-line-strong p-4 text-sm text-ink-muted">No active contributor assignments.</p>}</div>
          {historicalContributors.length ? <details className="mt-4 border-t border-line pt-4"><summary className="cursor-pointer text-xs font-bold text-ink-muted">Removed history · {historicalContributors.length}</summary><div className="mt-3 space-y-2">{historicalContributors.map((item) => <p key={item.id} className="text-xs text-ink-muted">{item.display_name} · {item.contribution_role_name} · removed {formatDate(item.removed_at)}</p>)}</div></details> : null}
          {canManage ? <form className="mt-5 grid gap-3 border-t border-line pt-5" onSubmit={assign}><div className="grid gap-3 sm:grid-cols-2"><FormField label="Person" htmlFor="contributor-person"><Select id="contributor-person" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>{people.map((person) => <option key={person.user_profile_id} value={person.user_profile_id}>{person.display_name}</option>)}</Select></FormField><FormField label="Contribution role" htmlFor="contributor-role"><Select id="contributor-role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select></FormField></div><Input aria-label="Contributor notes" placeholder="Optional assignment context" value={contributorNotes} onChange={(event) => setContributorNotes(event.target.value)} /><Button className="justify-self-start" type="submit" disabled={busy !== null || !selectedUser || !selectedRole}>{busy === 'assign' ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}Assign contributor</Button></form> : null}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <Card>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="size-4 text-coral" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Production timeline</p></div><StatusBadge tone="info">Immutable</StatusBadge></div>
          {bundle.events.length ? <ol className="mt-6 space-y-6">{bundle.events.map((event) => <TimelineEvent key={event.id} event={event} />)}</ol> : <div className="mt-5 rounded-lg border border-dashed border-line-strong p-6 text-center"><Clock3 className="mx-auto size-6 text-ink-faint" /><p className="mt-3 font-bold">No workflow events yet</p><p className="mt-1 text-sm text-ink-muted">The first legal action will start this immutable timeline.</p></div>}
        </Card>

        <Card tone="quiet">
          <div className="flex items-center gap-2"><Clock3 className="size-4 text-blue" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Internal activity</p></div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">Management and data changes are separate from production transitions.</p>
          {bundle.activity.length ? <ul className="mt-5 space-y-4">{bundle.activity.map((item) => <li key={item.id} className="border-l-2 border-blue/35 pl-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{activityLabels[item.action] ?? label(item.action)}</p><time className="font-mono text-[0.65rem] text-ink-faint">{formatDate(item.occurred_at)}</time></div><p className="mt-1 text-xs text-ink-muted">{item.actor_name} · {activityContext(item)}</p></li>)}</ul> : <p className="mt-5 rounded-md border border-dashed border-line-strong p-4 text-sm text-ink-muted">No management activity recorded in M06 yet.</p>}
        </Card>
      </div>
    </div>
  )
}
