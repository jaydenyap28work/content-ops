import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, LoaderCircle, Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, FormField, Input, Select, Textarea } from '../components/ui'
import { loadClients } from '../features/admin/admin-api'
import type { ClientRecord } from '../features/admin/admin-api'
import { useAuth } from '../features/auth/auth-context'
import { useI18n } from '../features/i18n/i18n'
import { loadCalendarEvents, saveMarketingCalendarEvent } from '../features/pilot/pilot-api'
import type { CalendarEvent, CalendarEventType, MarketingCalendarInput } from '../features/pilot/pilot-api'

const eventDay = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const eventMeta: Record<CalendarEventType, { icon: string; zh: string; en: string; tone: string }> = {
  SHOOT: { icon: '🎥', zh: '拍摄', en: 'Shoot', tone: 'border-coral/30 bg-coral/8' },
  PUBLISH_TARGET: { icon: '📤', zh: '目标发布', en: 'Target publish', tone: 'border-blue/30 bg-blue/8' },
  REVIEW: { icon: '👀', zh: '审核', en: 'Review', tone: 'border-gold/40 bg-gold/10' },
  PUBLISH: { icon: '✓', zh: '已发布', en: 'Published', tone: 'border-green/30 bg-green/8' },
  MEETING: { icon: '🤝', zh: '会议', en: 'Meeting', tone: 'border-violet-300 bg-violet-50' },
  WORKSHOP_EVENT: { icon: '🎤', zh: 'Workshop / 活动', en: 'Workshop / Event', tone: 'border-orange-300 bg-orange-50' },
  OFFSITE: { icon: '📍', zh: '外出', en: 'Offsite', tone: 'border-cyan-300 bg-cyan-50' },
  CUSTOM: { icon: '📌', zh: 'Marketing 行程', en: 'Marketing schedule', tone: 'border-line bg-canvas-raised' },
}
const blank = { type: 'meeting', title: '', clientId: '', allDay: false, start: '', end: '', location: '', notes: '' }

