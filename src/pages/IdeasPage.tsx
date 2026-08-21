import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Archive, ArrowRight, CheckCircle2, Lightbulb, LoaderCircle, Pencil, Plus, RotateCcw, Search, X, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, FormField, Input, Select, StatusBadge, Textarea } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import {
  changeIdeaStatus, loadContributorOptions, loadIdeas, loadReferences, loadResearchCatalog, saveIdea,
} from '../features/research/research-api'
import type { ContributorOption, IdeaRecord, IdeaStatus, ReferenceRecord, ResearchCatalog } from '../features/research/research-api'
import { IdeaConversionDrawer } from '../features/content/IdeaConversionDrawer'

type ContributorDraft = { userId: string; roleId: string; notes: string }
type IdeaForm = {
  clientId: string; title: string; sourceUrl: string; originalTopic: string; originalHook: string; whyItWorks: string;
  ourAngle: string; categoryId: string; suggestedFormat: string; priority: string; ownerUserId: string; notes: string;
  referenceIds: string[]; tags: string; contributors: ContributorDraft[]
}

const blankIdea: IdeaForm = { clientId: '', title: '', sourceUrl: '', originalTopic: '', originalHook: '', whyItWorks: '', ourAngle: '', categoryId: '', suggestedFormat: '', priority: 'normal', ownerUserId: '', notes: '', referenceIds: [], tags: '', contributors: [] }
const statuses: Array<{ value: IdeaStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' }, { value: 'new', label: 'New' }, { value: 'evaluating', label: 'Evaluating' },
  { value: 'approved', label: 'Approved' }, { value: 'converted', label: 'Converted' }, { value: 'rejected', label: 'Rejected' }, { value: 'archived', label: 'Archived' },
]

