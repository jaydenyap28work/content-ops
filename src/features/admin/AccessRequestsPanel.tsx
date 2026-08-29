import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, LoaderCircle, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react'
import { Button, Card, FormField, Select, StatusBadge } from '../../components/ui'
import { useI18n } from '../i18n/i18n'
import { loadAccessRequests, reviewAccessRequest, type AccessRequestRecord, type ProductionTeamMemberRecord } from './admin-api'

const assignableRoles = [
  ['idea_contributor', '创意投稿者', 'Idea Contributor'],
  ['publisher_marketing', 'Marketing', 'Publisher / Marketing'],
  ['internal_manager', '审核人 / 老板', 'Approver / Boss'],
  ['super_admin', '超级管理员', 'Super Admin'],
] as const

export function AccessRequestsPanel({ workspaceId, members, onChanged }: { workspaceId: string; members: ProductionTeamMemberRecord[]; onChanged: () => Promise<void> }) {
  const { language } = useI18n(); const zh = language === 'zh-CN'
  const [requests, setRequests] = useState<AccessRequestRecord[]>([]); const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null); const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null); const [roleCode, setRoleCode] = useState('idea_contributor'); const [memberId, setMemberId] = useState('')
  const refresh = useCallback(async () => { setLoading(true); try { setRequests(await loadAccessRequests(workspaceId)); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load Access Requests') } finally { setLoading(false) } }, [workspaceId])
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])
  const pending = useMemo(() => requests.filter((request) => request.status === 'pending'), [requests]); const selected = requests.find((request) => request.id === selectedId) ?? null
  async function decide(decision: 'approved' | 'rejected') {
    if (!selected) return
    if (decision === 'approved' && roleCode === 'super_admin' && !window.confirm(zh ? '此用户将获得 ContentOS 全部管理权限。确认授予超级管理员权限？' : 'This user will receive full ContentOS administration access. Grant Super Admin?')) return
    setBusyId(selected.id); setError('')
    try {
      await reviewAccessRequest({ requestId: selected.id, decision, roleCode: decision === 'approved' ? roleCode : undefined, teamMemberId: decision === 'approved' && memberId ? memberId : undefined, createTeamMember: decision === 'approved' && !memberId })
      setSelectedId(null); setMemberId(''); await Promise.all([refresh(), onChanged()])
    } catch (cause) {
      console.error('[ContentOS] Access Request review failed', cause)
      const raw = cause instanceof Error ? cause.message : String(cause)
      setError(zh && raw.includes('another Auth identity') ? '此 Email 已属于另一个登录身份，请先安全绑定 Google 身份后再批准' : raw)
    } finally { setBusyId(null) }
  }
  return <Card className="overflow-hidden p-0"><div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-coral">{zh ? '访问审批' : 'Access approval'}</p><h2 className="mt-1 text-xl font-bold">{zh ? `待审批 ${pending.length}` : `${pending.length} pending`}</h2></div><Button size="icon" variant="ghost" onClick={() => void refresh()} aria-label={zh ? '刷新申请' : 'Refresh requests'}><RefreshCw className="size-4" /></Button></div>
    {error ? <p role="alert" className="m-4 rounded-lg border border-coral/30 bg-coral/8 p-3 text-sm text-coral-dark">{error}</p> : null}
    {loading ? <div className="grid min-h-28 place-items-center"><LoaderCircle className="size-5 animate-spin text-coral" /></div> : pending.length ? <div className="divide-y divide-line">{pending.map((request) => <button key={request.id} type="button" onClick={() => { setSelectedId(request.id); setMemberId('') }} className="grid w-full gap-2 px-5 py-4 text-left transition hover:bg-canvas-raised sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><p className="font-bold">{request.display_name || request.email.split('@')[0]}</p><p className="mt-1 text-sm text-ink-muted">{request.email}</p></div><div className="sm:text-right"><StatusBadge tone="warning">{zh ? '等待审批' : 'Pending'}</StatusBadge><p className="mt-1 text-xs text-ink-faint">{new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(request.requested_at))}</p></div></button>)}</div> : <div className="px-5 py-8 text-center"><ShieldCheck className="mx-auto size-7 text-green" /><p className="mt-2 text-sm font-semibold text-ink-muted">{zh ? '目前没有待审批申请' : 'No pending requests'}</p></div>}
    {selected ? <div className="border-t border-line bg-canvas-raised p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-bold">{selected.display_name || selected.email}</h3><p className="mt-1 text-sm text-ink-muted">{selected.email}</p></div><button onClick={() => setSelectedId(null)} aria-label={zh ? '关闭' : 'Close'}><X className="size-5" /></button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><FormField label={zh ? '分配角色' : 'Assign role'}><Select value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>{assignableRoles.map(([code, cn, en]) => <option key={code} value={code}>{zh ? cn : en}</option>)}</Select></FormField><FormField label={zh ? '绑定团队成员' : 'Link Team Member'}><Select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">{zh ? '建立新的团队成员资料' : 'Create a new Team Member'}</option>{members.filter((member) => member.status === 'active' && (!member.email || member.email.toLowerCase() === selected.email.toLowerCase()) && (!member.auth_user_id || member.auth_user_id === selected.auth_user_id)).map((member) => <option key={member.id} value={member.id}>{member.name}{member.email ? ` · ${member.email}` : ''}</option>)}</Select></FormField></div>
      {roleCode === 'super_admin' ? <p className="mt-4 rounded-lg border border-coral/35 bg-coral/8 p-3 text-sm font-bold text-coral-dark">{zh ? '警告：此用户将获得 ContentOS 全部管理权限，批准时需要再次确认' : 'Warning: this user will receive full ContentOS administration access. A second confirmation is required.'}</p> : null}
      <p className="mt-3 text-xs leading-5 text-ink-muted">{zh ? '批准会在同一笔数据库事务内完成成员绑定、工作区权限、角色分配与审计记录' : 'Approval links the member, Workspace membership, role, and audit record in one database transaction.'}</p><div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busyId === selected.id} onClick={() => void decide('rejected')}><X className="size-4" />{zh ? '不批准' : 'Reject'}</Button><Button disabled={busyId === selected.id} onClick={() => void decide('approved')}>{busyId === selected.id ? <LoaderCircle className="size-4 animate-spin" /> : memberId ? <Check className="size-4" /> : <UserPlus className="size-4" />}{zh ? '批准并分配权限' : 'Approve and assign access'}</Button></div></div> : null}
  </Card>
}
