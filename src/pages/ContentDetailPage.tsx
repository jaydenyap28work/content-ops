import { useCallback, useEffect, useState } from 'react'
import { Archive, ArrowLeft, Clapperboard, ExternalLink, FileText, LoaderCircle, MoreHorizontal, Pencil, Video } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, StatusBadge } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { ContentFormDrawer } from '../features/content/ContentFormDrawer'
import { ProductionWorkspace } from '../features/content/ProductionWorkspace'
import { ProductionTeamPanel } from '../features/content/ProductionTeamPanel'
import { ReviewWorkspace } from '../features/content/ReviewWorkspace'
import { ScriptWorkspace } from '../features/content/ScriptWorkspace'
import { TimelineWorkspace } from '../features/content/TimelineWorkspace'
import { archiveContent, loadContentCatalog, loadContentDetail } from '../features/content/content-api'
import type { ContentCatalog, ContentDetail } from '../features/content/content-api'
import { productionTracker } from '../features/content/production-model'
import { loadReviewBundle } from '../features/content/review-api'
import type { ReviewBundle } from '../features/content/review-api'
import { loadWorkflowBundle } from '../features/content/workflow-api'
import type { WorkflowBundle } from '../features/content/workflow-api'
import { enumLabel, formatWorkspaceDate } from '../features/i18n/labels'
import { useI18n } from '../features/i18n/i18n'
import { BossMode } from '../features/pilot/BossMode'
import { ShootingBrief } from '../features/pilot/ShootingBrief'
import { ShootingSchedulePanel } from '../features/pilot/ShootingSchedulePanel'
import { PublishingWorkspace } from '../features/publishing/PublishingWorkspace'
import { loadPublishingBundle } from '../features/publishing/publishing-api'
import type { PublishingBundle, PublicationRecord } from '../features/publishing/publishing-api'

const emptyCatalog: ContentCatalog = { clients: [], categories: [], campaigns: [] }
const tabs = ['shooting', 'progress', 'publishing'] as const
type Tab = (typeof tabs)[number]

