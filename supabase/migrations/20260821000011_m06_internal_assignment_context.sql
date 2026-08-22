-- M06: assigned internal operators may read the Client-scoped lookup context
-- needed to render their Content tasks. Client roles remain excluded.

create or replace function public.has_any_internal_client_access(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_internal_workspace_member(target_workspace_id)
    and exists (
      select 1
      from public.client_members cm
      join public.clients c on c.id = cm.client_id
      join public.workspace_members wm on wm.id = cm.workspace_member_id
      where wm.workspace_id = target_workspace_id
        and wm.user_profile_id = auth.uid()
        and wm.status = 'active'
        and cm.status = 'active'
        and c.status = 'active'
    );
$$;

revoke all on function public.has_any_internal_client_access(uuid) from public, anon;
grant execute on function public.has_any_internal_client_access(uuid) to authenticated;

create policy "Assigned internal members can view Campaign context"
on public.campaigns for select to authenticated
using (public.is_internal_workspace_member(workspace_id) and public.has_active_client_access(client_id));

create policy "Assigned internal members can view Category context"
on public.content_categories for select to authenticated
using (
  public.is_internal_workspace_member(workspace_id)
  and (
    (client_id is not null and public.has_active_client_access(client_id))
    or (client_id is null and public.has_any_internal_client_access(workspace_id))
  )
);

create policy "Assigned internal members can view Tag context"
on public.tags for select to authenticated
using (
  public.is_internal_workspace_member(workspace_id)
  and (
    (client_id is not null and public.has_active_client_access(client_id))
    or (client_id is null and public.has_any_internal_client_access(workspace_id))
  )
);

create policy "Assigned internal members can view Contribution Role context"
on public.contribution_roles for select to authenticated
using (public.has_any_internal_client_access(workspace_id));
