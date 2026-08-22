import { useCallback, useEffect, useState } from 'react'
import { Camera, LoaderCircle, Save, ShieldAlert, Sparkles } from 'lucide-react'
import { Button, Card, FormField, Input, Select, Textarea } from '../../components/ui'
import { loadContributorOptions } from '../research/research-api'
import type { IdeaRecord, ReferenceRecord } from '../research/research-api'
import { generateShootingBriefs, loadShootingBrief, saveShootingBrief } from './pilot-api'
import { toShootingBriefGenerationInput } from './shooting-brief-templates'

const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean)
const emptyBrief = {
  whyNow: '', questions: '', points: '', takeaway: '', cta: '', duration: '', visuals: '', factChecks: '',
  talent: '', shootDate: '', location: '', shooter: '',
}

export function ShootingBrief({ idea, references }: { idea: IdeaRecord; references: ReferenceRecord[] }) {
  const [brief, setBrief] = useState(emptyBrief)
  const [people, setPeople] = useState<Array<{ user_profile_id: string; display_name: string }>>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const [saved, options] = await Promise.all([loadShootingBrief(idea.id), loadContributorOptions(idea.client_id)])
    setPeople(options)
    if (saved) setBrief({
      whyNow: saved.why_now ?? '', questions: saved.interview_questions.join('\n'),
      points: saved.key_talking_points.join('\n'), takeaway: saved.key_takeaway ?? '',
      cta: saved.suggested_cta ?? '', duration: saved.target_duration ?? '',
      visuals: saved.b_roll_visual_suggestions.join('\n'), factChecks: saved.risk_fact_check_notes.join('\n'),
      talent: saved.talent ?? '', shootDate: saved.shoot_date ?? '', location: saved.location ?? '',
      shooter: saved.shooter_user_id ?? '',
    })
  }, [idea.client_id, idea.id])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  async function generate() {
    setBusy(true); setError(''); setNotice('')
    try {
      await generateShootingBriefs([toShootingBriefGenerationInput(idea)])
      await refresh()
      setNotice('已生成拍摄简报；只填补空白字段，现有修改不会被覆盖。')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法生成拍摄简报')
    } finally { setBusy(false) }
  }

  async function save() {
    setBusy(true); setError(''); setNotice('')
    try {
      await saveShootingBrief(idea.id, {
        why_now: brief.whyNow,
        interview_questions: lines(brief.questions).slice(0, 5),
        key_talking_points: lines(brief.points),
        key_takeaway: brief.takeaway,
        suggested_cta: brief.cta,
        target_duration: brief.duration,
        b_roll_visual_suggestions: lines(brief.visuals),
        risk_fact_check_notes: lines(brief.factChecks),
        talent: brief.talent,
        shoot_date: brief.shootDate || null,
        location: brief.location,
        shooter_user_id: brief.shooter || null,
      })
      setNotice('拍摄简报已保存 / Shooting brief saved')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法保存拍摄简报')
    } finally { setBusy(false) }
  }

  return <div className="space-y-5">
    <Card className="border-coral/25 bg-coral/[.035]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3"><Camera className="mt-1 size-5 text-coral" /><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-coral">拍摄简报 / Shooting Brief</p><h3 className="mt-2 text-2xl font-bold">{idea.title}</h3><p className="mt-2 text-sm text-ink-muted">提供可直接访问与拍摄的表达方向，不替出镜者决定固定立场。</p></div></div>
        <Button variant="secondary" onClick={() => void generate()} disabled={busy}><Sparkles className="size-4" />生成拍摄简报</Button>
      </div>
    </Card>
    {notice ? <p className="rounded-lg bg-green/8 p-3 text-sm text-green">{notice}</p> : null}
    {error ? <p role="alert" className="rounded-lg border border-coral/25 bg-coral/7 p-3 text-sm text-coral-dark">{error}</p> : null}

    <div className="grid gap-5 lg:grid-cols-2">
      <FormField label="Why Now / 为什么现在值得讲"><Textarea rows={5} value={brief.whyNow} onChange={(event) => setBrief({ ...brief, whyNow: event.target.value })} /></FormField>
      <FormField label="Suggested Hook / 建议开场"><Textarea rows={5} value={idea.original_hook ?? ''} readOnly /></FormField>
      <FormField label="Interview Questions / 访问提问" hint="每行一题，3–5 题"><Textarea rows={8} value={brief.questions} onChange={(event) => setBrief({ ...brief, questions: event.target.value })} /></FormField>
      <FormField label="Key Talking Points / 核心表达方向" hint="每行一个方向，不是标准答案"><Textarea rows={8} value={brief.points} onChange={(event) => setBrief({ ...brief, points: event.target.value })} /></FormField>
      <FormField label="Key Takeaway / 核心带走"><Textarea rows={4} value={brief.takeaway} onChange={(event) => setBrief({ ...brief, takeaway: event.target.value })} /></FormField>
      <FormField label="Suggested CTA"><Textarea rows={4} value={brief.cta} onChange={(event) => setBrief({ ...brief, cta: event.target.value })} /></FormField>
      <FormField label="Format"><Input value={idea.suggested_format ?? ''} readOnly /></FormField>
      <FormField label="Target Duration"><Input value={brief.duration} onChange={(event) => setBrief({ ...brief, duration: event.target.value })} /></FormField>
      <FormField label="B-roll / Visual Suggestions" hint="每行一个画面建议"><Textarea rows={7} value={brief.visuals} onChange={(event) => setBrief({ ...brief, visuals: event.target.value })} /></FormField>
      <FormField label="Risk / Fact Check Notes" hint="每行一个核查或风险提醒"><Textarea rows={7} value={brief.factChecks} onChange={(event) => setBrief({ ...brief, factChecks: event.target.value })} /></FormField>
    </div>

    {brief.factChecks ? <Card className="border-gold/35 bg-gold/8"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 text-gold-dark" /><div><p className="text-sm font-extrabold uppercase tracking-wider text-gold-dark">拍摄前核查</p><ul className="mt-2 space-y-2 text-sm leading-6 text-ink-soft">{lines(brief.factChecks).map((note) => <li key={note}>• {note}</li>)}</ul></div></div></Card> : null}

    <details className="rounded-xl border border-line bg-paper">
      <summary className="cursor-pointer px-4 py-3 font-bold">执行资料 / Execution details</summary>
      <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
        <FormField label="Talent / 出镜"><Input value={brief.talent} onChange={(event) => setBrief({ ...brief, talent: event.target.value })} /></FormField>
        <FormField label="Shooter / 拍摄"><Select value={brief.shooter} onChange={(event) => setBrief({ ...brief, shooter: event.target.value })}><option value="">Unassigned</option>{people.map((person) => <option key={person.user_profile_id} value={person.user_profile_id}>{person.display_name}</option>)}</Select></FormField>
        <FormField label="Shoot Date"><Input type="date" value={brief.shootDate} onChange={(event) => setBrief({ ...brief, shootDate: event.target.value })} /></FormField>
        <FormField label="Location"><Input value={brief.location} onChange={(event) => setBrief({ ...brief, location: event.target.value })} /></FormField>
      </div>
    </details>

    <div><p className="text-sm font-bold">References</p><div className="mt-2 space-y-2">{references.filter((reference) => idea.referenceIds.includes(reference.id)).map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer" className="block truncate rounded-lg border border-line p-3 text-sm text-blue">{reference.title}</a>)}</div></div>
    <Button onClick={() => void save()} disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}保存拍摄简报</Button>
    <details className="rounded-xl border border-line"><summary className="cursor-pointer px-4 py-3 font-bold">更多 / Internal Notes</summary><div className="border-t border-line p-4 text-sm text-ink-muted"><p>{idea.notes || 'No internal notes.'}</p></div></details>
  </div>
}
