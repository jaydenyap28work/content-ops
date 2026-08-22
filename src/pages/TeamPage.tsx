import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { LoaderCircle, MailPlus, Search, ShieldAlert, UserRoundCheck, Users, X } from 'lucide-react'
import { Button, Card, FormField, Input, Select, StatusBadge } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import {
  inviteUser, loadClients, loadRoles, loadTeam, setClientAccess,
  setMemberActive, setMemberRoles, updateMemberProfile,
} from '../features/admin/admin-api'
import type { ClientRecord, RoleRecord, TeamMemberRecord } from '../features/admin/admin-api'

export function TeamPage() {
  const { workspace, session } = useAuth()
  const [members, setMembers] = useState<TeamMemberRecord[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState({ email: '', displayName: '', jobTitle: '', roleIds: [] as string[], clientIds: [] as string[], clientAccessRoleId: '' })
  const [profile, setProfile] = useState({ displayName: '', jobTitle: '' })
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [accessDraft, setAccessDraft] = useState({ clientId: '', roleId: '' })

  const isSuperAdmin = workspace?.roles.includes('Super Admin') ?? false
  const selected = members.find((member) => member.membershipId === selectedId) ?? null

  const refresh = useCallback(async () => {
    if (!workspace || !isSuperAdmin) return
    setLoading(true)
    setError(null)
    try {
      const [nextMembers, nextRoles, nextClients] = await Promise.all([
        loadTeam(workspace.id), loadRoles(workspace.id), loadClients(workspace.id),
      ])
      setMembers(nextMembers)
      setRoles(nextRoles)
      setClients(nextClients.filter((client) => client.status === 'active'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load Team') }
    finally { setLoading(false) }
  }, [isSuperAdmin, workspace])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  function selectMember(member: TeamMemberRecord) {
    setSelectedId(member.membershipId)
    setProfile({ displayName: member.displayName, jobTitle: member.jobTitle ?? '' })
    setSelectedRoleIds(member.roleIds)
    setAccessDraft({ clientId: '', roleId: '' })
  }

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return members.filter((member) => !term || [member.displayName, member.email, member.jobTitle ?? ''].some((value) => value.toLowerCase().includes(term)))
  }, [members, search])

  if (!isSuperAdmin) {
    return <Card className="mx-auto mt-12 max-w-2xl text-center"><ShieldAlert className="mx-auto size-9 text-coral" /><h2 className="mt-4 font-display text-3xl font-semibold">Super Admin access required</h2><p className="mt-3 leading-7 text-ink-muted">Team, role, and Client access management is restricted by both the interface and database policies.</p></Card>
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true); setError(null); setNotice(null)
    try { await action(); setNotice(success); await refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Action failed') }
    finally { setBusy(false) }
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault()
    if (!workspace) return
    await runAction(() => inviteUser({ ...invite, workspaceId: workspace.id }), 'Invitation sent and Team access provisioned.')
    setInviteOpen(false)
    setInvite({ email: '', displayName: '', jobTitle: '', roleIds: [], clientIds: [], clientAccessRoleId: '' })
  }

  const activeAccess = selected?.clientAccess.filter((access) => access.status === 'active') ?? []

  return (
    <div className="page-enter space-y-6">
      <header className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.22em] text-coral">Administration / Team</p><h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Access with a clear owner.</h2><p className="mt-3 max-w-2xl leading-7 text-ink-soft">Invite people, assign predefined roles, and keep Client access deliberately scoped.</p></div>
        <Button onClick={() => setInviteOpen(true)}><MailPlus className="size-4" />Invite user</Button>
      </header>

      {error ? <div role="alert" className="rounded-lg border border-coral/30 bg-coral/8 px-4 py-3 text-sm text-coral-dark">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-green/25 bg-green/8 px-4 py-3 text-sm text-green">{notice}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line p-4"><label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Team" className="pl-10" /></label></div>
          {loading ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="size-6 animate-spin text-coral" /></div> : visibleMembers.length === 0 ? <div className="grid min-h-64 place-items-center text-center"><div><Users className="mx-auto size-8 text-ink-faint" /><p className="mt-3 font-semibold">No matching Team members</p></div></div> : (
            <div className="divide-y divide-line">
              {visibleMembers.map((member) => (
                <button key={member.membershipId} type="button" onClick={() => selectMember(member)} className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-canvas-raised sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-bold">{member.displayName}</p>{member.userId === session?.user.id ? <StatusBadge tone="info">You</StatusBadge> : null}</div><p className="mt-1 truncate text-sm text-ink-muted">{member.email}</p><p className="mt-2 text-xs font-semibold text-ink-faint">{member.roleIds.map((id) => roles.find((role) => role.id === id)?.name).filter(Boolean).join(' · ') || 'No role'}</p></div>
                  <div className="flex items-center gap-2 sm:justify-end"><StatusBadge tone={member.status === 'active' ? 'success' : 'critical'}>{member.status}</StatusBadge><span className="text-xs font-bold text-ink-faint">{member.clientAccess.filter((a) => a.status === 'active').length} Clients</span></div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card tone={selected ? 'default' : 'quiet'} className="h-fit xl:sticky xl:top-28">
          {!selected ? <div className="py-12 text-center"><UserRoundCheck className="mx-auto size-8 text-ink-faint" /><h3 className="mt-4 font-display text-2xl font-semibold">Select a Team member</h3><p className="mt-2 text-sm leading-6 text-ink-muted">Profile, role, status, and Client access controls appear here.</p></div> : (
            <div className="space-y-7">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">Member access</p><h3 className="mt-1 font-display text-3xl font-semibold">{selected.displayName}</h3><p className="mt-1 text-sm text-ink-muted">{selected.email}</p></div>

              <section className="space-y-4 border-t border-line pt-5"><h4 className="text-sm font-extrabold uppercase tracking-[0.14em]">Profile</h4><FormField label="Display name" htmlFor="member-name"><Input id="member-name" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} /></FormField><FormField label="Job title" htmlFor="member-title"><Input id="member-title" value={profile.jobTitle} onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })} /></FormField><Button size="sm" variant="secondary" disabled={busy} onClick={() => void runAction(() => updateMemberProfile(selected.membershipId, profile.displayName, profile.jobTitle), 'Profile updated.')}>Save profile</Button></section>

              <section className="space-y-3 border-t border-line pt-5"><h4 className="text-sm font-extrabold uppercase tracking-[0.14em]">Predefined roles</h4>{roles.map((role) => <label key={role.id} className="flex items-start gap-3 rounded-md border border-line p-3 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-coral" checked={selectedRoleIds.includes(role.id)} onChange={(e) => setSelectedRoleIds(e.target.checked ? [...selectedRoleIds, role.id] : selectedRoleIds.filter((id) => id !== role.id))} /><span><span className="font-bold">{role.name}</span><span className="mt-0.5 block text-xs text-ink-faint">{role.code}</span></span></label>)}<Button size="sm" variant="secondary" disabled={busy || selectedRoleIds.length === 0} onClick={() => void runAction(() => setMemberRoles(selected.membershipId, selectedRoleIds), 'Roles updated.')}>Save roles</Button></section>

              <section className="space-y-3 border-t border-line pt-5"><h4 className="text-sm font-extrabold uppercase tracking-[0.14em]">Client access</h4>{activeAccess.length === 0 ? <p className="text-sm text-ink-muted">No active Client access.</p> : activeAccess.map((access) => <div key={`${access.clientId}-${access.roleId}`} className="flex items-center justify-between gap-3 rounded-md border border-line p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{clients.find((client) => client.id === access.clientId)?.name ?? 'Client'}</p><p className="text-xs text-ink-faint">{roles.find((role) => role.id === access.roleId)?.name ?? 'Role'}</p></div><Button size="sm" variant="ghost" disabled={busy} onClick={() => void runAction(() => setClientAccess(access.clientId, selected.membershipId, access.roleId, false), 'Client access removed.')}>Remove</Button></div>)}
                <div className="grid gap-2"><Select aria-label="Client" value={accessDraft.clientId} onChange={(e) => setAccessDraft({ ...accessDraft, clientId: e.target.value })}><option value="">Choose Client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select><Select aria-label="Access role" value={accessDraft.roleId} onChange={(e) => setAccessDraft({ ...accessDraft, roleId: e.target.value })}><option value="">Choose access role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select><Button size="sm" variant="secondary" disabled={busy || !accessDraft.clientId || !accessDraft.roleId} onClick={() => void runAction(() => setClientAccess(accessDraft.clientId, selected.membershipId, accessDraft.roleId, true), 'Client access assigned.')}>Assign access</Button></div>
              </section>

              <section className="border-t border-line pt-5"><div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-extrabold uppercase tracking-[0.14em]">Account status</h4><p className="mt-1 text-xs text-ink-muted">Deactivation preserves records and revokes Client access.</p></div><Button size="sm" variant={selected.status === 'active' ? 'danger' : 'primary'} disabled={busy || selected.userId === session?.user.id} onClick={() => void runAction(() => setMemberActive(selected.membershipId, selected.status !== 'active'), selected.status === 'active' ? 'Member deactivated.' : 'Member activated.')}>{selected.status === 'active' ? 'Deactivate' : 'Activate'}</Button></div></section>
            </div>
          )}
        </Card>
      </div>

      {inviteOpen ? <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm"><section className="h-full w-full max-w-lg overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8"><div className="flex justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">Secure invitation</p><h3 className="mt-2 font-display text-3xl font-semibold">Invite Team member</h3></div><Button variant="ghost" size="icon" onClick={() => setInviteOpen(false)}><X className="size-5" /></Button></div><p className="mt-4 text-sm leading-6 text-ink-muted">Invite-only：对方必须使用相同 Email 登录（Google 或 Email/Password）。用户不能自行选择 Role，public registration 保持关闭。</p><form className="mt-7 space-y-5" onSubmit={handleInvite}><FormField label="Work email" htmlFor="invite-email" required><Input id="invite-email" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></FormField><FormField label="Display name" htmlFor="invite-name" required><Input id="invite-name" required value={invite.displayName} onChange={(e) => setInvite({ ...invite, displayName: e.target.value })} /></FormField><FormField label="Job title" htmlFor="invite-title"><Input id="invite-title" value={invite.jobTitle} onChange={(e) => setInvite({ ...invite, jobTitle: e.target.value })} /></FormField><fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Initial roles <span className="text-coral">*</span></legend>{roles.map((role) => <label key={role.id} className="flex gap-3 rounded-md border border-line p-3 text-sm font-bold"><input type="checkbox" className="size-4 accent-coral" checked={invite.roleIds.includes(role.id)} onChange={(e) => setInvite({ ...invite, roleIds: e.target.checked ? [...invite.roleIds, role.id] : invite.roleIds.filter((id) => id !== role.id) })} />{role.name}</label>)}</fieldset><fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Initial Client access</legend>{clients.map(client=><label key={client.id} className="flex gap-3 rounded-md border border-line p-3 text-sm font-bold"><input type="checkbox" checked={invite.clientIds.includes(client.id)} onChange={e=>setInvite({...invite,clientIds:e.target.checked?[...invite.clientIds,client.id]:invite.clientIds.filter(id=>id!==client.id)})} className="size-4 accent-coral"/>{client.name}</label>)}</fieldset>{invite.clientIds.length?<FormField label="Client access role" required><Select value={invite.clientAccessRoleId} onChange={e=>setInvite({...invite,clientAccessRoleId:e.target.value})}><option value="">Choose role for selected Clients</option>{roles.filter(role=>invite.roleIds.includes(role.id)).map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</Select></FormField>:null}<div className="flex gap-3 border-t border-line pt-5"><Button type="submit" disabled={busy || invite.roleIds.length === 0 || (invite.clientIds.length > 0 && !invite.clientAccessRoleId)}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}Send invitation</Button><Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button></div></form></section></div> : null}
    </div>
  )
}
