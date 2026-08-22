import { useCallback, useEffect, useState } from 'react'
import { Archive, ArrowLeft, BookOpen, ExternalLink, FileText, Lightbulb, LoaderCircle, LockKeyhole, Pencil, Tag, UserRound } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, StatusBadge } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { ContentFormDrawer } from '../features/content/ContentFormDrawer'
import { ProductionWorkspace } from '../features/content/ProductionWorkspace'
import { archiveContent, loadContentCatalog, loadContentDetail } from '../features/content/content-api'
import type { ContentCatalog, ContentDetail } from '../features/content/content-api'
import { loadWorkflowBundle } from '../features/content/workflow-api'
import type { WorkflowBundle } from '../features/content/workflow-api'

const emptyCatalog: ContentCatalog = { clients: [], categories: [], campaigns: [] }

function label(value: string) {
  return value.split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ')
}

export function ContentDetailPage() {
  const { contentId } = useParams()
  const { workspace, session } = useAuth()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ContentDetail | null>(null)
  const [workflow, setWorkflow] = useState<WorkflowBundle | null>(null)
  const [catalog, setCatalog] = useState<ContentCatalog>(emptyCatalog)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const isSuperAdmin = workspace?.roles.includes('Super Admin') ?? false
  const isManager = workspace?.roles.includes('Internal Manager') ?? false
  const canManageContent = isSuperAdmin || isManager || workspace?.roles.includes('Strategist / Content Planner')
  const hasContentAccess = workspace?.roles.some((role) => !['Client Admin', 'Client Viewer'].includes(role)) ?? false

  const refresh = useCallback(async () => {
    if (!workspace || !contentId || !hasContentAccess) return
    setLoading(true); setError(null)
    try {
      const [nextDetail, nextCatalog, nextWorkflow] = await Promise.all([
        loadContentDetail(workspace.id, contentId),
        loadContentCatalog(workspace.id),
        loadWorkflowBundle(contentId),
      ])
      setDetail(nextDetail); setCatalog(nextCatalog); setWorkflow(nextWorkflow)
      if (!nextDetail) setError('Content not found or outside your authorized Client scope.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load Content detail') }
    finally { setLoading(false) }
  }, [contentId, hasContentAccess, workspace])

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])

  async function archive() {
    if (!detail) return
    const reason = window.prompt(`Reason for archiving ${detail.content.content_code}:`)?.trim() ?? ''
    if (!reason) return
    setBusy(true); setError(null)
    try { await archiveContent(detail.content.id, reason); await refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not archive Content') }
    finally { setBusy(false) }
  }

  if (!hasContentAccess) return <Card className="mx-auto mt-12 max-w-2xl text-center"><FileText className="mx-auto size-9 text-coral" /><h2 className="mt-4 font-display text-3xl font-semibold">Internal Content access required</h2><p className="mt-3 leading-7 text-ink-muted">This detail surface is not available to Client roles.</p></Card>
  if (loading) return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-8 animate-spin text-coral" /></div>
  if (!detail || !workflow || !session) return <Card className="mx-auto max-w-2xl text-center"><FileText className="mx-auto size-9 text-ink-faint" /><h2 className="mt-4 font-display text-3xl font-semibold">Content unavailable</h2><p className="mt-3 text-sm leading-6 text-ink-muted">{error}</p><Button className="mt-5" onClick={() => navigate('/content')}><ArrowLeft className="size-4" />Back to Content</Button></Card>

  const { content, sourceIdea, sourceReferences } = detail
  const client = catalog.clients.find((item) => item.id === content.client_id)
  const category = catalog.categories.find((item) => item.id === content.category_id)
  const campaign = catalog.campaigns.find((item) => item.id === content.campaign_id)

  return (
    <div className="page-enter space-y-6">
      <Link to="/content" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-coral"><ArrowLeft className="size-4" />Back to Content list</Link>
      <header className="relative overflow-hidden rounded-xl border border-white/10 bg-ink p-6 text-paper shadow-xl sm:p-8">
        <div className="absolute -right-10 -top-16 size-48 rounded-full border-[28px] border-coral/20" aria-hidden="true" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold tracking-wider text-coral-light">{content.content_code}</span><StatusBadge tone={content.record_status === 'archived' ? 'neutral' : 'info'}>{content.record_status === 'archived' ? 'Archived' : label(content.current_status)}</StatusBadge><StatusBadge tone={content.priority === 'urgent' ? 'critical' : content.priority === 'high' ? 'warning' : 'neutral'}>{content.priority}</StatusBadge></div><h2 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight sm:text-5xl">{content.title}</h2>{content.working_title && content.working_title !== content.title ? <p className="mt-3 text-sm text-white/60">Working title: {content.working_title}</p> : null}</div>
          <div className="flex flex-wrap gap-2">{content.record_status === 'active' && canManageContent ? <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" />Edit metadata</Button> : null}{content.record_status === 'active' && (isSuperAdmin || isManager) ? <Button variant="ghost" className="text-white/65 hover:bg-white/10 hover:text-white" disabled={busy} onClick={() => void archive()}><Archive className="size-4" />Archive</Button> : null}</div>
        </div>
      </header>

      {error ? <div className="rounded-md border border-coral/30 bg-coral/8 p-3 text-sm text-coral-dark">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2"><FileText className="size-4 text-coral" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Overview</p></div>
            <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {[['Client', client?.name ?? 'Unavailable'], ['Category', category?.name ?? 'Uncategorised'], ['Campaign', campaign?.name ?? 'No campaign'], ['Owner', content.current_owner_name ?? 'Unassigned'], ['Record source', sourceIdea ? 'Converted Idea' : 'Direct creation'], ['Created', new Date(content.created_at).toLocaleString('en-MY')]].map(([term, value]) => <div key={term}><dt className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-ink-faint">{term}</dt><dd className="mt-1.5 text-sm font-semibold">{value}</dd></div>)}
            </dl>
            <div className="mt-6 border-t border-line pt-5"><p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-ink-faint">Objective</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink-soft">{content.objective || 'No objective recorded.'}</p></div>
            {content.tags.length ? <div className="mt-5 flex flex-wrap gap-2"><Tag className="mt-1 size-4 text-ink-faint" />{content.tags.map((tag) => <StatusBadge key={tag}>{tag}</StatusBadge>)}</div> : null}
          </Card>

          <Card>
            <div className="flex items-center gap-2"><Lightbulb className="size-4 text-gold" /><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Provenance</p></div>
            {sourceIdea ? <div className="mt-5 space-y-5"><div className="rounded-lg border border-gold/25 bg-gold/5 p-4"><p className="text-xs font-bold uppercase tracking-wider text-gold-dark">Source Idea</p><h3 className="mt-2 font-display text-2xl font-semibold">{sourceIdea.title}</h3><p className="mt-2 text-sm leading-6 text-ink-muted">{sourceIdea.our_angle || sourceIdea.original_topic || 'Source Idea retained without deleting its original record.'}</p><Link to="/ideas" className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-coral hover:underline">Open Idea Bank <ExternalLink className="size-3.5" /></Link></div><div><div className="flex items-center gap-2"><BookOpen className="size-4 text-blue" /><h3 className="text-sm font-bold">Source References · {sourceReferences.length}</h3></div>{sourceReferences.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{sourceReferences.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line p-4 transition hover:border-blue/40 hover:bg-blue/[0.025]"><p className="font-bold">{reference.title}</p><p className="mt-1 truncate text-xs text-blue">{reference.url}</p></a>)}</div> : <p className="mt-2 text-sm text-ink-muted">The source Idea has no linked Reference.</p>}</div><div className="flex items-center gap-2 text-sm text-ink-muted"><UserRound className="size-4" />{content.contributors.length} preserved Content contributor record{content.contributors.length === 1 ? '' : 's'}</div></div> : content.source_idea_id ? <div className="mt-5 rounded-lg border border-dashed border-gold/35 bg-gold/5 p-6"><p className="font-bold">Source Idea retained</p><p className="mt-2 text-sm leading-6 text-ink-muted">The provenance link remains intact. Idea and Reference details require an authorized planning role.</p></div> : <div className="mt-5 rounded-lg border border-dashed border-line-strong p-6"><p className="font-bold">Direct-created Content</p><p className="mt-2 text-sm leading-6 text-ink-muted">{content.direct_creation_reason}</p></div>}
          </Card>

          <ProductionWorkspace key={content.id + '-' + content.updated_at} workspaceId={workspace!.id} content={content} bundle={workflow} currentUserId={session.user.id} workspaceRoles={workspace!.roles} canManage={Boolean(canManageContent)} onChanged={refresh} />

          <Card>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Notes & visibility</p>
            <div className="mt-5 grid gap-4"><section className="rounded-lg border border-line p-4"><h3 className="text-sm font-bold">Internal Notes</h3><p className="mt-1 text-xs text-ink-muted">Internal operational context · never Client-visible</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{content.internal_notes || 'No internal notes.'}</p></section>{(isSuperAdmin || isManager) ? <section className="rounded-lg border border-gold/25 bg-gold/5 p-4"><div className="flex items-center gap-2"><LockKeyhole className="size-4 text-gold" /><h3 className="text-sm font-bold">Private Management Notes</h3></div><p className="mt-1 text-xs text-ink-muted">Restricted management context</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{content.private_management_notes || 'No private management notes.'}</p></section> : null}<section className="rounded-lg border border-blue/25 bg-blue/[0.035] p-4"><h3 className="text-sm font-bold">Client-visible Notes</h3><p className="mt-1 text-xs text-blue">Explicitly shareable later; Client access is disabled in this phase.</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{content.client_visible_notes || 'No client-visible notes.'}</p></section></div>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
          <Card tone="quiet"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">Current context</p><dl className="mt-4 space-y-4"><div><dt className="text-xs text-ink-muted">Production state</dt><dd className="mt-1 font-bold">{label(content.current_status)}</dd></div><div><dt className="text-xs text-ink-muted">Workflow integrity</dt><dd className="mt-1 text-sm font-semibold">Event-backed · no status dropdown</dd></div><div><dt className="text-xs text-ink-muted">Last updated</dt><dd className="mt-1 text-sm font-semibold">{new Date(content.updated_at).toLocaleString('en-MY')}</dd></div></dl><p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-ink-muted">First Cut, Review, Approval, Publication, and Analytics remain deferred to later phases.</p></Card>
          {content.record_status === 'archived' ? <Card className="border-coral/25 bg-coral/[0.035]"><p className="text-xs font-bold uppercase tracking-wider text-coral-dark">Archived record</p><p className="mt-2 text-sm leading-6">{content.archive_reason}</p></Card> : null}
        </aside>
      </div>

      {editing && workspace && canManageContent ? <ContentFormDrawer workspaceId={workspace.id} catalog={catalog} content={content} canManagePrivateNotes={isSuperAdmin || isManager} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await refresh() }} /> : null}
    </div>
  )
}
