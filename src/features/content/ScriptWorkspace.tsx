import { useState } from 'react'
import type { FormEvent } from 'react'
import { FileClock, FilePlus2, LoaderCircle } from 'lucide-react'
import { Button, Card, FormField, Select, StatusBadge, Textarea } from '../../components/ui'
import { createScriptVersion } from './review-api'
import type { ScriptVersionRecord } from './review-api'

interface Props { contentId: string; scripts: ScriptVersionRecord[]; canManage: boolean; onChanged: () => Promise<void> }
const formatDate = (value: string) => new Date(value).toLocaleString('en-MY')

export function ScriptWorkspace({ contentId, scripts, canManage, onChanged }: Props) {
  const [body, setBody] = useState(''); const [note, setNote] = useState(''); const [status, setStatus] = useState('draft')
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null)
    try { await createScriptVersion(contentId, body, status, note); setBody(''); setNote(''); await onChanged() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create Script Version') }
    finally { setBusy(false) }
  }
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]">
    <Card>
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><FileClock className="size-4 text-coral" /><p className="text-xs font-extrabold uppercase tracking-[.18em] text-ink-faint">Script version history</p></div><StatusBadge tone="info">Immutable</StatusBadge></div>
      {scripts.length ? <div className="mt-5 space-y-4">{scripts.map((script, index) => <article key={script.id} className="rounded-lg border border-line p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><p className="font-bold">Version {script.version_number}</p>{index === 0 ? <StatusBadge tone="success">Current</StatusBadge> : null}<StatusBadge>{script.status}</StatusBadge></div><time className="font-mono text-[.68rem] text-ink-faint">{formatDate(script.created_at)}</time></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-soft">{script.body}</p>{script.note ? <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">{script.note}</p> : null}</article>)}</div> : <div className="mt-5 rounded-lg border border-dashed border-line-strong p-6 text-center"><p className="font-bold">No Script Version yet</p><p className="mt-2 text-sm text-ink-muted">Create V1 without overwriting future history.</p></div>}
    </Card>
    <Card tone="quiet"><div className="flex items-center gap-2"><FilePlus2 className="size-4 text-blue" /><p className="text-xs font-extrabold uppercase tracking-[.18em] text-ink-faint">New version</p></div>{canManage ? <form className="mt-5 space-y-4" onSubmit={submit}><FormField label="Script body" htmlFor="script-body"><Textarea id="script-body" className="min-h-64" required value={body} onChange={(e) => setBody(e.target.value)} /></FormField><FormField label="State" htmlFor="script-status"><Select id="script-status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">Draft</option><option value="submitted">Submitted</option></Select></FormField><FormField label="Version note" htmlFor="script-note"><Textarea id="script-note" value={note} onChange={(e) => setNote(e.target.value)} /></FormField>{error ? <p className="text-sm text-coral-dark">{error}</p> : null}<Button type="submit" disabled={busy || !body.trim()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}Create next version</Button></form> : <p className="mt-5 text-sm leading-6 text-ink-muted">A planning role is required to add Script Versions.</p>}</Card>
  </div>
}
