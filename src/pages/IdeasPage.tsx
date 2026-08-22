import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ArrowRight, Columns3, LayoutList, Lightbulb, LoaderCircle, MoreHorizontal, Pencil, Plus, Search, X, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, Select, StatusBadge } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { IdeaConversionDrawer } from '../features/content/IdeaConversionDrawer'
import { IdeaFormDrawer } from '../features/research/IdeaFormDrawer'
import { IdeaBoardView, IdeaPlannerView } from '../features/research/IdeaPlannerView'
import { filterPlannerIdeas, formatPlannedDate, getDisplayedProductionStatus, getNextActionLabel, ideaStatusLabels } from '../features/research/idea-planner'
import { changeIdeaStatus, loadIdeas, loadReferences, loadResearchCatalog } from '../features/research/research-api'
import type { IdeaRecord, IdeaStatus, ReferenceRecord, ResearchCatalog } from '../features/research/research-api'
import { useDevMountCounter } from '../lib/dev-diagnostics'

const statuses: Array<{ value: IdeaStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' }, { value: 'new', label: 'New' }, { value: 'evaluating', label: 'Evaluating' },
  { value: 'approved', label: 'Approved' }, { value: 'converted', label: 'Converted' }, { value: 'rejected', label: 'Rejected' }, { value: 'archived', label: 'Archived' },
]

function statusTone(status: IdeaStatus) {
  if (status === 'approved' || status === 'converted') return 'success' as const
  if (status === 'rejected') return 'critical' as const
  if (status === 'evaluating') return 'warning' as const
  return 'neutral' as const
}

function IdeaDetailDrawer({ idea, catalog, references, busy, onClose, onEdit, onPrimaryAction, onTransition }: {
  idea: IdeaRecord
  catalog: ResearchCatalog
  references: ReferenceRecord[]
  busy: boolean
  onClose: () => void
  onEdit: () => void
  onPrimaryAction: () => void
  onTransition: (status: IdeaStatus) => void
}) {
  const client = catalog.clients.find((item) => item.id === idea.client_id)
  const category = catalog.categories.find((item) => item.id === idea.category_id)
  const linkedStatus = getDisplayedProductionStatus(idea)
  const sourceReferences = references.filter((item) => idea.referenceIds.includes(item.id))
  const isLocked = idea.status === 'converted' || idea.status === 'archived'

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/35 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-line bg-paper shadow-2xl" aria-label="Idea details">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-coral">{client?.name ?? 'Client'} / Idea detail</p>
            <h3 className="mt-2 text-xl font-bold leading-7">{idea.title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close Idea details"><X className="size-5" /></Button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-xl border border-line bg-canvas-raised/55 p-4 sm:grid-cols-4">
            <div><p className="text-[0.65rem] font-extrabold uppercase tracking-wider text-ink-faint">Planned Date</p><p className="mt-1.5 text-sm font-bold">{formatPlannedDate(idea.planned_date)}</p></div>
            <div><p className="text-[0.65rem] font-extrabold uppercase tracking-wider text-ink-faint">Category</p><p className="mt-1.5 text-sm font-bold">{category?.name ?? '—'}</p></div>
            <div><p className="text-[0.65rem] font-extrabold uppercase tracking-wider text-ink-faint">Priority</p><div className="mt-1.5"><StatusBadge>{idea.priority}</StatusBadge></div></div>
            <div><p className="text-[0.65rem] font-extrabold uppercase tracking-wider text-ink-faint">Status</p><div className="mt-1.5 flex flex-wrap gap-1"><StatusBadge tone={statusTone(idea.status)}>{ideaStatusLabels[idea.status]}</StatusBadge>{linkedStatus ? <StatusBadge tone="warning">{linkedStatus}</StatusBadge> : null}</div></div>
          </div>

          <section className="mt-6 space-y-5">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-ink-faint">Our Angle</p><p className="mt-2 whitespace-pre-wrap leading-7 text-ink-soft">{idea.our_angle || 'Not documented yet.'}</p></div>
            <div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-ink-faint">Suggested Hook</p><p className="mt-2 whitespace-pre-wrap leading-7 text-ink-soft">{idea.original_hook || 'Not documented yet.'}</p></div>
          </section>

          <div className="mt-6 rounded-xl border border-coral/20 bg-coral/[0.045] p-4">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-coral-dark">Primary Action</p>
            <Button className="mt-3 w-full justify-between" disabled={busy || (idea.status === 'converted' && !idea.linked_content_id)} onClick={onPrimaryAction}>
              {getNextActionLabel(idea)}<ArrowRight className="size-4" />
            </Button>
          </div>

          <details className="mt-6 rounded-xl border border-line bg-paper">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-bold"><span className="inline-flex items-center gap-2"><MoreHorizontal className="size-4 text-coral" />More details</span><span className="text-xs text-ink-faint">Sources · Contributors · Notes</span></summary>
            <div className="space-y-5 border-t border-line px-4 py-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="font-bold">Owner / Creator</p><p className="mt-1 text-ink-muted">{idea.owner_name || idea.creator_name || 'Unassigned'}</p></div>
                <div><p className="font-bold">Suggested format</p><p className="mt-1 text-ink-muted">{idea.suggested_format || '—'}</p></div>
              </div>
              <div><p className="font-bold">Why it works</p><p className="mt-1 whitespace-pre-wrap leading-6 text-ink-muted">{idea.why_it_works || '—'}</p></div>
              <div><p className="font-bold">Notes</p><p className="mt-1 whitespace-pre-wrap leading-6 text-ink-muted">{idea.notes || '—'}</p></div>
              <div><p className="font-bold">Tags</p><div className="mt-2 flex flex-wrap gap-1.5">{idea.tags.length ? idea.tags.map((tag) => <StatusBadge key={tag}>{tag}</StatusBadge>) : <span className="text-ink-faint">No tags</span>}</div></div>
              <div><p className="font-bold">Source References ({sourceReferences.length})</p><div className="mt-2 space-y-1.5">{sourceReferences.length ? sourceReferences.map((reference) => <a key={reference.id} className="block truncate text-blue hover:underline" href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>) : <p className="text-ink-faint">No linked References</p>}</div></div>
              <div><p className="font-bold">Contributors</p><p className="mt-1 text-ink-muted">{idea.contributors.length} recorded contribution{idea.contributors.length === 1 ? '' : 's'}</p></div>
              {idea.source_url ? <a className="inline-flex items-center gap-1 font-bold text-blue hover:underline" href={idea.source_url} target="_blank" rel="noreferrer">Open source URL<ArrowRight className="size-3.5" /></a> : null}
            </div>
          </details>
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-line bg-paper px-5 py-4 sm:px-6">
          <Button variant="secondary" disabled={isLocked || busy} onClick={onEdit}><Pencil className="size-4" />Edit</Button>
          {idea.status !== 'rejected' && idea.status !== 'converted' && idea.status !== 'archived' ? <Button variant="ghost" disabled={busy} onClick={() => onTransition('rejected')}><XCircle className="size-4" />Reject</Button> : null}
          {idea.status !== 'archived' ? <Button variant="ghost" disabled={busy} onClick={() => onTransition('archived')}><Archive className="size-4" />Archive</Button> : null}
        </footer>
      </aside>
    </div>
  )
}

