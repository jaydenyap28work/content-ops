import type { ShootingPackSegment } from './pilot-api'

export function SkitBossSegment({ segment, zh }: { segment: ShootingPackSegment; zh: boolean }) {
  return <div className="mt-4 w-full max-w-5xl space-y-2 text-left sm:mt-7">
    {segment.cast?.length ? <p className="text-xs font-bold text-coral-light">{zh ? '角色' : 'Cast'} · {segment.cast.join(' · ')}</p> : null}
    {(segment.dialogues ?? []).map((dialogue, index) => <div key={`${dialogue.character}-${index}`} className="border-l-4 border-coral bg-white/5 px-4 py-3">
      <b className="text-sm text-coral-light">{dialogue.character || (zh ? '台词' : 'Dialogue')}</b>
      <p className="mt-1 whitespace-pre-wrap text-xl leading-8 sm:text-3xl sm:leading-[1.5]">{dialogue.line}</p>
    </div>)}
    {!(segment.dialogues ?? []).length && segment.rawText ? <p className="whitespace-pre-wrap text-xl leading-8 sm:text-3xl sm:leading-[1.5]">{segment.rawText}</p> : null}
    {segment.action ? <p className="text-sm opacity-65">{zh ? '动作' : 'Action'} · {segment.action}</p> : null}
    {segment.onScreenText ? <p className="text-sm opacity-65">{zh ? '屏幕字幕' : 'On-screen Text'} · {segment.onScreenText}</p> : null}
  </div>
}
