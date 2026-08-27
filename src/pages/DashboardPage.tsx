import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, CheckCircle2, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, StatusBadge } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { loadContents } from '../features/content/content-api'
import { enumLabel, formatWorkspaceDate } from '../features/i18n/labels'
import { useI18n } from '../features/i18n/i18n'
import { dashboardRangeBounds, deriveDashboard, derivePublicationAttention, loadCalendarEvents } from '../features/pilot/pilot-api'
import type { CalendarEvent, DashboardRange } from '../features/pilot/pilot-api'
import { loadAnalyticsQueue } from '../features/publishing/publishing-api'
import { loadBrandAccounts } from '../features/brand/brand-api'
import type { BrandSocialAccount } from '../features/brand/brand-api'

const ranges: DashboardRange[] = ['today', 'next7', 'nextWeek', 'next14', 'month']
const rangeText = {
  'zh-CN': { today: '今日', next7: '接下来 7 天', nextWeek: '下周', next14: '14 天', month: '本月' },
  en: { today: 'Today', next7: 'Next 7 days', nextWeek: 'Next week', next14: '14 days', month: 'This month' },
}

export function DashboardPage() {
  const { workspace } = useAuth(); const { language } = useI18n(); const navigate = useNavigate()
  const [range, setRange] = useState<DashboardRange>('next7')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [contents, setContents] = useState<Array<{ id: string; title: string; client_id: string; current_status: string }>>([])
  const [publicationAttention, setPublicationAttention] = useState<Array<{ contentId: string; type: string; title: string }>>([])
  const [brandAccounts, setBrandAccounts] = useState<BrandSocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    const bounds = dashboardRangeBounds(range)
    const [eventRows, contentRows, queue, brand] = await Promise.all([loadCalendarEvents(workspace.id, bounds.from, bounds.to), loadContents(workspace.id), loadAnalyticsQueue(workspace.id), loadBrandAccounts(workspace.id)])
    setEvents(eventRows); setContents(contentRows); setBrandAccounts(brand.accounts.filter((account) => account.is_active))
    setPublicationAttention(derivePublicationAttention(queue.publications, queue.snapshots).map((item) => ({ ...item, title: queue.contents.find((content) => content.id === item.contentId)?.title ?? 'Content' })))
    setLoading(false)
  }, [range, workspace])
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])
  const data = useMemo(() => deriveDashboard(events, contents, new Date(), range), [contents, events, range])
  const open = (item: CalendarEvent) => navigate(item.entity_type === 'idea' ? `/ideas?idea=${item.entity_id}` : `/content/${item.entity_id}`)
  const zh = language === 'zh-CN'
  return <div className="page-enter space-y-5">
    <header className="flex flex-col gap-4 border-b border-line pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-coral">{zh ? '每日执行' : 'Daily execution'}</p><h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{zh ? '接下来要推进什么？' : 'What needs to move next?'}</h2><p className="mt-1 text-sm text-ink-muted">{zh ? '计划、拍摄、审核与发布集中在同一行动队列。' : 'Plan, shoot, review, and publish in one action queue.'}</p></div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-paper p-1">{ranges.map((value) => <button key={value} type="button" onClick={() => setRange(value)} className={`rounded-md px-3 py-2 text-xs font-bold ${range === value ? 'bg-ink text-white' : 'text-ink-muted hover:bg-canvas-raised'}`}>{rangeText[language][value]}</button>)}</div>
    </header>
    {loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-7 animate-spin text-coral" /></div> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,.55fr)]">
      <Card className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-line px-5 py-3"><div><h3 className="font-bold">{rangeText[language][range]}</h3><p className="mt-0.5 text-xs text-ink-muted">{data.bounds.from} — {data.bounds.to}</p></div><span className="text-xs font-bold text-ink-muted">{data.rangeItems.length}</span></div>{data.rangeItems.length ? <div className="divide-y divide-line">{data.rangeItems.map((item) => <button key={item.event_key} onClick={() => open(item)} className="grid w-full grid-cols-[6rem_5rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left transition hover:bg-canvas-raised"><span className="font-mono text-xs font-bold text-ink-muted">{formatWorkspaceDate(item.event_at, language, { month: 'short', day: '2-digit', year: undefined })}</span><StatusBadge tone={item.event_type === 'PUBLISH' ? 'success' : item.event_type === 'SHOOT' ? 'warning' : item.event_type === 'REVIEW' ? 'critical' : 'info'}>{enumLabel(item.event_type, language)}</StatusBadge><span className="truncate font-bold">{item.title}</span><ArrowUpRight className="size-4 text-ink-faint" /></button>)}</div> : <div className="p-8 text-center text-sm text-ink-muted"><CheckCircle2 className="mx-auto mb-3 size-7 text-green" />{zh ? '这个时间范围暂时没有安排。' : 'Nothing is scheduled in this range.'}</div>}</Card>
      <div className="space-y-5"><Card><div className="flex items-center gap-2"><AlertTriangle className="size-5 text-gold-dark" /><h3 className="font-bold">{zh ? '需要处理' : 'Needs attention'}</h3></div><div className="mt-3 divide-y divide-line">{data.attention.map((item) => <button key={item.id} onClick={() => navigate(`/content/${item.id}`)} className="flex w-full items-center justify-between gap-3 py-3 text-left"><span className="line-clamp-2 text-sm font-bold">{item.title}</span><StatusBadge tone="warning">{enumLabel(item.current_status, language)}</StatusBadge></button>)}{publicationAttention.map((item, index) => <button key={`${item.contentId}-${item.type}-${index}`} onClick={() => navigate(`/content/${item.contentId}`)} className="flex w-full items-center justify-between gap-3 py-3 text-left"><span className="line-clamp-2 text-sm font-bold">{item.title}</span><StatusBadge tone="critical">{zh ? '发布 / 数据' : item.type}</StatusBadge></button>)}{!data.attention.length && !publicationAttention.length ? <p className="py-5 text-sm text-ink-muted">{zh ? '目前没有待审核、修改或发布异常。' : 'No review, revision, or publication exceptions.'}</p> : null}</div></Card>
      <Card tone="dark"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-coral-light">{zh ? '制作概况' : 'Production overview'}</p><div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(data.overview).map(([status, count]) => <button key={status} onClick={() => navigate(`/content?status=${status}`)} className="rounded-lg bg-white/7 p-3 text-left hover:bg-white/12"><p className="text-xl font-bold">{count}</p><p className="mt-1 text-xs text-white/60">{enumLabel(status, language)}</p></button>)}</div></Card>
      <Card><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-coral">{zh ? '内部品牌' : 'Internal brand'}</p><h3 className="mt-1 font-bold">{zh ? 'LKSoft 账号概况' : 'LKSoft Account Overview'}</h3></div><button onClick={() => navigate('/brand/lksoft')} className="inline-flex items-center gap-1 text-xs font-bold text-blue">{zh ? '查看全部账号' : 'View all accounts'}<ArrowUpRight className="size-3.5" /></button></div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">{brandAccounts.slice(0, 6).map((account) => <div key={account.id} className="flex items-center justify-between gap-2 border-b border-line py-2 text-sm"><span className="truncate font-medium">{account.account_name}</span><span className="font-mono font-bold">{account.followers == null ? '—' : new Intl.NumberFormat('en-MY', { notation: account.followers >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(account.followers)}</span></div>)}</div>{!brandAccounts.length ? <p className="mt-3 text-sm text-ink-muted">{zh ? '尚未记录真实账号资料。' : 'No real account records yet.'}</p> : null}</Card></div>
    </div>}
  </div>
}