const dateTime = (value: string | null, language: 'zh-CN' | 'en') => value
  ? new Intl.DateTimeFormat(language === 'zh-CN' ? 'zh-CN' : 'en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—'

function ReviewSummary({ review, workflow, language }: { review: ReviewBundle; workflow: WorkflowBundle; language: 'zh-CN' | 'en' }) {
  const zh = language === 'zh-CN'
  const reviewer = workflow.contributors.find((item) => item.status === 'active' && item.contribution_role_code === 'reviewer')?.display_name ?? '—'
  const latest = review.media[0]
  const openRevisions = review.revisions.filter((item) => item.status === 'open')
  const pending = review.requirements.find((item) => item.is_required && !['approved', 'waived'].includes(item.status))
  return <Card>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-coral">{zh ? '审核交接' : 'Review handoff'}</p><h3 className="mt-2 text-xl font-bold">{pending ? (zh ? '待审核' : 'Awaiting review') : (zh ? '审核状态清楚可见' : 'Review status at a glance')}</h3></div>
      <StatusBadge tone={openRevisions.length ? 'warning' : pending ? 'info' : 'success'}>{openRevisions.length ? (zh ? '需要修改' : 'Revision required') : pending ? enumLabel(pending.status, language) : (zh ? '无待处理审核' : 'No pending review')}</StatusBadge>
    </div>
    <dl className="mt-5 grid gap-4 sm:grid-cols-3">
      <div><dt className="text-xs text-ink-muted">{zh ? '审核人' : 'Reviewer'}</dt><dd className="mt-1 font-bold">{reviewer}</dd></div>
      <div><dt className="text-xs text-ink-muted">{zh ? '初剪 / 最新版本' : 'First cut / latest'}</dt><dd className="mt-1">{latest?.external_url ? <a className="inline-flex items-center gap-1 font-bold text-blue hover:underline" href={latest.external_url} target="_blank" rel="noreferrer">{zh ? '打开 Drive' : 'Open Drive'}<ExternalLink className="size-3.5" /></a> : <b>—</b>}</dd></div>
      <div><dt className="text-xs text-ink-muted">{zh ? '修改要求' : 'Revision requests'}</dt><dd className="mt-1 font-bold">{openRevisions.length} {zh ? '项' : openRevisions.length === 1 ? 'item' : 'items'}</dd></div>
    </dl>
  </Card>
}

function PublicationSummary({ publications, bundle, language }: { publications: PublicationRecord[]; bundle: PublishingBundle; language: 'zh-CN' | 'en' }) {
  const zh = language === 'zh-CN'
  const platform = (id: string) => bundle.platforms.find((item) => item.id === id)?.name ?? (zh ? '平台' : 'Platform')
  const statusText: Record<string, [string, string]> = {
    draft: ['未安排', 'Not scheduled'], scheduled: ['待发布', 'Scheduled'], published: ['已发布', 'Published'],
    failed: ['发布失败', 'Failed'], cancelled: ['已取消', 'Cancelled'],
  }
  return <Card className="overflow-hidden p-0">
    <div className="border-b border-line p-5"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-coral">{zh ? '平台发布计划' : 'Channel publication plan'}</p><p className="mt-2 text-sm text-ink-muted">{zh ? '这里只看排期、状态与贴文链接；完整数据分析请到左侧「数据分析」。' : 'Keep schedule, status, and post links here. Full metrics stay in Analytics.'}</p></div>
    {publications.length ? <div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="bg-canvas-raised text-xs text-ink-faint"><tr><th className="px-5 py-3">{zh ? '平台' : 'Platform'}</th><th>{zh ? '计划发布' : 'Plan'}</th><th>{zh ? '状态' : 'Status'}</th><th>{zh ? '链接' : 'Link'}</th></tr></thead><tbody>{publications.map((item) => <tr key={item.id} className="border-t border-line"><td className="px-5 py-4 font-bold">{platform(item.platform_id)}</td><td>{dateTime(item.scheduled_at, language)}</td><td><StatusBadge tone={item.status === 'published' ? 'success' : item.status === 'failed' ? 'critical' : item.status === 'scheduled' ? 'warning' : 'neutral'}>{statusText[item.status]?.[zh ? 0 : 1] ?? enumLabel(item.status, language)}</StatusBadge></td><td>{item.post_url ? <a className="inline-flex items-center gap-1 font-bold text-blue" href={item.post_url} target="_blank" rel="noreferrer">{zh ? '打开贴文' : 'Open post'}<ExternalLink className="size-3.5" /></a> : '—'}</td></tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-ink-muted">{zh ? '还没有平台发布计划。' : 'No channel publication plan yet.'}</div>}
  </Card>
}

export function ContentDetailPage() {
  const { contentId } = useParams()
  const { workspace, session } = useAuth()
  const navigate = useNavigate()
  const { language } = useI18n()
  const zh = language === 'zh-CN'
  const [detail, setDetail] = useState<ContentDetail | null>(null)
  const [workflow, setWorkflow] = useState<WorkflowBundle | null>(null)
  const [review, setReview] = useState<ReviewBundle | null>(null)
  const [publishing, setPublishing] = useState<PublishingBundle | null>(null)
  const [catalog, setCatalog] = useState<ContentCatalog>(emptyCatalog)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [boss, setBoss] = useState(false)
  const [tab, setTab] = useState<Tab>('shooting')

  const isSuper = workspace?.roles.includes('Super Admin') ?? false
  const isManager = workspace?.roles.includes('Internal Manager') ?? false
  const canManage = isSuper || isManager || workspace?.roles.includes('Strategist / Content Planner')
  const allowed = workspace?.roles.some((role) => !['Client Admin', 'Client Viewer'].includes(role)) ?? false

  const refresh = useCallback(async () => {
    if (!workspace || !contentId || !allowed) return
    setLoading(true); setError(null)
    try {
      const [nextDetail, nextCatalog, nextWorkflow, nextReview, nextPublishing] = await Promise.all([
        loadContentDetail(workspace.id, contentId), loadContentCatalog(workspace.id), loadWorkflowBundle(contentId),
        loadReviewBundle(contentId), loadPublishingBundle(contentId),
      ])
      setDetail(nextDetail); setCatalog(nextCatalog); setWorkflow(nextWorkflow); setReview(nextReview); setPublishing(nextPublishing)
      if (!nextDetail) setError(zh ? '找不到内容或无权访问。' : 'Content not found or outside your access.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load Content') } finally { setLoading(false) }
  }, [allowed, contentId, workspace, zh])

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])

  if (!allowed) return <Card className="mx-auto mt-12 max-w-xl text-center"><FileText className="mx-auto size-8 text-coral" /><h2 className="mt-4 text-2xl font-bold">{zh ? '需要内部制作权限' : 'Internal production access required'}</h2></Card>
  if (loading) return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-8 animate-spin text-coral" /></div>
  if (!workspace || !detail || !workflow || !review || !publishing || !session) return <Card className="mx-auto max-w-xl text-center"><p>{error}</p><Button className="mt-4" onClick={() => navigate('/content')}>{zh ? '返回制作中心' : 'Back to Production Center'}</Button></Card>

  const { content, sourceIdea, sourceReferences } = detail
  const tracker = productionTracker(content, language)
  const contributor = (code: string) => workflow.contributors.find((item) => item.status === 'active' && item.contribution_role_code === code)?.display_name ?? '—'
  const tabText: Record<Tab, string> = zh ? { shooting: '拍摄内容', progress: '制作进度', publishing: '发布' } : { shooting: 'Shooting Pack', progress: 'Production Progress', publishing: 'Publishing' }
  const actionTab: Tab = ['approved', 'ready_for_publishing', 'analytics_tracking', 'completed'].includes(content.current_status) ? 'publishing' : 'progress'

  async function handleArchive() {
    const reason = window.prompt(zh ? '请输入归档原因：' : 'Archive reason:')
    if (!reason?.trim()) return
    await archiveContent(content.id, reason.trim())
    navigate('/content')
  }

  return <div className="page-enter space-y-4">
    <Link to="/content" className="inline-flex items-center gap-2 text-sm font-bold text-ink-muted hover:text-coral"><ArrowLeft className="size-4" />{zh ? '返回制作中心' : 'Back to Production Center'}</Link>
    <header className="sticky top-0 z-20 rounded-xl border border-line bg-paper/95 px-5 py-4 shadow-sm backdrop-blur">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone="info">{enumLabel(content.current_status, language)}</StatusBadge></div><h1 className="mt-2 truncate text-2xl font-bold sm:text-3xl">{content.title}</h1><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted"><span>{zh ? '计划拍摄日期' : 'Planned Shoot Date'}: <b className="text-ink">{formatWorkspaceDate(content.planned_shoot_date ?? null, language)}</b></span>{content.planned_date ? <span>{zh ? '目标发布日期' : 'Target Publish Date'}: <b className="text-ink">{formatWorkspaceDate(content.planned_date, language)}</b></span> : null}<span>{zh ? '负责人' : 'Owner'}: <b className="text-ink">{content.current_owner_name ?? '—'}</b></span></div></div><div className="flex flex-wrap items-center gap-2"><Button variant="secondary" onClick={() => setBoss(true)} disabled={!sourceIdea}><Video className="size-4" />{zh ? '老板 / 拍摄模式' : 'Boss / Shooting Mode'}</Button>{canManage ? <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" />{zh ? '编辑资料' : 'Edit metadata'}</Button> : null}<Button onClick={() => setTab(actionTab)}><Clapperboard className="size-4" />{tracker.nextAction}</Button></div></div>
    </header>
    {error ? <div role="alert" className="rounded-lg bg-coral/8 p-3 text-sm text-coral-dark">{error}</div> : null}
    <nav className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-paper p-1">{tabs.map((value) => <button key={value} onClick={() => setTab(value)} className={`rounded-md px-3 py-2.5 text-sm font-bold ${tab === value ? 'bg-ink text-white' : 'text-ink-muted hover:bg-canvas-raised'}`}>{tabText[value]}</button>)}</nav>

    {tab === 'shooting' ? <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><Card className="min-w-0">{sourceIdea ? <ShootingBrief idea={sourceIdea} references={sourceReferences} team={workflow.contributors.filter(item => item.status === 'active').map(item => ({ roleCode: item.contribution_role_code, name: item.display_name }))} /> : <div className="py-12 text-center text-ink-muted">{zh ? '这个内容没有来源选题；可在更多资料建立脚本版本。' : 'This Content has no source Idea. Script versions remain under More.'}</div>}<details className="mt-6 border-t border-line pt-4"><summary className="cursor-pointer font-bold text-blue">{zh ? '更多 · 版本记录' : 'More · Version history'}</summary><div className="mt-4"><ScriptWorkspace contentId={content.id} scripts={review.scripts} canManage={Boolean(canManage)} onChanged={refresh} /></div></details></Card><aside className="space-y-4 xl:sticky xl:top-48 xl:self-start"><ProductionTeamPanel workspaceId={workspace.id} clientId={content.client_id} contentId={content.id} contributors={workflow.contributors} canManage={Boolean(canManage)} onChanged={refresh} />{sourceIdea ? <ShootingSchedulePanel ideaId={sourceIdea.id} clientId={content.client_id} plannedShootDate={content.planned_shoot_date ?? null} scheduledAt={workflow.production.shoot_scheduled_at} /> : null}</aside></div> : null}

    {tab === 'progress' ? <div className="space-y-5"><ProductionWorkspace key={`${content.id}-${content.updated_at}`} workspaceId={workspace.id} content={content} bundle={workflow} currentUserId={session.user.id} workspaceRoles={workspace.roles} canManage={Boolean(canManage)} onChanged={refresh} /><ReviewSummary review={review} workflow={workflow} language={language} /><details className="rounded-xl border border-line bg-paper"><summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-bold"><MoreHorizontal className="size-4 text-coral" />{zh ? '高级审核设置与完整修改记录' : 'Advanced review settings and full revision history'}</summary><div className="border-t border-line p-5"><ReviewWorkspace content={content} bundle={review} contributors={workflow.contributors} currentUserId={session.user.id} workspaceRoles={workspace.roles} canManage={Boolean(canManage)} onChanged={refresh} /></div></details></div> : null}

    {tab === 'publishing' ? <div className="space-y-5"><PublicationSummary publications={publishing.publications} bundle={publishing} language={language} /><details className="rounded-xl border border-line bg-paper"><summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-bold"><MoreHorizontal className="size-4 text-coral" />{zh ? '更多发布操作' : 'More publication actions'}</summary><div className="border-t border-line p-5"><PublishingWorkspace content={content} bundle={publishing} contributors={workflow.contributors} currentUserId={session.user.id} workspaceRoles={workspace.roles} canManage={Boolean(canManage)} onChanged={refresh} /></div></details></div> : null}

    <details className="rounded-xl border border-line bg-paper"><summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-bold"><MoreHorizontal className="size-4 text-coral" />{zh ? '更多资料' : 'More details'}</summary><div className="space-y-5 border-t border-line p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-ink-muted">{zh ? '内容编号' : 'Content Code'}</p><p className="mt-1 font-mono text-xs">{content.content_code}</p></div><div><p className="text-xs text-ink-muted">{zh ? '内部备注' : 'Internal notes'}</p><p className="mt-1 text-sm">{content.internal_notes || '—'}</p></div><div><p className="text-xs text-ink-muted">{zh ? '剪辑负责人' : 'Editor'}</p><p className="mt-1 font-bold">{contributor('editor')}</p></div><div><p className="text-xs text-ink-muted">{zh ? '发布负责人' : 'Publisher'}</p><p className="mt-1 font-bold">{contributor('publisher')}</p></div></div><TimelineWorkspace bundle={workflow} />{isSuper ? <Button variant="danger" onClick={() => void handleArchive()}><Archive className="size-4" />{zh ? '归档内容' : 'Archive Content'}</Button> : null}</div></details>
    {editing && canManage ? <ContentFormDrawer workspaceId={workspace.id} catalog={catalog} content={content} canManagePrivateNotes={isSuper || isManager} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await refresh() }} /> : null}
    {boss && sourceIdea ? <BossMode idea={sourceIdea} onClose={() => setBoss(false)} /> : null}
  </div>
}
