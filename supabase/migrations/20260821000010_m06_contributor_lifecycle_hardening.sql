-- M06 hardening: contributor removal preserves history even after deactivation.

create or replace function public.enforce_content_contributor_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_workspace uuid; content_client uuid; role_workspace uuid;
begin
  select workspace_id, client_id into content_workspace, content_client
  from public.contents where id = new.content_id;
  select workspace_id into role_workspace
  from public.contribution_roles where id = new.contribution_role_id and is_active;
  if content_workspace is null or content_workspace is distinct from role_workspace then
    raise exception 'Contributor role must share the Content Workspace';
  end if;
  if tg_op = 'UPDATE'
     and old.content_id = new.content_id
     and old.user_profile_id = new.user_profile_id
     and old.contribution_role_id = new.contribution_role_id
     and new.status = 'removed' then
    return new;
  end if;
  if not (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = content_workspace
        and wm.user_profile_id = new.user_profile_id and wm.status = 'active'
        and (
          exists (
            select 1 from public.workspace_member_roles wmr
            join public.roles r on r.id = wmr.role_id
            where wmr.workspace_member_id = wm.id and r.code = 'super_admin' and r.is_active
          )
          or exists (
            select 1 from public.client_members cm
            where cm.workspace_member_id = wm.id and cm.client_id = content_client and cm.status = 'active'
          )
        )
    )
    or exists (
      select 1 from public.contents c
      join public.idea_contributors ic on ic.idea_id = c.source_idea_id
      where c.id = new.content_id
        and ic.user_profile_id = new.user_profile_id
        and ic.contribution_role_id = new.contribution_role_id
    )
  ) then
    raise exception 'Contributor must be authorized for the Content Client or retained from the source Idea';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_content_contributor_scope() from public, anon, authenticated;