export function IdeasPage() {
  const { workspace, session } = useAuth()
  const [catalog, setCatalog] = useState<ResearchCatalog>({ clients: [], platforms: [], categories: [], contributionRoles: [] })
  const [ideas, setIdeas] = useState<IdeaRecord[]>([])
  const [references, setReferences] = useState<ReferenceRecord[]>([])
  const [contributors, setContributors] = useState<ContributorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [referenceFilter, setReferenceFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<IdeaRecord | null | undefined>(undefined)
  const [form, setForm] = useState<IdeaForm>(blankIdea)
  const [contributorDraft, setContributorDraft] = useState({ userId: '', roleId: '' })
  const [converting, setConverting] = useState<IdeaRecord | null>(null)
  const navigate = useNavigate()

  const isSuperAdmin = workspace?.roles.includes('Super Admin') ?? false
  const isManager = workspace?.roles.includes('Internal Manager') ?? false
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return ideas.filter((idea) => {
      if (statusFilter !== 'all' && idea.status !== statusFilter) return false
      if (clientFilter !== 'all' && idea.client_id !== clientFilter) return false
      if (categoryFilter !== 'all' && idea.category_id !== categoryFilter) return false
      if (referenceFilter === 'with' && idea.referenceIds.length === 0) return false
      if (referenceFilter === 'without' && idea.referenceIds.length > 0) return false
      return !term || [idea.title, idea.original_topic ?? '', idea.our_angle ?? '', ...idea.tags].some((value) => value.toLowerCase().includes(term))
    })
  }, [categoryFilter, clientFilter, ideas, referenceFilter, search, statusFilter])

  if (!hasResearchRole) return <Card className="mx-auto mt-12 max-w-2xl text-center"><Lightbulb className="mx-auto size-9 text-coral" /><h2 className="mt-4 font-display text-3xl font-semibold">Internal ideation access required</h2><p className="mt-3 leading-7 text-ink-muted">Ideas remain internal. Client roles do not receive this data surface in V0.1.</p></Card>

  function parseTags(value: string) { return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))] }
  async function setFormClient(clientId: string) {
    setForm((current) => ({ ...current, clientId, categoryId: '', referenceIds: current.referenceIds.filter((id) => {
      const ref = references.find((item) => item.id === id)
      return ref && (ref.client_id === null || ref.client_id === clientId || ref.relatedClientIds.includes(clientId))
    }) }))
    try { setContributors(clientId ? await loadContributorOptions(clientId) : []) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load contributors') }
  }
  async function openEditor(idea: IdeaRecord | null) {
    setEditing(idea); setError(null)
    const clientId = idea?.client_id ?? catalog.clients[0]?.id ?? ''
    const options = clientId ? await loadContributorOptions(clientId) : []
    setContributors(options)
    const creatorRole = catalog.contributionRoles.find((role) => role.code === 'idea_creator')?.id ?? ''
    setForm(idea ? {
      clientId: idea.client_id, title: idea.title, sourceUrl: idea.source_url ?? '', originalTopic: idea.original_topic ?? '', originalHook: idea.original_hook ?? '',
      whyItWorks: idea.why_it_works ?? '', ourAngle: idea.our_angle ?? '', categoryId: idea.category_id ?? '', suggestedFormat: idea.suggested_format ?? '',
      priority: idea.priority, ownerUserId: idea.owner_user_id ?? '', notes: idea.notes ?? '', referenceIds: idea.referenceIds, tags: idea.tags.join(', '),
      contributors: idea.contributors.map((item) => ({ ...item, notes: item.notes ?? '' })),
    } : { ...blankIdea, clientId, ownerUserId: session?.user.id ?? '', contributors: session?.user.id && creatorRole ? [{ userId: session.user.id, roleId: creatorRole, notes: 'Idea creator' }] : [] })
  }
  function toggleReference(id: string) { setForm((current) => ({ ...current, referenceIds: current.referenceIds.includes(id) ? current.referenceIds.filter((item) => item !== id) : [...current.referenceIds, id] })) }
  function addContributor() {
    if (!contributorDraft.userId || !contributorDraft.roleId || form.contributors.some((item) => item.userId === contributorDraft.userId && item.roleId === contributorDraft.roleId)) return
    setForm((current) => ({ ...current, contributors: [...current.contributors, { ...contributorDraft, notes: '' }] })); setContributorDraft({ userId: '', roleId: '' })
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault(); if (!workspace) return
    setBusy(true); setError(null)
    try {
      await saveIdea(workspace.id, { id: editing?.id, ...form, categoryId: form.categoryId || null, ownerUserId: form.ownerUserId || null, tags: parseTags(form.tags) })
      setEditing(undefined); setNotice(editing ? 'Idea updated.' : 'Idea created.'); await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save Idea') }
    finally { setBusy(false) }
  }

  async function transition(status: IdeaStatus) {
    if (!selected) return
    let reason = ''
    if (status === 'rejected' || status === 'archived') { reason = window.prompt(`Reason for ${status}:`)?.trim() ?? ''; if (!reason) return }
    setBusy(true); setError(null)
    try { await changeIdeaStatus(selected.id, status, reason); setNotice(`Idea moved to ${status}.`); await refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not change status') }
    finally { setBusy(false) }
  }

  const scopedReferences = references.filter((ref) => form.clientId && (ref.client_id === null || ref.client_id === form.clientId || ref.relatedClientIds.includes(form.clientId)))
  const statusTone = (status: IdeaStatus) => status === 'approved' || status === 'converted' ? 'success' : status === 'rejected' ? 'critical' : status === 'evaluating' ? 'warning' : 'neutral'

  return <div className="page-enter space-y-6">
    <header className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.22em] text-coral">Planning / Idea Bank</p><h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Give good instincts somewhere to mature.</h2><p className="mt-3 max-w-2xl leading-7 text-ink-soft">Evaluate a Client angle without prematurely turning it into production work.</p></div><Button onClick={() => void openEditor(null)}><Plus className="size-4" />New Idea</Button></header>
    {error ? <div role="alert" className="rounded-lg border border-coral/30 bg-coral/8 px-4 py-3 text-sm text-coral-dark">{error}</div> : null}{notice ? <div className="rounded-lg border border-green/25 bg-green/8 px-4 py-3 text-sm text-green">{notice}</div> : null}
    <div className="flex gap-2 overflow-x-auto border-b border-line pb-3">{statuses.map((status) => <button key={status.value} type="button" onClick={() => setStatusFilter(status.value)} className={`rounded-full border px-4 py-2 text-xs font-extrabold uppercase tracking-wider ${statusFilter === status.value ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink-muted hover:border-ink/30'}`}>{status.label}<span className="ml-2 opacity-55">{status.value === 'all' ? ideas.length : ideas.filter((idea) => idea.status === status.value).length}</span></button>)}</div>
    <Card className="grid gap-3 p-4 md:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,auto))]"><label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, angle, tag" className="pl-10" /></label><Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}><option value="all">All Clients</option>{catalog.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select><Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{catalog.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select><Select value={referenceFilter} onChange={(e) => setReferenceFilter(e.target.value)}><option value="all">Any source</option><option value="with">Has Reference</option><option value="without">No Reference</option></Select></Card>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]"><Card className="overflow-hidden p-0">{loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-6 animate-spin text-coral" /></div> : filtered.length === 0 ? <div className="grid min-h-72 place-items-center text-center"><div><Lightbulb className="mx-auto size-8 text-ink-faint" /><h3 className="mt-4 font-display text-2xl font-semibold">No matching Ideas</h3><p className="mt-2 text-sm text-ink-muted">Capture a new angle or clear a filter.</p></div></div> : <div className="divide-y divide-line">{filtered.map((idea) => <button key={idea.id} type="button" onClick={() => setSelectedId(idea.id)} className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-canvas-raised md:grid-cols-[minmax(0,1.4fr)_minmax(8rem,.6fr)_auto]"><div className="min-w-0"><div className="flex gap-2"><StatusBadge tone={statusTone(idea.status)}>{idea.status}</StatusBadge><StatusBadge>{idea.priority}</StatusBadge></div><p className="mt-2 truncate font-bold">{idea.title}</p><p className="mt-1 line-clamp-1 text-sm text-ink-muted">{idea.our_angle || 'Angle not documented yet.'}</p></div><div className="self-center"><p className="text-sm font-semibold">{catalog.clients.find((client) => client.id === idea.client_id)?.name ?? 'Client'}</p><p className="mt-1 text-xs text-ink-faint">{catalog.categories.find((category) => category.id === idea.category_id)?.name ?? 'Uncategorised'}</p></div><div className="flex items-center gap-3 self-center text-xs font-bold text-ink-faint"><span>{idea.referenceIds.length} sources</span><span>{idea.contributors.length} people</span></div></button>)}</div>}</Card>
      <Card tone={selected ? 'default' : 'quiet'} className="h-fit xl:sticky xl:top-28">{!selected ? <div className="py-12 text-center"><Lightbulb className="mx-auto size-8 text-ink-faint" /><h3 className="mt-4 font-display text-2xl font-semibold">Select an Idea</h3><p className="mt-2 text-sm leading-6 text-ink-muted">Angle, provenance, contributors, and next action appear here.</p></div> : <div className="space-y-6"><div><div className="flex items-center justify-between gap-3"><StatusBadge tone={statusTone(selected.status)}>{selected.status}</StatusBadge><StatusBadge>{selected.priority}</StatusBadge></div><h3 className="mt-3 font-display text-3xl font-semibold">{selected.title}</h3><p className="mt-2 text-sm font-semibold text-ink-muted">{catalog.clients.find((client) => client.id === selected.client_id)?.name}</p></div><section><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">Our angle</p><p className="mt-2 text-sm leading-6 text-ink-muted">{selected.our_angle || 'Not documented.'}</p></section><section><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">Original hook</p><p className="mt-2 text-sm leading-6 text-ink-muted">{selected.original_hook || 'Not documented.'}</p></section><section><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">Source References</p>{selected.referenceIds.length ? <div className="mt-2 space-y-2">{selected.referenceIds.map((id) => <div key={id} className="rounded-md border border-line p-3"><p className="text-sm font-bold">{references.find((ref) => ref.id === id)?.title ?? 'Archived Reference'}</p><p className="mt-1 text-xs text-ink-faint">Relationship retained</p></div>)}</div> : <p className="mt-2 text-sm text-ink-muted">Direct Idea — no Reference selected.</p>}</section><section><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">Contributors</p><div className="mt-2 flex flex-wrap gap-2">{selected.contributors.map((item) => <StatusBadge key={`${item.userId}-${item.roleId}`}>{catalog.contributionRoles.find((role) => role.id === item.roleId)?.name ?? 'Contributor'}</StatusBadge>)}</div></section>{selected.status_reason ? <Card tone="quiet" className="p-4"><p className="text-xs font-bold uppercase tracking-wider text-ink-faint">Latest status reason</p><p className="mt-2 text-sm">{selected.status_reason}</p></Card> : null}<div className="grid gap-2 border-t border-line pt-5">{!['converted','archived'].includes(selected.status) ? <Button variant="secondary" onClick={() => void openEditor(selected)}><Pencil className="size-4" />Edit Idea</Button> : null}{selected.status === 'new' ? <Button onClick={() => void transition('evaluating')}>Start evaluation</Button> : null}{selected.status === 'evaluating' ? <Button onClick={() => void transition('approved')}><CheckCircle2 className="size-4" />Approve Idea</Button> : null}{selected.status === 'rejected' || selected.status === 'archived' ? <Button onClick={() => void transition('evaluating')}><RotateCcw className="size-4" />Restore to evaluating</Button> : null}{!['rejected','archived','converted'].includes(selected.status) ? <Button variant="ghost" onClick={() => void transition('rejected')}><XCircle className="size-4" />Reject</Button> : null}{selected.status !== 'archived' ? <Button variant="ghost" onClick={() => void transition('archived')}><Archive className="size-4" />Archive</Button> : null}{selected.status === 'approved' ? <Button onClick={() => setConverting(selected)}><ArrowRight className="size-4" />Convert to Content</Button> : null}</div></div>}</Card></div>
    {converting && workspace ? <IdeaConversionDrawer workspaceId={workspace.id} idea={converting} clientName={catalog.clients.find((client) => client.id === converting.client_id)?.name ?? 'Client'} categoryName={catalog.categories.find((category) => category.id === converting.category_id)?.name ?? null} references={references.filter((reference) => converting.referenceIds.includes(reference.id))} canManagePrivateNotes={isSuperAdmin || isManager} onClose={() => setConverting(null)} onConverted={async (contentId, contentCode) => { setConverting(null); setNotice(`Created ${contentCode}.`); await refresh(); navigate(`/content/${contentId}`) }} /> : null}
    {editing !== undefined ? <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm"><section className="h-full w-full max-w-3xl overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8"><div className="flex justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">Idea record</p><h3 className="mt-2 font-display text-3xl font-semibold">{editing ? 'Edit Idea' : 'New Idea'}</h3></div><Button variant="ghost" size="icon" onClick={() => setEditing(undefined)}><X className="size-5" /></Button></div><form className="mt-8 space-y-5" onSubmit={handleSave}><div className="grid gap-4 sm:grid-cols-2"><FormField label="Client" htmlFor="idea-client" required hint={editing ? 'Client ownership is fixed after creation.' : undefined}><Select id="idea-client" required disabled={Boolean(editing)} value={form.clientId} onChange={(e) => void setFormClient(e.target.value)}><option value="">Choose Client</option>{catalog.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></FormField><FormField label="Priority" htmlFor="idea-priority"><Select id="idea-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select></FormField></div><FormField label="Idea title" htmlFor="idea-title" required><Input id="idea-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></FormField><FormField label="Our angle" htmlFor="idea-angle" required><Textarea id="idea-angle" required value={form.ourAngle} onChange={(e) => setForm({ ...form, ourAngle: e.target.value })} /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Category" htmlFor="idea-category"><Select id="idea-category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">No category</option>{catalog.categories.filter((category) => category.client_id === null || category.client_id === form.clientId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></FormField><FormField label="Suggested format" htmlFor="idea-format"><Input id="idea-format" value={form.suggestedFormat} onChange={(e) => setForm({ ...form, suggestedFormat: e.target.value })} /></FormField></div><div className="grid gap-4 sm:grid-cols-2"><FormField label="Original topic" htmlFor="idea-topic"><Input id="idea-topic" value={form.originalTopic} onChange={(e) => setForm({ ...form, originalTopic: e.target.value })} /></FormField><FormField label="Original hook" htmlFor="idea-hook"><Input id="idea-hook" value={form.originalHook} onChange={(e) => setForm({ ...form, originalHook: e.target.value })} /></FormField></div><FormField label="Source URL" htmlFor="idea-url"><Input id="idea-url" type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} /></FormField><FormField label="Why it works" htmlFor="idea-why"><Textarea id="idea-why" value={form.whyItWorks} onChange={(e) => setForm({ ...form, whyItWorks: e.target.value })} /></FormField><FormField label="Notes" htmlFor="idea-notes"><Textarea id="idea-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField><FormField label="Tags" htmlFor="idea-tags" hint="Comma-separated; stored as normalized Idea Tags."><Input id="idea-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></FormField><fieldset><legend className="text-sm font-semibold">Source References</legend><div className="mt-2 max-h-52 space-y-2 overflow-y-auto">{scopedReferences.length ? scopedReferences.map((ref) => { const retained = editing?.referenceIds.includes(ref.id) ?? false; return <label key={ref.id} className="flex gap-3 rounded-md border border-line p-3 text-sm"><input type="checkbox" checked={form.referenceIds.includes(ref.id)} disabled={retained} onChange={() => toggleReference(ref.id)} className="size-4 accent-coral" /><span><span className="font-bold">{ref.title}</span>{retained ? <span className="ml-2 text-xs text-coral">Retained provenance</span> : null}</span></label> }) : <p className="text-sm text-ink-muted">Choose a Client to see eligible References.</p>}</div></fieldset><fieldset><legend className="text-sm font-semibold">Contributors</legend><div className="mt-2 space-y-2">{form.contributors.map((item, index) => <div key={`${item.userId}-${item.roleId}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-line p-3"><div><p className="text-sm font-bold">{contributors.find((person) => person.user_profile_id === item.userId)?.display_name ?? 'Workspace member'}</p><p className="text-xs text-ink-faint">{catalog.contributionRoles.find((role) => role.id === item.roleId)?.name}</p></div><Button size="sm" variant="ghost" onClick={() => setForm({ ...form, contributors: form.contributors.filter((_, itemIndex) => itemIndex !== index) })}>Remove</Button></div>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Select aria-label="Contributor" value={contributorDraft.userId} onChange={(e) => setContributorDraft({ ...contributorDraft, userId: e.target.value })}><option value="">Choose person</option>{contributors.map((person) => <option key={person.user_profile_id} value={person.user_profile_id}>{person.display_name}</option>)}</Select><Select aria-label="Contribution role" value={contributorDraft.roleId} onChange={(e) => setContributorDraft({ ...contributorDraft, roleId: e.target.value })}><option value="">Choose role</option>{catalog.contributionRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select><Button variant="secondary" onClick={addContributor}>Add</Button></div></fieldset><div className="flex gap-3 border-t border-line pt-5"><Button type="submit" disabled={busy || !form.clientId}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}Save Idea</Button><Button variant="secondary" onClick={() => setEditing(undefined)}>Cancel</Button></div></form></section></div> : null}
  </div>
}
