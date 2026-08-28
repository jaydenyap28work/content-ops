import { FormField, Input, Textarea } from '../../components/ui'
import type { ShootingPackSegment } from './pilot-api'

function parseDialogueLines(value: string) {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^([^：:]{1,30})[：:]\s*(.+)$/u)
    return match ? { character: match[1].trim(), line: match[2].trim() } : { character: '', line }
  })
}

export function SkitSegmentEditor({ segment, zh, onChange }: { segment: ShootingPackSegment; zh: boolean; onChange: (patch: Partial<ShootingPackSegment>) => void }) {
  return <div className="grid gap-4 pr-20 lg:grid-cols-2">
    <FormField label={zh ? '镜头 / 场景' : 'Scene'}><Input value={segment.prompt} onChange={(event) => onChange({ prompt: event.target.value })} /></FormField>
    <FormField label={zh ? '角色' : 'Cast'}><Input value={(segment.cast ?? []).join(', ')} onChange={(event) => onChange({ cast: event.target.value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean) })} /></FormField>
    <FormField className="lg:col-span-2" label={zh ? '角色与台词' : 'Dialogue'} hint={zh ? '每行使用「角色：台词」' : 'Use “Character: line” on each row'}><Textarea rows={8} value={(segment.dialogues ?? []).map((item) => `${item.character}${item.character ? '：' : ''}${item.line}`).join('\n')} onChange={(event) => onChange({ dialogues: parseDialogueLines(event.target.value) })} /></FormField>
    <FormField label={zh ? '动作 / 表演提示' : 'Action'}><Textarea rows={4} value={segment.action ?? ''} onChange={(event) => onChange({ action: event.target.value })} /></FormField>
    <FormField label={zh ? '画面提示' : 'Visual Cue'}><Textarea rows={4} value={segment.visualCue} onChange={(event) => onChange({ visualCue: event.target.value })} /></FormField>
    <FormField label={zh ? '屏幕字幕' : 'On-screen Text'}><Textarea rows={3} value={segment.onScreenText} onChange={(event) => onChange({ onScreenText: event.target.value })} /></FormField>
  </div>
}

export function SkitSegmentView({ segment, zh }: { segment: ShootingPackSegment; zh: boolean }) {
  return <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,.7fr)]">
    <div className="space-y-3">
      {(segment.dialogues ?? []).map((dialogue, index) => <div key={`${dialogue.character}-${index}`} className="border-l-4 border-coral bg-coral/[.035] px-4 py-3">
        <p className="text-xs font-extrabold text-coral-dark">{dialogue.character || (zh ? '台词' : 'Dialogue')}</p>
        <p className="mt-1 whitespace-pre-wrap text-[1.05rem] leading-8">{dialogue.line}</p>
      </div>)}
      {!(segment.dialogues ?? []).length ? <p className="whitespace-pre-wrap text-sm text-ink-muted">{segment.rawText || '—'}</p> : null}
    </div>
    <div className="space-y-4">
      <Cue label={zh ? '角色' : 'Cast'} value={(segment.cast ?? []).join(' · ')} />
      <Cue label={zh ? '动作 / 表演提示' : 'Action'} value={segment.action} />
      <Cue label={zh ? '画面提示' : 'Visual Cue'} value={segment.visualCue} />
      <Cue label={zh ? '屏幕字幕' : 'On-screen Text'} value={segment.onScreenText} />
    </div>
  </div>
}

function Cue({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-ink-faint">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{value || '—'}</p></div>
}
