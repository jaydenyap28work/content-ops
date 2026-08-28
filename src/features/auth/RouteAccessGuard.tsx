import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Card } from '../../components/ui'
import { useI18n } from '../i18n/i18n'
import { useAuth } from './auth-context'
import { canAccessAppPath } from './role-access'

export function RouteAccessGuard({ path, children }: { path: string; children: ReactNode }) {
  const { workspace } = useAuth()
  const { language } = useI18n()
  if (workspace && !canAccessAppPath(workspace.roles, path)) {
    return <Card className="mx-auto mt-12 max-w-xl text-center"><ShieldAlert className="mx-auto size-9 text-danger"/><h1 className="mt-4 text-2xl font-bold">{language === 'zh-CN' ? '没有权限访问此页面' : 'You do not have access to this page'}</h1></Card>
  }
  return <>{children}</>
}