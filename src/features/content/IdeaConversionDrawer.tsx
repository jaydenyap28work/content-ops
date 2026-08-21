import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, X } from 'lucide-react'
import { Button, FormField, Input, Select, StatusBadge, Textarea } from '../../components/ui'
import type { IdeaRecord, ReferenceRecord } from '../research/research-api'
import type { ContributorOption } from '../research/research-api'
import { convertIdeaToContent, loadCampaigns, loadContentOwnerOptions } from './content-api'
import type { CampaignRecord } from './content-api'

interface IdeaConversionDrawerProps {
  workspaceId: string
  idea: IdeaRecord
  clientName: string
  categoryName: string | null
  references: ReferenceRecord[]
  canManagePrivateNotes: boolean
  onClose: () => void
  onConverted: (contentId: string, contentCode: string) => void | Promise<void>
}

export function IdeaConversionDrawer({
  workspaceId,
  idea,
  clientName,
  categoryName,
  references,
  canManagePrivateNotes,
  onClose,
  onConverted,
}: IdeaConversionDrawerProps) {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([])
  const [owners, setOwners] = useState<ContributorOption[]>([])
  const [form, setForm] = useState({
    title: idea.title,
    workingTitle: idea.title,
    campaignId: '',
    objective: idea.our_angle ?? '',
    ownerUserId: idea.owner_user_id ?? '',
    internalNotes: idea.notes ?? '',
    privateManagementNotes: '',
    clientVisibleNotes: '',
    tags: idea.tags.join(', '),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([loadCampaigns(workspaceId), loadContentOwnerOptions(idea.client_id)])
      .then(([nextCampaigns, nextOwners]) => {
        if (!active) return
        setCampaigns(nextCampaigns.filter((campaign) => campaign.client_id === idea.client_id && campaign.status === 'active'))
        setOwners(nextOwners)
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not load conversion options') })
    return () => { active = false }
  }, [idea.client_id, workspaceId])

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      const result = await convertIdeaToContent(idea.id, {
        title: form.title,
        workingTitle: form.workingTitle,
        campaignId: form.campaignId || null,
        objective: form.objective,
        ownerUserId: form.ownerUserId || null,
        internalNotes: form.internalNotes,
        privateManagementNotes: canManagePrivateNotes ? form.privateManagementNotes : '',
        clientVisibleNotes: form.clientVisibleNotes,
        tags: [...new Set(form.tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
      })
      await onConverted(result.content_id, result.content_code)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not convert Idea') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm">
      <section className="h-full w-full max-w-3xl overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8" aria-label="Convert Idea to Content">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">Approved Idea → Draft Content</p><h2 className="mt-2 font-display text-3xl font-semibold">Create without losing the thinking behind it</h2><p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">One transaction creates the Content, copies Idea Creator provenance, and marks the source Idea Converted.</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close conversion"><X className="size-5" /></Button></div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-canvas-raised p-4"><p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">Client</p><p className="mt-2 font-bold">{clientName}</p></div>
          <div className="rounded-lg border border-line bg-canvas-raised p-4"><p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">Category</p><p className="mt-2 font-bold">{categoryName ?? 'Uncategorised'}</p></div>
          <div className="rounded-lg border border-line bg-canvas-raised p-4"><p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">Priority</p><StatusBadge className="mt-2">{idea.priority}</StatusBadge></div>
        </div>

        <div className="mt-4 rounded-lg border border-gold/25 bg-gold/5 p-4"><div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-gold" /><p className="text-xs font-bold uppercase tracking-wider text-gold-dark">Provenance retained</p></div><p className="mt-2 font-display text-xl font-semibold">{idea.title}</p><div className="mt-3 flex flex-wrap gap-2"><StatusBadge>{idea.contributors.length} Idea contributor{idea.contributors.length === 1 ? '' : 's'}</StatusBadge><StatusBadge>{references.length} source Reference{references.length === 1 ? '' : 's'}</StatusBadge></div>{references.length ? <div className="mt-3 flex flex-wrap gap-2">{references.map((reference) => <span key={reference.id} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold"><BookOpen className="size-3.5 text-blue" />{reference.title}</span>)}</div> : null}</div>

        <form className="mt-7 space-y-5" onSubmit={submit}>
          {error ? <div className="rounded-md border border-coral/30 bg-coral/8 p-3 text-sm text-coral-dark">{error}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Content title" htmlFor="conversion-title" required><Input id="conversion-title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></FormField><FormField label="Working title" htmlFor="conversion-working-title"><Input id="conversion-working-title" value={form.workingTitle} onChange={(event) => setForm({ ...form, workingTitle: event.target.value })} /></FormField></div>
          <FormField label="Objective" htmlFor="conversion-objective"><Textarea id="conversion-objective" value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Campaign" htmlFor="conversion-campaign"><Select id="conversion-campaign" value={form.campaignId} onChange={(event) => setForm({ ...form, campaignId: event.target.value })}><option value="">No campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</Select></FormField><FormField label="Owner" htmlFor="conversion-owner"><Select id="conversion-owner" value={form.ownerUserId} onChange={(event) => setForm({ ...form, ownerUserId: event.target.value })}><option value="">Use Idea owner / converter</option>{owners.map((owner) => <option key={owner.user_profile_id} value={owner.user_profile_id}>{owner.display_name}</option>)}</Select></FormField></div>
          <FormField label="Tags" htmlFor="conversion-tags" hint="Idea Tags are copied automatically; these are merged in."><Input id="conversion-tags" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></FormField>
          <div className="grid gap-4 border-t border-line pt-5"><div className="flex items-center gap-2"><EyeOff className="size-4 text-ink-muted" /><h3 className="text-sm font-bold">Internal Notes</h3></div><Textarea aria-label="Conversion Internal Notes" value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} />{canManagePrivateNotes ? <><div className="flex items-center gap-2"><LockKeyhole className="size-4 text-gold" /><h3 className="text-sm font-bold">Private Management Notes</h3></div><Textarea aria-label="Conversion Private Management Notes" value={form.privateManagementNotes} onChange={(event) => setForm({ ...form, privateManagementNotes: event.target.value })} /></> : null}<div className="flex items-center gap-2"><Eye className="size-4 text-blue" /><h3 className="text-sm font-bold">Client-visible Notes</h3></div><p className="-mt-2 text-xs text-blue">Client access remains disabled; this label preserves the future sharing boundary.</p><Textarea aria-label="Conversion Client-visible Notes" value={form.clientVisibleNotes} onChange={(event) => setForm({ ...form, clientVisibleNotes: event.target.value })} /></div>
          <div className="flex flex-wrap gap-3 border-t border-line pt-5"><Button type="submit" disabled={busy || !form.title.trim()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}Convert to Draft Content</Button><Button variant="secondary" onClick={onClose}>Cancel</Button></div>
        </form>
      </section>
    </div>
  )
}
