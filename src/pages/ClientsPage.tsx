import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Archive, Building2, LoaderCircle, Pencil, Plus, Search, X } from 'lucide-react'
import { Button, Card, FormField, Input, StatusBadge, Textarea } from '../components/ui'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { useDevMountCounter } from '../lib/dev-diagnostics'
import { archiveClient, loadClients, saveClient } from '../features/admin/admin-api'
import type { ClientRecord } from '../features/admin/admin-api'
import { useI18n } from '../features/i18n/i18n'

const emptyForm = { name: '', code: '', industry: '', description: '', brandNotes: '' }

export function ClientsPage() {
  useDevMountCounter('ClientsPage')
  const { workspace } = useAuth()
  const {language}=useI18n(); const zh=language==='zh-CN'
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<ClientRecord | null | undefined>(undefined)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const isSuperAdmin = workspace?.roles.includes('Super Admin') ?? false
  const canManage = isSuperAdmin || (workspace?.roles.includes('Internal Manager') ?? false)

  const refresh = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    setError(null)
    try { setClients(await loadClients(workspace.id)) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load Clients') }
    finally { setLoading(false) }
  }, [workspace])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const visibleClients = useMemo(() => {
    const term = search.trim().toLowerCase()
    return clients.filter((client) => {
      if (client.ownership_type !== 'external_client') return false
      if (!showArchived && client.status === 'archived') return false
      return !term || [client.name, client.code, client.industry ?? ''].some((value) => value.toLowerCase().includes(term))
    })
  }, [clients, search, showArchived])

  function openEditor(client: ClientRecord | null) {
    setError(null)
    setEditing(client)
    setForm(client ? {
      name: client.name,
      code: client.code,
      industry: client.industry ?? '',
      description: client.description ?? '',
      brandNotes: client.brand_notes ?? '',
    } : emptyForm)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!workspace) return
    setSaving(true)
    setError(null)
    try {
      await saveClient(workspace.id, { id: editing?.id, ...form })
      setNotice(editing ? 'Client details updated.' : 'Client created.')
      setEditing(undefined)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save Client')
    } finally { setSaving(false) }
  }

  async function handleArchive(client: ClientRecord) {
    if (!window.confirm(`Archive ${client.name}? Existing records remain preserved.`)) return
    setError(null)
    try {
      await archiveClient(client.id)
      setNotice(`${client.name} archived.`)
      setEditing(undefined)
      await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not archive Client') }
  }

  return (
    <div className="page-enter space-y-6">
      <header className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-coral">{zh?'管理':'Management'}</p>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{zh?'外部客户':'External Clients'}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-ink-soft">{zh?'这里仅管理未来真正委托 LKSoft 制作内容的外部客户。LKSoft 本身属于内部品牌。':'Manage external customers whose work is delivered by LKSoft. LKSoft itself is an Internal Brand.'}</p>
        </div>
        {canManage ? <Button onClick={() => openEditor(null)}><Plus className="size-4" />{zh?'新增客户':'New Client'}</Button> : null}
      </header>

      {error ? <div role="alert" className="rounded-lg border border-coral/30 bg-coral/8 px-4 py-3 text-sm text-coral-dark">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-green/25 bg-green/8 px-4 py-3 text-sm text-green">{notice}</div> : null}

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, or industry" className="pl-10" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="size-4 accent-coral" />Show archived
        </label>
      </Card>

      {loading ? (
        <Card className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin text-coral" /></Card>
      ) : visibleClients.length === 0 ? (
        <Card className="grid min-h-64 place-items-center text-center">
          <div><Building2 className="mx-auto size-8 text-ink-faint" /><h3 className="mt-4 font-display text-2xl font-semibold">{zh?'目前还没有外部客户':'No external Clients yet'}</h3><p className="mt-2 text-sm text-ink-muted">{zh?'未来替其他品牌或老板管理内容时，可在这里建立客户。':'Create a Client here when LKSoft begins managing content for another brand or founder.'}</p></div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleClients.map((client) => (
            <Card key={client.id} className="group flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">{client.code}</p><h3 className="mt-1 truncate font-display text-2xl font-semibold">{client.name}</h3></div>
                <StatusBadge tone={client.status === 'active' ? 'success' : 'neutral'}>{client.status}</StatusBadge>
              </div>
              <div className="grid grid-cols-2 gap-4 border-y border-line py-4 text-sm"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-faint">Industry</p><p className="mt-1 font-semibold">{client.industry || 'Not set'}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-ink-faint">Updated</p><p className="mt-1 font-semibold">{new Date(client.updated_at).toLocaleDateString()}</p></div></div>
              <p className="line-clamp-2 min-h-12 text-sm leading-6 text-ink-muted">{client.description || 'No description yet.'}</p>
              <div className="grid gap-2"><Button variant="secondary" onClick={()=>navigate('/editing-playbook',{state:{clientId:client.id,clientName:client.name}})}>剪辑规范 / Editing Playbook</Button>{canManage && client.status === 'active' ? <Button variant="secondary" onClick={() => openEditor(client)}><Pencil className="size-4" />Edit Client</Button> : null}</div>
            </Card>
          ))}
        </div>
      )}

      {editing !== undefined ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(undefined) }}>
          <section className="h-full w-full max-w-xl overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8" aria-label={editing ? 'Edit Client' : 'Create Client'}>
            <div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">{editing ? 'Client record' : 'New boundary'}</p><h3 className="mt-2 font-display text-3xl font-semibold">{editing ? `Edit ${editing.name}` : 'Create Client'}</h3></div><Button variant="ghost" size="icon" onClick={() => setEditing(undefined)} aria-label="Close"><X className="size-5" /></Button></div>
            <form className="mt-8 space-y-5" onSubmit={handleSave}>
              <FormField label="Client name" htmlFor="client-name" required><Input id="client-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
              <FormField label="Client code" htmlFor="client-code" required hint="Unique within this Workspace; stored in uppercase."><Input id="client-code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></FormField>
              <FormField label="Industry" htmlFor="client-industry"><Input id="client-industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></FormField>
              <FormField label="Description" htmlFor="client-description"><Textarea id="client-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
              <FormField label="Brand notes" htmlFor="client-notes" hint="Internal operational context; not Client-visible."><Textarea id="client-notes" value={form.brandNotes} onChange={(e) => setForm({ ...form, brandNotes: e.target.value })} /></FormField>
              <div className="flex flex-wrap gap-3 border-t border-line pt-6"><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : null}{editing ? 'Save changes' : 'Create Client'}</Button><Button variant="secondary" onClick={() => setEditing(undefined)}>Cancel</Button>{editing && isSuperAdmin ? <Button variant="danger" className="ml-auto" onClick={() => void handleArchive(editing)}><Archive className="size-4" />Archive</Button> : null}</div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
