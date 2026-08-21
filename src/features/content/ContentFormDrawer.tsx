import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, X } from 'lucide-react'
import { Button, FormField, Input, Select, Textarea } from '../../components/ui'
import { loadContentOwnerOptions, saveContent } from './content-api'
import type { ContentCatalog, ContentRecord } from './content-api'
import type { ContributorOption } from '../research/research-api'

interface ContentFormDrawerProps {
  workspaceId: string
  catalog: ContentCatalog
  content?: ContentRecord | null
  canManagePrivateNotes: boolean
  onClose: () => void
  onSaved: (contentId: string) => void | Promise<void>
}

interface FormState {
  clientId: string
  title: string
  workingTitle: string
  categoryId: string
  campaignId: string
  objective: string
  priority: string
  ownerUserId: string
  internalNotes: string
  privateManagementNotes: string
  clientVisibleNotes: string
  directCreationReason: string
  tags: string
}

function initialForm(catalog: ContentCatalog, content?: ContentRecord | null): FormState {
  return content ? {
    clientId: content.client_id,
    title: content.title,
    workingTitle: content.working_title ?? '',
    categoryId: content.category_id ?? '',
    campaignId: content.campaign_id ?? '',
    objective: content.objective ?? '',
    priority: content.priority,
    ownerUserId: content.current_owner_user_id ?? '',
    internalNotes: content.internal_notes ?? '',
    privateManagementNotes: content.private_management_notes ?? '',
    clientVisibleNotes: content.client_visible_notes ?? '',
    directCreationReason: content.direct_creation_reason ?? '',
    tags: content.tags.join(', '),
  } : {
    clientId: catalog.clients[0]?.id ?? '',
    title: '',
    workingTitle: '',
    categoryId: '',
    campaignId: '',
    objective: '',
    priority: 'normal',
    ownerUserId: '',
    internalNotes: '',
    privateManagementNotes: '',
    clientVisibleNotes: '',
    directCreationReason: '',
    tags: '',
  }
}

