import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Archive, ArrowRight, ExternalLink, FileSearch, LoaderCircle, Pencil, Plus, Search, Star, X } from 'lucide-react'
import { Button, Card, FormField, Input, Select, StatusBadge, Textarea } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { useDevMountCounter } from '../lib/dev-diagnostics'
import {
  archiveReference, createIdeaFromReference, loadReferences, loadResearchCatalog, saveReference,
} from '../features/research/research-api'
import type { ReferenceRecord, ResearchCatalog } from '../features/research/research-api'

interface ReferenceForm {
  clientId: string
  type: 'account' | 'content'
  title: string
  accountName: string
  platformId: string
  url: string
  industry: string
  country: string
  contentStyle: string
  format: string
  whyItWorks: string
  notes: string
  goldStandard: boolean
  relatedClientIds: string[]
  tags: string
}

const emptyForm: ReferenceForm = {
  clientId: '', type: 'content', title: '', accountName: '', platformId: '', url: '', industry: '', country: '',
  contentStyle: '', format: '', whyItWorks: '', notes: '', goldStandard: false, relatedClientIds: [] as string[], tags: '',
}

export function ReferencesPage() {
  useDevMountCounter('ReferencesPage')
  const { workspace } = useAuth()
  const [catalog, setCatalog] = useState<ResearchCatalog>({ clients: [], platforms: [], categories: [], contributionRoles: [] })
  const [references, setReferences] = useState<ReferenceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [goldOnly, setGoldOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ReferenceRecord | null | undefined>(undefined)
  const [form, setForm] = useState(emptyForm)
  const [converting, setConverting] = useState<ReferenceRecord | null>(null)
  const [ideaForm, setIdeaForm] = useState({ clientId: '', title: '', ourAngle: '', categoryId: '', priority: 'normal', notes: '', tags: '' })

  const isSuperAdmin = workspace?.roles.includes('Super Admin') ?? false
  const hasResearchRole = isSuperAdmin || workspace?.roles.includes('Internal Manager') || workspace?.roles.includes('Strategist / Content Planner')

  const refresh = useCallback(async () => {
    if (!workspace || !hasResearchRole) return
    setLoading(true); setError(null)
    try {
      const [nextCatalog, nextReferences] = await Promise.all([loadResearchCatalog(workspace.id), loadReferences(workspace.id)])
      setCatalog(nextCatalog); setReferences(nextReferences)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load References') }
    finally { setLoading(false) }
  }, [hasResearchRole, workspace])

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])

  const selected = references.find((item) => item.id === selectedId) ?? null
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return references.filter((item) => {
      if (typeFilter !== 'all' && item.reference_type !== typeFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (platformFilter !== 'all' && item.platform_id !== platformFilter) return false
      if (clientFilter !== 'all' && item.client_id !== clientFilter && !item.relatedClientIds.includes(clientFilter)) return false
      if (goldOnly && !item.gold_standard) return false
      return !term || [item.title, item.account_name ?? '', item.url, item.industry ?? '', ...item.tags].some((value) => value.toLowerCase().includes(term))
    })
  }, [clientFilter, goldOnly, platformFilter, references, search, statusFilter, typeFilter])

  if (!hasResearchRole) return <Card className="mx-auto mt-12 max-w-2xl text-center"><FileSearch className="mx-auto size-9 text-coral" /><h2 className="mt-4 font-display text-3xl font-semibold">Internal research access required</h2><p className="mt-3 leading-7 text-ink-muted">References are not exposed to Client roles. Access requires an assigned Manager or Strategist scope.</p></Card>

  function tags(value: string) { return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))] }
  function openEditor(item: ReferenceRecord | null) {
    setEditing(item); setError(null)
    setForm(item ? {
      clientId: item.client_id ?? '', type: item.reference_type, title: item.title, accountName: item.account_name ?? '', platformId: item.platform_id ?? '',
      url: item.url, industry: item.industry ?? '', country: item.country ?? '', contentStyle: item.content_style ?? '', format: item.format ?? '',
      whyItWorks: item.why_it_works ?? '', notes: item.learning_notes ?? '', goldStandard: item.gold_standard,
      relatedClientIds: item.relatedClientIds, tags: item.tags.join(', '),
    } : emptyForm)
  }
  function toggleRelated(clientId: string) { setForm((current) => ({ ...current, relatedClientIds: current.relatedClientIds.includes(clientId) ? current.relatedClientIds.filter((id) => id !== clientId) : [...current.relatedClientIds, clientId] })) }

  async function handleSave(event: FormEvent) {
    event.preventDefault(); if (!workspace) return
    setBusy(true); setError(null)
    try {
      const relatedClientIds = form.clientId ? [...new Set([...form.relatedClientIds, form.clientId])] : form.relatedClientIds
      await saveReference(workspace.id, { id: editing?.id, ...form, clientId: form.clientId || null, platformId: form.platformId || null, relatedClientIds, tags: tags(form.tags) })
      setEditing(undefined); setNotice(editing ? 'Reference updated.' : 'Reference created.'); await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save Reference') }
    finally { setBusy(false) }
  }

  async function handleArchive(item: ReferenceRecord) {
    if (!window.confirm(`Archive “${item.title}”? Existing Idea provenance remains intact.`)) return
    setBusy(true); setError(null)
    try { await archiveReference(item.id); setNotice('Reference archived.'); setSelectedId(null); await refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not archive Reference') }
    finally { setBusy(false) }
  }

  function openConversion(item: ReferenceRecord) {
    const defaultClient = item.client_id ?? item.relatedClientIds.find((id) => catalog.clients.some((client) => client.id === id)) ?? catalog.clients[0]?.id ?? ''
    setConverting(item); setIdeaForm({ clientId: defaultClient, title: item.title, ourAngle: '', categoryId: '', priority: 'normal', notes: '', tags: item.tags.join(', ') })
  }
  async function handleConvert(event: FormEvent) {
    event.preventDefault(); if (!workspace || !converting) return
    setBusy(true); setError(null)
    try {
      await createIdeaFromReference(workspace.id, converting.id, { ...ideaForm, categoryId: ideaForm.categoryId || null, tags: tags(ideaForm.tags) })
      setConverting(null); setNotice('Idea created with Reference provenance preserved.'); await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create Idea') }
    finally { setBusy(false) }
  }

  const duplicateUrl = form.url.trim() && references.some((item) => item.id !== editing?.id && item.url.trim().toLowerCase() === form.url.trim().toLowerCase())

  return <div className="page-enter space-y-6">
    <header className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.22em] text-coral">资源库 / Inspiration Library</p><h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">灵感库</h2><p className="mt-3 max-w-2xl leading-7 text-ink-soft">收集值得参考的影片、帖子、账号和内容形式，之后可以直接转成自己的选题。</p></div><Button onClick={() => openEditor(null)}><Plus className="size-4" />保存灵感</Button></header>
    {error ? <div role="alert" className="rounded-lg border border-coral/30 bg-coral/8 px-4 py-3 text-sm text-coral-dark">{error}</div> : null}{notice ? <div className="rounded-lg border border-green/25 bg-green/8 px-4 py-3 text-sm text-green">{notice}</div> : null}
    <Card className="grid gap-3 p-4 md:grid-cols-[minmax(14rem,1fr)_repeat(4,minmax(8rem,auto))]"><label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, account, URL, tag" className="pl-10" /></label><Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All types</option><option value="account">Accounts</option><option value="content">Content</option></Select><Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}><option value="all">All Clients</option>{catalog.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select><Select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}><option value="all">All platforms</option>{catalog.platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</Select><div className="flex items-center gap-3"><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All status</option></Select><label className="flex items-center gap-2 whitespace-nowrap text-xs font-bold"><input type="checkbox" checked={goldOnly} onChange={(e) => setGoldOnly(e.target.checked)} className="size-4 accent-coral" />Gold</label></div></Card>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <Card className="overflow-hidden p-0">{loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-6 animate-spin text-coral" /></div> : filtered.length === 0 ? <div className="grid min-h-72 place-items-center text-center"><div><FileSearch className="mx-auto size-8 text-ink-faint" /><h3 className="mt-4 font-display text-2xl font-semibold">还没有保存的灵感</h3><p className="mt-2 text-sm text-ink-muted">看到不错的老板IP、Reel 或小红书内容，可以先存这里。</p></div></div> : <div className="divide-y divide-line">{filtered.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-canvas-raised md:grid-cols-[minmax(0,1.5fr)_minmax(8rem,.7fr)_auto]"><div className="min-w-0"><div className="flex items-center gap-2"><StatusBadge tone="neutral">{item.reference_type}</StatusBadge>{item.gold_standard ? <Star className="size-4 fill-gold text-gold" /> : null}</div><p className="mt-2 truncate font-bold">{item.title}</p><p className="mt-1 truncate text-sm text-ink-muted">{item.account_name || item.url}</p></div><div className="self-center text-sm"><p className="font-semibold">{catalog.platforms.find((platform) => platform.id === item.platform_id)?.name ?? 'No platform'}</p><p className="mt-1 text-xs text-ink-faint">{item.tags.slice(0, 3).join(' · ') || 'No tags'}</p></div><div className="flex items-center gap-2 self-center"><StatusBadge tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</StatusBadge><span className="text-xs font-bold text-ink-faint">{item.relatedIdeaIds.length} Ideas</span></div></button>)}</div>}</Card>
      <Card tone={selected ? 'default' : 'quiet'} className="h-fit xl:sticky xl:top-28">{!selected ? <div className="py-12 text-center"><FileSearch className="mx-auto size-8 text-ink-faint" /><h3 className="mt-4 font-display text-2xl font-semibold">Select a Reference</h3><p className="mt-2 text-sm leading-6 text-ink-muted">Analysis, Clients, tags, and provenance appear here.</p></div> : <div className="space-y-6"><div><div className="flex items-center justify-between gap-3"><StatusBadge tone={selected.gold_standard ? 'warning' : 'neutral'}>{selected.gold_standard ? 'Gold standard' : selected.reference_type}</StatusBadge><span className="text-xs font-bold text-ink-faint">{selected.status}</span></div><h3 className="mt-3 font-display text-3xl font-semibold">{selected.title}</h3><p className="mt-2 text-sm text-ink-muted">{selected.account_name || 'Account not specified'}</p></div><a href={selected.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md border border-line p-3 text-sm font-bold hover:border-coral/40"><span className="truncate">Open source</span><ExternalLink className="size-4" /></a><section><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">Why worth referencing</p><p className="mt-2 text-sm leading-6 text-ink-muted">{selected.why_it_works || 'Not documented yet.'}</p></section><section><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">Learning notes</p><p className="mt-2 text-sm leading-6 text-ink-muted">{selected.learning_notes || 'No notes yet.'}</p></section><section><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">Related Clients</p><div className="mt-2 flex flex-wrap gap-2">{selected.relatedClientIds.map((id) => <StatusBadge key={id}>{catalog.clients.find((client) => client.id === id)?.name ?? 'Client'}</StatusBadge>)}</div></section><section><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">Provenance</p><p className="mt-2 text-sm font-semibold">Used by {selected.relatedIdeaIds.length} Idea{selected.relatedIdeaIds.length === 1 ? '' : 's'}</p></section>{selected.status === 'active' ? <div className="grid gap-2 border-t border-line pt-5"><Button onClick={() => openConversion(selected)}>Create Idea <ArrowRight className="size-4" /></Button><Button variant="secondary" onClick={() => openEditor(selected)}><Pencil className="size-4" />Edit</Button><Button variant="ghost" disabled={busy} onClick={() => void handleArchive(selected)}><Archive className="size-4" />Archive</Button></div> : null}</div>}</Card>
    </div>
    {editing !== undefined ? <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm"><section className="h-full w-full max-w-2xl overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8"><div className="flex justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">Reference record</p><h3 className="mt-2 font-display text-3xl font-semibold">{editing ? '编辑灵感' : '保存灵感'}</h3></div><Button variant="ghost" size="icon" onClick={() => setEditing(undefined)}><X className="size-5" /></Button></div><form className="mt-8 space-y-5" onSubmit={handleSave}><div className="grid gap-4 sm:grid-cols-2"><FormField label="Type" htmlFor="ref-type"><Select id="ref-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'account' | 'content' })}><option value="content">Content</option><option value="account">Account</option></Select></FormField><FormField label="Primary scope" htmlFor="ref-client" hint={editing ? 'Ownership scope is fixed after creation.' : undefined}><Select id="ref-client" disabled={Boolean(editing)} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>{isSuperAdmin ? <option value="">Workspace library</option> : null}{catalog.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></FormField></div><FormField label="Title" htmlFor="ref-title" required><Input id="ref-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Account" htmlFor="ref-account"><Input id="ref-account" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /></FormField><FormField label="Platform" htmlFor="ref-platform"><Select id="ref-platform" value={form.platformId} onChange={(e) => setForm({ ...form, platformId: e.target.value })}><option value="">No platform</option>{catalog.platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</Select></FormField></div><FormField label="Source URL" htmlFor="ref-url" required error={duplicateUrl ? 'This URL already exists in another Reference. You may still save a different analysis angle.' : undefined}><Input id="ref-url" type="url" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Industry" htmlFor="ref-industry"><Input id="ref-industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></FormField><FormField label="Country" htmlFor="ref-country"><Input id="ref-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></FormField><FormField label="Content style" htmlFor="ref-style"><Input id="ref-style" value={form.contentStyle} onChange={(e) => setForm({ ...form, contentStyle: e.target.value })} /></FormField><FormField label="Format" htmlFor="ref-format"><Input id="ref-format" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} /></FormField></div><FormField label="Why it works" htmlFor="ref-why"><Textarea id="ref-why" value={form.whyItWorks} onChange={(e) => setForm({ ...form, whyItWorks: e.target.value })} /></FormField><FormField label="Learning notes" htmlFor="ref-notes"><Textarea id="ref-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField><FormField label="Tags" htmlFor="ref-tags" hint="Comma-separated; stored as normalized Tags."><Input id="ref-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></FormField><fieldset><legend className="text-sm font-semibold">Related Clients</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{catalog.clients.map((client) => <label key={client.id} className="flex gap-3 rounded-md border border-line p-3 text-sm font-bold"><input type="checkbox" checked={form.relatedClientIds.includes(client.id) || form.clientId === client.id} disabled={form.clientId === client.id} onChange={() => toggleRelated(client.id)} className="size-4 accent-coral" />{client.name}</label>)}</div></fieldset><label className="flex items-center gap-3 rounded-md border border-gold/30 bg-gold/8 p-4 text-sm font-bold"><input type="checkbox" checked={form.goldStandard} onChange={(e) => setForm({ ...form, goldStandard: e.target.checked })} className="size-4 accent-coral" /><Star className="size-4 text-gold-dark" />Gold Standard</label><div className="flex gap-3 border-t border-line pt-5"><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}保存灵感</Button><Button variant="secondary" onClick={() => setEditing(undefined)}>Cancel</Button></div></form></section></div> : null}
    {converting ? <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm"><section className="h-full w-full max-w-xl overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8"><div className="flex justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">Reference → Idea</p><h3 className="mt-2 font-display text-3xl font-semibold">Create Client angle</h3></div><Button variant="ghost" size="icon" onClick={() => setConverting(null)}><X className="size-5" /></Button></div><Card tone="quiet" className="mt-6"><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">Source retained</p><p className="mt-2 font-bold">{converting.title}</p><p className="mt-1 truncate text-xs text-ink-muted">{converting.url}</p></Card><form className="mt-6 space-y-5" onSubmit={handleConvert}><FormField label="Client" htmlFor="idea-client" required><Select id="idea-client" required value={ideaForm.clientId} onChange={(e) => setIdeaForm({ ...ideaForm, clientId: e.target.value, categoryId: '' })}><option value="">Choose Client</option>{catalog.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></FormField><FormField label="Idea title" htmlFor="idea-title" required><Input id="idea-title" required value={ideaForm.title} onChange={(e) => setIdeaForm({ ...ideaForm, title: e.target.value })} /></FormField><FormField label="Our angle" htmlFor="idea-angle" required><Textarea id="idea-angle" required value={ideaForm.ourAngle} onChange={(e) => setIdeaForm({ ...ideaForm, ourAngle: e.target.value })} /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Category" htmlFor="idea-category"><Select id="idea-category" value={ideaForm.categoryId} onChange={(e) => setIdeaForm({ ...ideaForm, categoryId: e.target.value })}><option value="">No category</option>{catalog.categories.filter((category) => category.client_id === null || category.client_id === ideaForm.clientId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></FormField><FormField label="Priority" htmlFor="idea-priority"><Select id="idea-priority" value={ideaForm.priority} onChange={(e) => setIdeaForm({ ...ideaForm, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select></FormField></div><FormField label="Tags" htmlFor="idea-tags"><Input id="idea-tags" value={ideaForm.tags} onChange={(e) => setIdeaForm({ ...ideaForm, tags: e.target.value })} /></FormField><FormField label="Notes" htmlFor="idea-notes"><Textarea id="idea-notes" value={ideaForm.notes} onChange={(e) => setIdeaForm({ ...ideaForm, notes: e.target.value })} /></FormField><div className="flex gap-3 border-t border-line pt-5"><Button type="submit" disabled={busy || !ideaForm.clientId}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}Create Idea</Button><Button variant="secondary" onClick={() => setConverting(null)}>Cancel</Button></div></form></section></div> : null}
  </div>
}