export function CalendarPage() {
  const { workspace } = useAuth()
  const { language } = useI18n()
  const zh = language === 'zh-CN'
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openForm, setOpenForm] = useState(false)
  const [form, setForm] = useState(blank)
  const [error, setError] = useState<string | null>(null)
  const from = iso(new Date(month.getFullYear(), month.getMonth(), 1))
  const to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0))

  const refresh = useCallback(async () => {
    if (!workspace) return
    setLoading(true); setError(null)
    try {
      const [nextEvents, nextClients] = await Promise.all([loadCalendarEvents(workspace.id, from, to), loadClients(workspace.id)])
      setEvents(nextEvents); setClients(nextClients.filter((item) => item.status === 'active'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load calendar') } finally { setLoading(false) }
  }, [from, to, workspace])
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])

  const days = useMemo(() => Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => iso(new Date(month.getFullYear(), month.getMonth(), index + 1))), [month])
  const label = new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-MY', { month: 'long', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(month)
  const open = (event: CalendarEvent) => {
    if (event.entity_type === 'calendar_event') return
    navigate(event.entity_type === 'idea' ? `/ideas?idea=${event.entity_id}` : `/content/${event.entity_id}`)
  }
  const eventLabel = (event: CalendarEvent) => {
    const meta = eventMeta[event.event_type]
    return `${meta.icon} ${zh ? meta.zh : meta.en}`
  }
  const localTime = (value: string) => new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit' }).format(new Date(value))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!workspace || !form.start) return
    setSaving(true); setError(null)
    try {
      const start = form.allDay ? `${form.start}T12:00:00+08:00` : form.start
      const end = form.end ? (form.allDay ? `${form.end}T23:59:00+08:00` : form.end) : ''
      const value: MarketingCalendarInput = { workspaceId: workspace.id, clientId: form.clientId, type: form.type as MarketingCalendarInput['type'], title: form.title, startsAt: start, endsAt: end, allDay: form.allDay, location: form.location, notes: form.notes }
      await saveMarketingCalendarEvent(value)
      setOpenForm(false); setForm(blank); await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save event') } finally { setSaving(false) }
  }

  return <div className="page-enter space-y-5">
    <header className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-coral">{zh ? '拍摄 · 发布 · 审核 · Marketing 行程' : 'Shoot · Publish · Review · Marketing schedule'}</p><h2 className="mt-2 font-display text-4xl font-semibold">{zh ? '日历' : 'Calendar'}</h2><p className="mt-2 text-sm text-ink-muted">{zh ? '内容日期由 ContentOS 自动产生；会议、活动、外出与自定义行程可手动加入。' : 'Content dates are generated by ContentOS. Add meetings, events, offsite work, and custom Marketing schedules manually.'}</p></div><div className="flex flex-wrap items-center gap-2"><Button onClick={() => setOpenForm(true)}><Plus className="size-4" />{zh ? '新增行程' : 'New event'}</Button><Button size="icon" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ArrowLeft className="size-4" /></Button><span className="min-w-32 text-center font-bold">{label}</span><Button size="icon" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ArrowRight className="size-4" /></Button></div></header>
    {error ? <div role="alert" className="rounded-lg border border-coral/30 bg-coral/8 px-4 py-3 text-sm text-coral-dark">{error}</div> : null}
    <Card tone="quiet" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm"><b>{zh ? 'Google Calendar 方向：' : 'Google Calendar direction: '}</b>{zh ? 'ContentOS 是 Source of Truth；第一阶段只做 ContentOS → Google Calendar 单向同步。' : 'ContentOS remains the source of truth; phase one will be one-way ContentOS → Google Calendar.'}</p><span className="text-xs font-bold text-ink-faint">{zh ? '本轮不连接 API' : 'No API connection in this round'}</span></Card>
    {loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-7 animate-spin text-coral" /></div> : <>
      <Card data-testid="calendar-month" className="hidden overflow-hidden p-0 lg:block"><div className="grid grid-cols-7 border-b border-line bg-canvas-raised text-center text-xs font-extrabold uppercase text-ink-faint">{(zh ? ['日', '一', '二', '三', '四', '五', '六'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map((day) => <div key={day} className="p-3">{day}</div>)}</div><div className="grid grid-cols-7">{Array.from({ length: new Date(month.getFullYear(), month.getMonth(), 1).getDay() }).map((_, index) => <div key={`blank-${index}`} className="min-h-36 border-b border-r border-line bg-canvas-raised/35" />)}{days.map((day) => <div key={day} className="min-h-36 border-b border-r border-line p-2"><p className="text-xs font-bold text-ink-faint">{Number(day.slice(-2))}</p><div className="mt-2 space-y-1">{events.filter((item) => eventDay(item.event_at) === day).map((item) => <button key={item.event_key} onClick={() => open(item)} className={`w-full rounded border p-1.5 text-left text-[.7rem] hover:border-coral ${eventMeta[item.event_type].tone}`}><span className="font-extrabold">{eventLabel(item)}</span><span className="mt-1 block line-clamp-2 font-bold">{item.title}</span>{!item.event_at.endsWith('00:00:00+00') && !item.event_at.endsWith('00:00:00') ? <span className="mt-1 block text-ink-muted">{localTime(item.event_at)}</span> : null}</button>)}</div></div>)}</div></Card>
      <Card data-testid="calendar-agenda" className="p-0 lg:hidden">{events.length ? <div className="divide-y divide-line">{events.map((item) => <button key={item.event_key} onClick={() => open(item)} className="grid w-full grid-cols-[5rem_1fr_auto] gap-3 p-4 text-left"><div><p className="font-mono text-sm font-bold text-coral">{eventDay(item.event_at).slice(5, 10)}</p><p className="mt-1 text-xs text-ink-faint">{eventLabel(item)}</p></div><div><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-ink-muted">{item.client_name || (zh ? 'Workspace 行程' : 'Workspace event')} · {localTime(item.event_at)}</p></div>{item.entity_type !== 'calendar_event' ? <ArrowRight className="size-4 text-ink-faint" /> : null}</button>)}</div> : <div className="p-8 text-center"><CalendarDays className="mx-auto size-8 text-ink-faint" /><p className="mt-3 font-bold">{zh ? '这个月还没有排期' : 'Nothing scheduled this month'}</p><p className="mt-2 text-sm text-ink-muted">{zh ? '内容日期会自动出现，也可以新增 Marketing 行程。' : 'Content dates appear automatically; Marketing events can be added manually.'}</p></div>}</Card>
    </>}
    {openForm ? <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenForm(false) }}><form onSubmit={submit} className="h-full w-full max-w-xl overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-coral">{zh ? '手动 Marketing 行程' : 'Manual Marketing event'}</p><h3 className="mt-2 text-3xl font-bold">{zh ? '新增行程' : 'New event'}</h3></div><Button size="icon" variant="ghost" onClick={() => setOpenForm(false)}><X className="size-5" /></Button></div><div className="mt-7 space-y-5"><FormField label={zh ? '类型' : 'Type'} required><Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="meeting">🤝 {zh ? '会议' : 'Meeting'}</option><option value="workshop_event">🎤 Workshop / Event</option><option value="offsite">📍 {zh ? '外出' : 'Offsite'}</option><option value="custom">📌 {zh ? '自定义 Marketing 行程' : 'Custom Marketing schedule'}</option></Select></FormField><FormField label={zh ? '行程名称' : 'Title'} required><Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></FormField><FormField label={zh ? '相关品牌 / 客户（可选）' : 'Brand / Client (optional)'}><Select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">{zh ? 'Workspace 行程' : 'Workspace event'}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></FormField><label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={form.allDay} onChange={(event) => setForm({ ...form, allDay: event.target.checked, start: '', end: '' })} className="size-4 accent-coral" />{zh ? '全天' : 'All day'}</label><div className="grid gap-4 sm:grid-cols-2"><FormField label={zh ? '开始' : 'Start'} required><Input required type={form.allDay ? 'date' : 'datetime-local'} value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></FormField><FormField label={zh ? '结束（可选）' : 'End (optional)'}><Input type={form.allDay ? 'date' : 'datetime-local'} value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></FormField></div><FormField label={zh ? '地点' : 'Location'}><Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></FormField><FormField label={zh ? '备注' : 'Notes'}><Textarea rows={5} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></FormField><p className="rounded-md bg-canvas-raised p-3 text-xs leading-5 text-ink-muted">{zh ? '拍摄、目标发布、审核与实际发布由 ContentOS 自动产生，请不要在这里重复建立。' : 'Shoot, target publish, review, and actual publish events are generated by ContentOS. Do not duplicate them here.'}</p><Button type="submit" disabled={saving || !form.start}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : null}{zh ? '保存行程' : 'Save event'}</Button></div></form></div> : null}
  </div>
}