export function ContentFormDrawer({
  workspaceId,
  catalog,
  content,
  canManagePrivateNotes,
  onClose,
  onSaved,
}: ContentFormDrawerProps) {
  const [form, setForm] = useState(() => initialForm(catalog, content))
  const [owners, setOwners] = useState<ContributorOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!form.clientId) return
    void loadContentOwnerOptions(form.clientId)
      .then((options) => { if (active) setOwners(options) })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not load owners') })
    return () => { active = false }
  }, [form.clientId])

  const scopedCategories = catalog.categories.filter(
    (category) => category.client_id === null || category.client_id === form.clientId,
  )
  const scopedCampaigns = catalog.campaigns.filter(
    (campaign) => campaign.client_id === form.clientId && (campaign.status === 'active' || campaign.id === form.campaignId),
  )

  function changeClient(clientId: string) {
    setForm((current) => ({
      ...current,
      clientId,
      categoryId: '',
      campaignId: '',
      ownerUserId: '',
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(null)
    try {
      const contentId = await saveContent(workspaceId, {
        id: content?.id,
        clientId: form.clientId,
        title: form.title,
        workingTitle: form.workingTitle,
        categoryId: form.categoryId || null,
        campaignId: form.campaignId || null,
        objective: form.objective,
        priority: form.priority,
        ownerUserId: form.ownerUserId || null,
        internalNotes: form.internalNotes,
        privateManagementNotes: canManagePrivateNotes ? form.privateManagementNotes : '',
        clientVisibleNotes: form.clientVisibleNotes,
        directCreationReason: form.directCreationReason,
        tags: [...new Set(form.tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
      })
      await onSaved(contentId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save Content')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm">
      <section className="h-full w-full max-w-3xl overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8" aria-label={content ? 'Edit Content' : 'Create Content'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">Content record</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">{content ? `Edit ${content.content_code}` : 'Create direct Content'}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">Production stays in Draft. Workflow actions begin in the next phase.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close Content form"><X className="size-5" /></Button>
        </div>

        <form className="mt-8 space-y-6" onSubmit={submit}>
          {error ? <div className="rounded-md border border-coral/30 bg-coral/8 p-3 text-sm text-coral-dark">{error}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Client" htmlFor="content-client" required hint={content ? 'Client ownership is fixed after creation.' : undefined}>
              <Select id="content-client" required disabled={Boolean(content)} value={form.clientId} onChange={(event) => changeClient(event.target.value)}>
                <option value="">Choose Client</option>
                {catalog.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Priority" htmlFor="content-priority">
              <Select id="content-priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Title" htmlFor="content-title" required><Input id="content-title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></FormField>
            <FormField label="Working title" htmlFor="content-working-title"><Input id="content-working-title" value={form.workingTitle} onChange={(event) => setForm({ ...form, workingTitle: event.target.value })} /></FormField>
          </div>
          <FormField label="Objective" htmlFor="content-objective"><Textarea id="content-objective" value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Category" htmlFor="content-category"><Select id="content-category" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">No category</option>{scopedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></FormField>
            <FormField label="Campaign" htmlFor="content-campaign"><Select id="content-campaign" value={form.campaignId} onChange={(event) => setForm({ ...form, campaignId: event.target.value })}><option value="">No campaign</option>{scopedCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</Select></FormField>
            <FormField label="Owner" htmlFor="content-owner"><Select id="content-owner" value={form.ownerUserId} onChange={(event) => setForm({ ...form, ownerUserId: event.target.value })}><option value="">Default to creator</option>{owners.map((owner) => <option key={owner.user_profile_id} value={owner.user_profile_id}>{owner.display_name}</option>)}</Select></FormField>
          </div>
          <FormField label="Tags" htmlFor="content-tags" hint="Comma-separated and normalized within this Client."><Input id="content-tags" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></FormField>

          {!content ? <FormField label="Direct creation reason" htmlFor="content-direct-reason" required hint="Use Idea conversion when an Approved Idea exists."><Textarea id="content-direct-reason" required value={form.directCreationReason} onChange={(event) => setForm({ ...form, directCreationReason: event.target.value })} /></FormField> : null}

          <div className="grid gap-4 border-t border-line pt-6">
            <div className="flex items-center gap-2"><EyeOff className="size-4 text-ink-muted" /><h3 className="text-sm font-bold">Internal Notes</h3></div>
            <p className="-mt-2 text-xs text-ink-muted">Internal operational context. Never client-visible.</p>
            <Textarea aria-label="Internal Notes" value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} />

            {canManagePrivateNotes ? <>
              <div className="mt-2 flex items-center gap-2"><LockKeyhole className="size-4 text-gold" /><h3 className="text-sm font-bold">Private Management Notes</h3></div>
              <p className="-mt-2 text-xs text-ink-muted">Restricted to Super Admin and authorized Internal Managers.</p>
              <Textarea aria-label="Private Management Notes" value={form.privateManagementNotes} onChange={(event) => setForm({ ...form, privateManagementNotes: event.target.value })} />
            </> : null}

            <div className="mt-2 flex items-center gap-2"><Eye className="size-4 text-blue" /><h3 className="text-sm font-bold">Client-visible Notes</h3></div>
            <p className="-mt-2 text-xs text-blue">Explicitly marked for future Client sharing. Client access is not enabled in this phase.</p>
            <Textarea aria-label="Client-visible Notes" value={form.clientVisibleNotes} onChange={(event) => setForm({ ...form, clientVisibleNotes: event.target.value })} />
          </div>

          <div className="flex flex-wrap gap-3 border-t border-line pt-6">
            <Button type="submit" disabled={busy || !form.clientId || !form.title.trim()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}{content ? 'Save changes' : 'Create Draft Content'}</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </section>
    </div>
  )
}