export function IdeasPage() {
  useDevMountCounter('IdeasPage')
  const { workspace } = useAuth()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<ResearchCatalog>({ clients: [], platforms: [], categories: [], contributionRoles: [] })
  const [ideas, setIdeas] = useState<IdeaRecord[]>([])
  const [references, setReferences] = useState<ReferenceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [referenceFilter, setReferenceFilter] = useState<'all' | 'with' | 'without'>('all')
  const [view, setView] = useState<'planner' | 'board'>('planner')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<IdeaRecord | null | undefined>(undefined)
  const [converting, setConverting] = useState<IdeaRecord | null>(null)

  const isSuperAdmin = workspace?.roles.includes('Super Admin') ?? false
  const hasResearchRole = isSuperAdmin || workspace?.roles.includes('Internal Manager') || workspace?.roles.includes('Strategist / Content Planner')
  const selected = ideas.find((idea) => idea.id === selectedId) ?? null

  const refresh = useCallback(async () => {
    if (!workspace || !hasResearchRole) return
    setLoading(true); setError(null)
    try {
      const [nextCatalog, nextIdeas, nextReferences] = await Promise.all([loadResearchCatalog(workspace.id), loadIdeas(workspace.id), loadReferences(workspace.id)])
      setCatalog(nextCatalog); setIdeas(nextIdeas); setReferences(nextReferences)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load Ideas') }
    finally { setLoading(false) }
  }, [hasResearchRole, workspace])

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])

  const filtered = useMemo(() => filterPlannerIdeas(ideas, {
    search, status: statusFilter, clientId: clientFilter, categoryId: categoryFilter, reference: referenceFilter,
  }), [categoryFilter, clientFilter, ideas, referenceFilter, search, statusFilter])

  async function transition(idea: IdeaRecord, status: IdeaStatus) {
    let reason = ''
    if (status === 'rejected' || status === 'archived') { reason = window.prompt('Reason for ' + status + ':')?.trim() ?? ''; if (!reason) return }
    setBusy(true); setError(null)
    try { await changeIdeaStatus(idea.id, status, reason); setNotice('Idea moved to ' + ideaStatusLabels[status] + '.'); await refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not change status') }
    finally { setBusy(false) }
  }

  function primaryAction(idea: IdeaRecord) {
    if (idea.status === 'new') return void transition(idea, 'evaluating')
    if (idea.status === 'evaluating') return void transition(idea, 'approved')
    if (idea.status === 'approved') return setConverting(idea)
    if (idea.status === 'converted' && idea.linked_content_id) return navigate('/content/' + idea.linked_content_id)
    if (idea.status === 'rejected' || idea.status === 'archived') return void transition(idea, 'evaluating')
  }

  if (!hasResearchRole) return <Card className="mx-auto mt-12 max-w-2xl text-center"><Lightbulb className="mx-auto size-9 text-coral" /><h2 className="mt-4 font-display text-3xl font-semibold">Internal ideation access required</h2><p className="mt-3 leading-7 text-ink-muted">Ideas remain internal. Client roles do not receive this data surface in V0.1.</p></Card>

  return (
    <div className="page-enter space-y-5" aria-busy={busy}>
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.22em] text-coral">Planning / Idea Bank</p><h2 className="mt-1.5 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Content Planner</h2><p className="mt-2 text-sm text-ink-muted">Scan dates, decisions and production progress without opening every Idea.</p></div>
        <Button onClick={() => setEditing(null)}><Plus className="size-4" />New Idea</Button>
      </header>

      {error ? <div role="alert" className="rounded-lg border border-coral/30 bg-coral/8 px-4 py-3 text-sm text-coral-dark">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-green/25 bg-green/8 px-4 py-3 text-sm text-green">{notice}</div> : null}

      <div className="flex gap-2 overflow-x-auto border-b border-line pb-3">{statuses.map((status) => <button key={status.value} type="button" onClick={() => setStatusFilter(status.value)} className={'rounded-full border px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider ' + (statusFilter === status.value ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink-muted hover:border-ink/30')}>{status.label}<span className="ml-2 opacity-55">{status.value === 'all' ? ideas.length : ideas.filter((idea) => idea.status === status.value).length}</span></button>)}</div>

      <Card className="p-3.5">
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,auto))_auto]">
          <label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, angle, tag" className="pl-10" /></label>
          <Select aria-label="Filter by Client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="all">All Clients</option>{catalog.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select>
          <Select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{catalog.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
          <Select aria-label="Filter by source" value={referenceFilter} onChange={(event) => setReferenceFilter(event.target.value as 'all' | 'with' | 'without')}><option value="all">Any source</option><option value="with">Has Reference</option><option value="without">No Reference</option></Select>
          <div className="inline-flex rounded-lg border border-line bg-canvas-raised p-1" aria-label="Idea view">
            <button type="button" onClick={() => setView('planner')} className={'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold ' + (view === 'planner' ? 'bg-paper text-ink shadow-sm' : 'text-ink-muted')}><LayoutList className="size-4" />Planner</button>
            <button type="button" onClick={() => setView('board')} className={'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold ' + (view === 'board' ? 'bg-paper text-ink shadow-sm' : 'text-ink-muted')}><Columns3 className="size-4" />Board</button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-6 animate-spin text-coral" /></div> : filtered.length === 0 ? <div className="grid min-h-72 place-items-center text-center"><div><Lightbulb className="mx-auto size-8 text-ink-faint" /><h3 className="mt-4 font-display text-2xl font-semibold">No matching Ideas</h3><p className="mt-2 text-sm text-ink-muted">Capture a new angle or clear a filter.</p></div></div> : view === 'planner' ? <IdeaPlannerView ideas={filtered} catalog={catalog} onSelect={(idea) => setSelectedId(idea.id)} /> : <IdeaBoardView ideas={filtered} onSelect={(idea) => setSelectedId(idea.id)} />}
      </Card>

      {selected ? <IdeaDetailDrawer idea={selected} catalog={catalog} references={references} busy={busy} onClose={() => setSelectedId(null)} onEdit={() => setEditing(selected)} onPrimaryAction={() => primaryAction(selected)} onTransition={(status) => void transition(selected, status)} /> : null}
      {editing !== undefined && workspace ? <IdeaFormDrawer workspaceId={workspace.id} idea={editing} catalog={catalog} references={references} onClose={() => setEditing(undefined)} onSaved={async (message) => { setEditing(undefined); setNotice(message); await refresh() }} /> : null}
      {converting && workspace ? <IdeaConversionDrawer workspaceId={workspace.id} idea={converting} clientName={catalog.clients.find((client) => client.id === converting.client_id)?.name ?? 'Client'} categoryName={catalog.categories.find((category) => category.id === converting.category_id)?.name ?? null} references={references.filter((reference) => converting.referenceIds.includes(reference.id))} canManagePrivateNotes={isSuperAdmin || workspace.roles.includes('Internal Manager')} onClose={() => setConverting(null)} onConverted={async (contentId) => { setConverting(null); setSelectedId(null); await refresh(); navigate('/content/' + contentId) }} /> : null}
    </div>
  )
}
