import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarRange, FileText, FilterX, LoaderCircle, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, Select, StatusBadge } from '../components/ui'
import { CampaignManagerDrawer } from '../features/content/CampaignManagerDrawer'
import { ContentFormDrawer } from '../features/content/ContentFormDrawer'
import { loadContentCatalog, loadContents } from '../features/content/content-api'
import type { ContentCatalog, ContentRecord } from '../features/content/content-api'
import { useAuth } from '../features/auth/auth-context'
import { useDevMountCounter } from '../lib/dev-diagnostics'

const emptyCatalog: ContentCatalog = { clients: [], categories: [], campaigns: [] }

function statusLabel(status: string) {
  return status.split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ')
}

function priorityTone(priority: ContentRecord['priority']) {
  if (priority === 'urgent') return 'critical' as const
  if (priority === 'high') return 'warning' as const
  return 'neutral' as const
}

export function ContentPage() {
  useDevMountCounter('ContentPage')
  const { workspace } = useAuth()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<ContentCatalog>(emptyCatalog)
  const [contents, setContents] = useState<ContentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [editing, setEditing] = useState(false)
  const [managingCampaigns, setManagingCampaigns] = useState(false)

  const isSuperAdmin = workspace?.roles.includes('Super Admin') ?? false
  const isManager = workspace?.roles.includes('Internal Manager') ?? false
  const canManageContent = isSuperAdmin || isManager || workspace?.roles.includes('Strategist / Content Planner')
  const hasContentAccess = workspace?.roles.some((role) => !['Client Admin', 'Client Viewer'].includes(role)) ?? false

  const refresh = useCallback(async () => {
    if (!workspace || !hasContentAccess) return
    setLoading(true); setError(null)
    try {
      const [nextCatalog, nextContents] = await Promise.all([
        loadContentCatalog(workspace.id),
        loadContents(workspace.id),
      ])
      setCatalog(nextCatalog); setContents(nextContents)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load Content') }
    finally { setLoading(false) }
  }, [hasContentAccess, workspace])

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return contents.filter((content) => {
      if (statusFilter !== 'all' && content.record_status !== statusFilter) return false
      if (clientFilter !== 'all' && content.client_id !== clientFilter) return false
      if (categoryFilter !== 'all' && content.category_id !== categoryFilter) return false
      if (campaignFilter !== 'all' && content.campaign_id !== campaignFilter) return false
      if (priorityFilter !== 'all' && content.priority !== priorityFilter) return false
      return !term || [content.content_code, content.title, content.working_title ?? '', content.objective ?? '', ...content.tags]
        .some((value) => value.toLowerCase().includes(term))
    })
  }, [campaignFilter, categoryFilter, clientFilter, contents, priorityFilter, search, statusFilter])

  if (!hasContentAccess) return <Card className="mx-auto mt-12 max-w-2xl text-center"><FileText className="mx-auto size-9 text-coral" /><h2 className="mt-4 font-display text-3xl font-semibold">Internal Content access required</h2><p className="mt-3 leading-7 text-ink-muted">Content remains internal in this phase. Client roles and unassigned internal users do not receive this data surface.</p></Card>

  const activeFilterCount = [clientFilter, categoryFilter, campaignFilter, priorityFilter].filter((value) => value !== 'all').length + (statusFilter !== 'active' ? 1 : 0)

  return (
    <div className="page-enter space-y-6">
      <header className="grid gap-5 border-b border-line pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">Production ledger</p><h2 className="mt-2 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">Every approved direction becomes an accountable record.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">Open assigned Content to execute controlled shooting and editing actions with an immutable timeline.</p></div>
        {canManageContent ? <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setManagingCampaigns(true)}><CalendarRange className="size-4" />Campaigns</Button><Button onClick={() => setEditing(true)}><Plus className="size-4" />Create Content</Button></div> : null}
      </header>

      {error ? <div className="rounded-md border border-coral/30 bg-coral/8 p-3 text-sm text-coral-dark">{error}</div> : null}

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(5,minmax(8rem,auto))]">
          <label className="relative"><span className="sr-only">Search Content</span><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-ink-faint" /><Input className="pl-9" placeholder="Search ID, title, objective, tag…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <Select aria-label="Filter by Client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="all">All Clients</option>{catalog.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select>
          <Select aria-label="Filter by Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All Categories</option>{catalog.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
          <Select aria-label="Filter by Campaign" value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)}><option value="all">All Campaigns</option>{catalog.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</Select>
          <Select aria-label="Filter by Priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All Priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></Select>
          <Select aria-label="Filter by record state" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All records</option></Select>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-xs text-ink-muted"><span><strong className="text-ink">{filtered.length}</strong> of {contents.length} records</span>{activeFilterCount || search ? <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setClientFilter('all'); setCategoryFilter('all'); setCampaignFilter('all'); setPriorityFilter('all'); setStatusFilter('active') }}><FilterX className="size-3.5" />Clear filters</Button> : null}</div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-7 animate-spin text-coral" /></div> : filtered.length ? <>
          <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[64rem] border-collapse text-left text-sm"><thead className="bg-canvas-raised text-[0.68rem] uppercase tracking-[0.14em] text-ink-muted"><tr><th className="px-5 py-3">Content</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Category / Campaign</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Publication</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Owner</th><th className="px-5 py-3 text-right">Updated</th></tr></thead><tbody>{filtered.map((content) => <tr key={content.id} className="cursor-pointer border-t border-line transition hover:bg-coral/[0.035]" onClick={() => navigate(`/content/${content.id}`)}><td className="px-5 py-4"><p className="font-mono text-xs font-bold text-coral">{content.content_code}</p><p className="mt-1 max-w-sm font-bold">{content.title}</p>{content.working_title && content.working_title !== content.title ? <p className="mt-1 max-w-sm truncate text-xs text-ink-muted">{content.working_title}</p> : null}</td><td className="px-4 py-4 font-semibold">{catalog.clients.find((client) => client.id === content.client_id)?.name ?? 'Client'}</td><td className="px-4 py-4 text-xs leading-5 text-ink-muted">{catalog.categories.find((category) => category.id === content.category_id)?.name ?? 'Uncategorised'}<br />{catalog.campaigns.find((campaign) => campaign.id === content.campaign_id)?.name ?? 'No campaign'}</td><td className="px-4 py-4"><StatusBadge tone={content.record_status === 'archived' ? 'neutral' : 'info'}>{content.record_status === 'archived' ? 'Archived' : statusLabel(content.current_status)}</StatusBadge></td><td className="px-4 py-4"><StatusBadge tone={content.publication_state === 'needs_attention' ? 'critical' : content.publication_state === 'fully_published' ? 'success' : content.publication_state === 'partially_published' ? 'warning' : 'neutral'}>{statusLabel(content.publication_state)}</StatusBadge></td><td className="px-4 py-4"><StatusBadge tone={priorityTone(content.priority)}>{content.priority}</StatusBadge></td><td className="px-4 py-4 text-xs text-ink-muted">{content.current_owner_name ?? 'Unassigned'}</td><td className="px-5 py-4 text-right text-xs text-ink-muted">{new Date(content.updated_at).toLocaleDateString('en-MY')}<ArrowRight className="ml-3 inline size-4" /></td></tr>)}</tbody></table></div>
          <div className="divide-y divide-line lg:hidden">{filtered.map((content) => <button type="button" key={content.id} className="block w-full p-4 text-left" onClick={() => navigate(`/content/${content.id}`)}><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-coral">{content.content_code}</p><h3 className="mt-1 font-bold">{content.title}</h3><p className="mt-2 text-xs text-ink-muted">{catalog.clients.find((client) => client.id === content.client_id)?.name} · {catalog.categories.find((category) => category.id === content.category_id)?.name ?? 'Uncategorised'}</p></div><ArrowRight className="mt-1 size-4 shrink-0 text-ink-faint" /></div><div className="mt-3 flex flex-wrap gap-2"><StatusBadge tone={content.record_status === 'archived' ? 'neutral' : 'info'}>{content.record_status === 'archived' ? 'Archived' : statusLabel(content.current_status)}</StatusBadge><StatusBadge tone={priorityTone(content.priority)}>{content.priority}</StatusBadge><StatusBadge tone={content.publication_state === 'needs_attention' ? 'critical' : content.publication_state === 'fully_published' ? 'success' : 'neutral'}>{statusLabel(content.publication_state)}</StatusBadge></div></button>)}</div>
        </> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><FileText className="mx-auto size-9 text-ink-faint" /><h3 className="mt-4 font-display text-2xl font-semibold">No Content in this view</h3><p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">{canManageContent ? 'Create a direct Draft with a reason, or approve an Idea and convert it with provenance.' : 'No Content is currently assigned within your authorized Client scope.'}</p>{canManageContent ? <Button className="mt-5" onClick={() => setEditing(true)}><Plus className="size-4" />Create first Content</Button> : null}</div></div>}
      </Card>

      {editing && workspace && canManageContent ? <ContentFormDrawer workspaceId={workspace.id} catalog={catalog} canManagePrivateNotes={isSuperAdmin || isManager} onClose={() => setEditing(false)} onSaved={async (id) => { setEditing(false); await refresh(); navigate(`/content/${id}`) }} /> : null}
      {managingCampaigns && workspace && canManageContent ? <CampaignManagerDrawer workspaceId={workspace.id} catalog={catalog} onClose={() => setManagingCampaigns(false)} onChanged={refresh} /> : null}
    </div>
  )
}
