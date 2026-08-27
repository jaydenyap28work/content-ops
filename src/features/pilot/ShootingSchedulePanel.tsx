import { useEffect, useState } from 'react'
import { Card } from '../../components/ui'
import { formatWorkspaceDate } from '../i18n/labels'
import { useI18n } from '../i18n/i18n'
import { loadShootScenes } from '../brand/brand-api'
import type { ShootSceneRecord } from '../brand/brand-api'
import { loadShootingBrief } from './pilot-api'

export function ShootingSchedulePanel({ ideaId, clientId, plannedShootDate, scheduledAt }: { ideaId: string; clientId: string; plannedShootDate: string | null; scheduledAt: string | null }) {
  const { language } = useI18n()
  const zh = language === 'zh-CN'
  const [brief, setBrief] = useState<Awaited<ReturnType<typeof loadShootingBrief>>>(null)
  const [scenes, setScenes] = useState<ShootSceneRecord[]>([])
  useEffect(() => {
    let active = true
    void Promise.all([loadShootingBrief(ideaId), loadShootScenes(clientId)]).then(([nextBrief, nextScenes]) => {
      if (active) { setBrief(nextBrief); setScenes(nextScenes) }
    })
    return () => { active = false }
  }, [clientId, ideaId])
  const sceneName = (id: string | null | undefined) => scenes.find((scene) => scene.id === id)?.name ?? '—'
  const confirmed = scenes.find((scene) => scene.id === brief?.confirmed_scene_id)
  const exactTime = scheduledAt ? new Intl.DateTimeFormat(language === 'zh-CN' ? 'zh-CN' : 'en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit' }).format(new Date(scheduledAt)) : (zh ? '待定' : 'TBD')
  return <Card>
    <p className="text-xs font-extrabold uppercase tracking-[.18em] text-coral">{zh ? '拍摄安排' : 'Shoot Schedule'}</p>
    <dl className="mt-4 grid gap-4">
      <div><dt className="text-xs text-ink-muted">{zh ? '计划拍摄日期' : 'Planned Shoot Date'}</dt><dd className="mt-1 font-bold">{formatWorkspaceDate(plannedShootDate, language)}</dd></div>
      <div><dt className="text-xs text-ink-muted">{zh ? '具体时间' : 'Time'}</dt><dd className="mt-1 font-bold">{exactTime}</dd></div>
      <div><dt className="text-xs text-ink-muted">{zh ? '确认场景' : 'Confirmed Scene'}</dt><dd className="mt-1 font-bold">{sceneName(brief?.confirmed_scene_id)}</dd></div>
      <div><dt className="text-xs text-ink-muted">{zh ? '备用场景' : 'Backup Scene'}</dt><dd className="mt-1 font-bold">{sceneName(brief?.backup_scene_id)}</dd></div>
      <div><dt className="text-xs text-ink-muted">{zh ? '地点' : 'Location'}</dt><dd className="mt-1 font-bold">{confirmed?.location || brief?.location || '—'}</dd></div>
    </dl>
  </Card>
}