import { useState } from 'react'
import type { FormEvent } from 'react'
import { Archive, CalendarRange, LoaderCircle, Pencil, Plus, X } from 'lucide-react'
import { Button, FormField, Input, Select, StatusBadge, Textarea } from '../../components/ui'
import { archiveCampaign, saveCampaign } from './content-api'
import type { CampaignRecord, ContentCatalog } from './content-api'

interface CampaignManagerDrawerProps {
  workspaceId: string
  catalog: ContentCatalog
  onClose: () => void
  onChanged: () => void | Promise<void>
}

const blank = { clientId: '', name: '', description: '', startsOn: '', endsOn: '' }

export function CampaignManagerDrawer({ workspaceId, catalog, onClose, onChanged }: CampaignManagerDrawerProps) {
  const [editing, setEditing] = useState<CampaignRecord | null>(null)
  const [form, setForm] = useState({ ...blank, clientId: catalog.clients[0]?.id ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function open(campaign: CampaignRecord | null) {
    setEditing(campaign); setError(null)
    setForm(campaign ? {
      clientId: campaign.client_id,
      name: campaign.name,
      description: campaign.description ?? '',
      startsOn: campaign.starts_on ?? '',
      endsOn: campaign.ends_on ?? '',
    } : { ...blank, clientId: catalog.clients[0]?.id ?? '' })
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      await saveCampaign(workspaceId, { id: editing?.id, ...form })
      setEditing(null); setForm({ ...blank, clientId: form.clientId }); await onChanged()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save Campaign') }
    finally { setBusy(false) }
  }

  async function archive(campaign: CampaignRecord) {
    if (!window.confirm(`Archive Campaign “${campaign.name}”? Existing Content keeps the relationship.`)) return
    setBusy(true); setError(null)
    try { await archiveCampaign(campaign.id); await onChanged() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not archive Campaign') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm">
      <section className="h-full w-full max-w-2xl overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8" aria-label="Campaign manager">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">Minimal Campaigns</p><h2 className="mt-2 font-display text-3xl font-semibold">Planning groups, kept lean</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Name, Client, description, dates, and active state only. No campaign analytics.</p></div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close Campaign manager"><X className="size-5" /></Button>
        </div>

        {error ? <div className="mt-5 rounded-md border border-coral/30 bg-coral/8 p-3 text-sm text-coral-dark">{error}</div> : null}

        <form className="mt-7 space-y-4 rounded-lg border border-line bg-canvas-raised p-5" onSubmit={submit}>
          <div className="flex items-center justify-between"><h3 className="font-display text-xl font-semibold">{editing ? 'Edit Campaign' : 'New Campaign'}</h3>{editing ? <Button variant="ghost" size="sm" onClick={() => open(null)}>New instead</Button> : null}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Client" htmlFor="campaign-client" required><Select id="campaign-client" required disabled={Boolean(editing)} value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">Choose Client</option>{catalog.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></FormField>
            <FormField label="Campaign name" htmlFor="campaign-name" required><Input id="campaign-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
          </div>
          <FormField label="Description" htmlFor="campaign-description"><Textarea id="campaign-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start date" htmlFor="campaign-start"><Input id="campaign-start" type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></FormField>
            <FormField label="End date" htmlFor="campaign-end"><Input id="campaign-end" type="date" min={form.startsOn || undefined} value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} /></FormField>
          </div>
          <Button type="submit" disabled={busy || !form.clientId || !form.name.trim()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}{editing ? 'Save Campaign' : 'Create Campaign'}</Button>
        </form>

        <div className="mt-8 space-y-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-faint">Campaign register</p>
          {catalog.campaigns.length ? catalog.campaigns.map((campaign) => (
            <article key={campaign.id} className="flex items-start gap-4 rounded-lg border border-line p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue/10 text-blue"><CalendarRange className="size-5" /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{campaign.name}</h3><StatusBadge tone={campaign.status === 'active' ? 'success' : 'neutral'}>{campaign.status}</StatusBadge></div><p className="mt-1 text-xs text-ink-muted">{catalog.clients.find((client) => client.id === campaign.client_id)?.name ?? 'Client'} · {campaign.starts_on ?? 'Open start'} → {campaign.ends_on ?? 'Open end'}</p>{campaign.description ? <p className="mt-2 text-sm leading-6 text-ink-soft">{campaign.description}</p> : null}</div>
              {campaign.status === 'active' ? <div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => open(campaign)} aria-label={`Edit ${campaign.name}`}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => void archive(campaign)} aria-label={`Archive ${campaign.name}`}><Archive className="size-4" /></Button></div> : null}
            </article>
          )) : <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-sm text-ink-muted">No Campaigns yet. Create one only when multiple Content records need a shared planning group.</div>}
        </div>
      </section>
    </div>
  )
}
