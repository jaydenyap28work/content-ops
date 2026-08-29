import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoaderCircle, LockKeyhole } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { useI18n } from '../i18n/i18n'
import { useAuth } from './auth-context'

const accessMessages = {
  profile_required: { zh: ['账号设置尚未完成', '此账号尚未获得工作区访问权限，请联系管理员'], en: ['Account setup is not complete', 'Your sign-in is valid, but no profile has been provisioned.'] },
  profile_deactivated: { zh: ['账号已停用', '此 ContentOS 账号目前已停用，请联系超级管理员'], en: ['Account deactivated', 'This ContentOS profile is deactivated.'] },
  workspace_required: { zh: ['尚无工作区权限', '此账号尚未获得工作区访问权限，请联系管理员'], en: ['No active workspace', 'This account has no active Workspace access.'] },
  membership_deactivated: { zh: ['工作区权限已停用', '你的 ContentOS 工作区权限目前未启用，请联系超级管理员'], en: ['Workspace access deactivated', 'Your ContentOS Workspace membership is inactive.'] },
  access_pending: { zh: ['访问申请已提交', '你的 Google 账号已完成验证。管理员批准并分配权限后即可进入 ContentOS'], en: ['Access request submitted', 'Your Google account is verified. You can enter ContentOS after an administrator approves and assigns access.'] },
  access_rejected: { zh: ['访问申请未获批准', '请联系管理员确认访问权限'], en: ['Access request was not approved', 'Contact an administrator to confirm your access.'] },
  error: { zh: ['权限检查失败', 'ContentOS 暂时无法验证工作区权限，任何工作区资料都没有开放'], en: ['Access check failed', 'ContentOS could not verify Workspace access. No Workspace data has been opened.'] },
} as const

export function ProtectedRoute() {
  const location = useLocation()
  const { status, errorMessage, initialAuthLoading, workspaceLoading, refreshAccess, signOut, session, accessRequest } = useAuth()
  const { language } = useI18n()
  const zh = language === 'zh-CN'

  if (status === 'loading' || initialAuthLoading || workspaceLoading) {
    return <main className="grid min-h-dvh place-items-center bg-canvas px-5 text-ink"><div className="flex items-center gap-3 text-sm font-semibold text-ink-muted"><LoaderCircle className="size-5 animate-spin text-coral" aria-hidden="true" />{zh ? '正在验证工作区权限…' : 'Verifying secure Workspace access…'}</div></main>
  }
  if (status === 'signed_out') return <Navigate to="/login" replace state={{ from: location }} />
  if (status === 'authorized') return <Outlet />

  const copy = accessMessages[status][zh ? 'zh' : 'en']
  const isRequestState = status === 'access_pending' || status === 'access_rejected'
  return <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-10 text-ink"><Card className="w-full max-w-xl border-t-4 border-t-coral">
    <div className="grid size-12 place-items-center rounded-xl bg-ink text-paper"><LockKeyhole className="size-5" aria-hidden="true" /></div>
    <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-coral">{isRequestState ? (zh ? 'Google 账号已验证' : 'Google account verified') : (zh ? '访问受限' : 'Access closed')}</p>
    <h1 className="mt-2 font-display text-3xl font-semibold">{copy[0]}</h1>
    <p className="mt-3 leading-7 text-ink-soft">{copy[1]}</p>
    {isRequestState ? <div className="mt-5 grid gap-3 rounded-xl border border-line bg-canvas-raised p-4 sm:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold text-ink-faint">{zh ? '账号' : 'Account'}</p><p className="mt-1 break-all font-semibold">{accessRequest?.email ?? session?.user.email ?? '—'}</p></div><div className="sm:text-right"><p className="text-xs font-bold text-ink-faint">{zh ? '状态' : 'Status'}</p><p className="mt-1 font-semibold text-gold-dark">{status === 'access_pending' ? (zh ? '等待管理员审批' : 'Waiting for approval') : (zh ? '未获批准' : 'Not approved')}</p></div></div> : null}
    {errorMessage ? <p className="mt-4 rounded-lg border border-coral/25 bg-coral/7 px-4 py-3 text-sm text-coral-dark">{errorMessage}</p> : null}
    <div className="mt-7 flex flex-wrap gap-3"><Button onClick={() => void refreshAccess()}>{zh ? '重新检查权限' : 'Check access again'}</Button><Button variant="secondary" onClick={() => void signOut()}>{zh ? '退出登录' : 'Sign out'}</Button></div>
  </Card></main>
}
