-- ContentOS M02: Users, Clients, and Client access.
-- Browser writes are exposed only through checked RPCs. No row can be hard deleted.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  code text not null check (btrim(code) <> ''),
  industry text,
  description text,
  brand_notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint clients_workspace_code_key unique (workspace_id, code),
  constraint clients_archive_state_check check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  workspace_member_id uuid not null references public.workspace_members (id) on delete restrict,
  role_id uuid not null references public.roles (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'deactivated')),
  assigned_at timestamptz not null default now(),
  assigned_by uuid not null references public.user_profiles (id) on delete restrict,
  deactivated_at timestamptz,
  constraint client_members_client_member_role_key unique (client_id, workspace_member_id, role_id),
  constraint client_members_deactivation_state_check check (
    (status = 'active' and deactivated_at is null)
    or (status = 'deactivated' and deactivated_at is not null)
  )
);

create index clients_workspace_status_idx on public.clients (workspace_id, status);
create index clients_workspace_name_idx on public.clients (workspace_id, name);
create index client_members_client_status_idx on public.client_members (client_id, status);
create index client_members_workspace_member_status_idx on public.client_members (workspace_member_id, status);
create index client_members_role_id_idx on public.client_members (role_id);
create index client_members_assigned_by_idx on public.client_members (assigned_by);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create or replace function public.enforce_client_member_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  client_workspace uuid;
  member_workspace uuid;
  role_workspace uuid;
begin
  select workspace_id into client_workspace from public.clients where id = new.client_id;
  select workspace_id into member_workspace from public.workspace_members where id = new.workspace_member_id;
  select workspace_id into role_workspace from public.roles where id = new.role_id;

  if client_workspace is null or member_workspace is null or role_workspace is null
     or client_workspace is distinct from member_workspace
     or client_workspace is distinct from role_workspace then
    raise exception 'Client, workspace member, and role must belong to the same workspace';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_client_member_scope() from public, anon, authenticated;

create trigger client_members_scope_check
before insert or update on public.client_members
for each row execute function public.enforce_client_member_scope();

create or replace function public.has_workspace_role(target_workspace_id uuid, target_role_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.user_profiles up on up.id = wm.user_profile_id
    join public.workspace_member_roles wmr on wmr.workspace_member_id = wm.id
    join public.roles r on r.id = wmr.role_id
    where wm.workspace_id = target_workspace_id
      and wm.user_profile_id = (select auth.uid())
      and wm.status = 'active'
      and up.status = 'active'
      and r.workspace_id = target_workspace_id
      and r.code = target_role_code
      and r.is_active
  );
$$;

create or replace function public.is_internal_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $contentos$
  select exists (
    select 1
    from public.workspace_members wm
    join public.user_profiles up on up.id = wm.user_profile_id
    join public.workspace_member_roles wmr on wmr.workspace_member_id = wm.id
    join public.roles r on r.id = wmr.role_id
    where wm.workspace_id = target_workspace_id
      and wm.user_profile_id = (select auth.uid())
      and wm.status = 'active'
      and up.status = 'active'
      and r.is_active
      and r.code not in ('client_admin', 'client_viewer')
  );
$contentos$;

create or replace function public.has_active_client_access(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.client_members cm
    join public.clients c on c.id = cm.client_id
    join public.workspace_members wm on wm.id = cm.workspace_member_id
    join public.user_profiles up on up.id = wm.user_profile_id
    join public.roles r on r.id = cm.role_id
    where cm.client_id = target_client_id
      and wm.user_profile_id = (select auth.uid())
      and cm.status = 'active'
      and wm.status = 'active'
      and up.status = 'active'
      and r.is_active
      and c.status = 'active'
  );
$$;

revoke all on function public.has_workspace_role(uuid, text) from public, anon;
revoke all on function public.is_internal_workspace_member(uuid) from public, anon;
revoke all on function public.has_active_client_access(uuid) from public, anon;
grant execute on function public.has_workspace_role(uuid, text) to authenticated;
grant execute on function public.is_internal_workspace_member(uuid) to authenticated;
grant execute on function public.has_active_client_access(uuid) to authenticated;

alter table public.clients enable row level security;
alter table public.client_members enable row level security;

create policy "Members can view authorized clients"
on public.clients for select to authenticated
using (
  public.is_workspace_super_admin(workspace_id)
  or (
    public.is_internal_workspace_member(workspace_id)
    and public.has_active_client_access(id)
  )
);

create policy "Members can view their own client access"
on public.client_members for select to authenticated
using (
  public.is_workspace_super_admin((select c.workspace_id from public.clients c where c.id = client_id))
  or public.is_own_active_workspace_member(workspace_member_id)
);

drop policy "Authenticated users can view their own profile" on public.user_profiles;
create policy "Members can view authorized profiles"
on public.user_profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.workspace_members target_wm
    where target_wm.user_profile_id = user_profiles.id
      and public.is_workspace_super_admin(target_wm.workspace_id)
  )
);

drop policy "Authenticated users can view their own memberships" on public.workspace_members;
create policy "Members can view authorized memberships"
on public.workspace_members for select to authenticated
using (
  user_profile_id = (select auth.uid())
  or public.is_workspace_super_admin(workspace_id)
);

drop policy "Active members can view their assigned roles" on public.workspace_member_roles;
create policy "Members can view authorized role assignments"
on public.workspace_member_roles for select to authenticated
using (
  public.is_own_active_workspace_member(workspace_member_id)
  or public.is_workspace_super_admin((select wm.workspace_id from public.workspace_members wm where wm.id = workspace_member_id))
);

create or replace function public.create_client(
  target_workspace_id uuid,
  client_name text,
  client_code text,
  client_industry text default null,
  client_description text default null,
  client_brand_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_client_id uuid;
  actor_membership_id uuid;
  actor_role_id uuid;
begin
  if not (
    public.is_workspace_super_admin(target_workspace_id)
    or public.has_workspace_role(target_workspace_id, 'internal_manager')
  ) then raise exception 'Insufficient permission to create Client'; end if;

  insert into public.clients (workspace_id, name, code, industry, description, brand_notes)
  values (
    target_workspace_id, btrim(client_name), upper(btrim(client_code)),
    nullif(btrim(client_industry), ''), nullif(btrim(client_description), ''),
    nullif(btrim(client_brand_notes), '')
  ) returning id into new_client_id;

  if public.has_workspace_role(target_workspace_id, 'internal_manager')
     and not public.is_workspace_super_admin(target_workspace_id) then
    select wm.id into actor_membership_id
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id and wm.user_profile_id = auth.uid() and wm.status = 'active';
    select r.id into actor_role_id from public.roles r
      where r.workspace_id = target_workspace_id and r.code = 'internal_manager' and r.is_active;
    insert into public.client_members (client_id, workspace_member_id, role_id, assigned_by)
    values (new_client_id, actor_membership_id, actor_role_id, auth.uid());
  end if;
  return new_client_id;
end;
$$;

create or replace function public.update_client(
  target_client_id uuid,
  client_name text,
  client_code text,
  client_industry text default null,
  client_description text default null,
  client_brand_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare client_workspace uuid; client_status text;
begin
  select workspace_id, status into client_workspace, client_status from public.clients where id = target_client_id;
  if client_workspace is null then raise exception 'Client not found'; end if;
  if client_status <> 'active' then raise exception 'Archived Client cannot be edited'; end if;
  if not (
    public.is_workspace_super_admin(client_workspace)
    or (public.has_workspace_role(client_workspace, 'internal_manager') and public.has_active_client_access(target_client_id))
  ) then raise exception 'Insufficient permission to edit Client'; end if;

  update public.clients set
    name = btrim(client_name), code = upper(btrim(client_code)),
    industry = nullif(btrim(client_industry), ''),
    description = nullif(btrim(client_description), ''),
    brand_notes = nullif(btrim(client_brand_notes), '')
  where id = target_client_id;
end;
$$;

create or replace function public.archive_client(target_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare client_workspace uuid;
begin
  select workspace_id into client_workspace from public.clients where id = target_client_id;
  if client_workspace is null then raise exception 'Client not found'; end if;
  if not public.is_workspace_super_admin(client_workspace) then
    raise exception 'Only Super Admin can archive Client';
  end if;
  update public.clients set status = 'archived', archived_at = coalesce(archived_at, now())
  where id = target_client_id and status = 'active';
end;
$$;

create or replace function public.admin_update_user_profile(
  target_workspace_member_id uuid,
  target_display_name text,
  target_job_title text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare target_workspace uuid; target_user uuid;
begin
  select workspace_id, user_profile_id into target_workspace, target_user
  from public.workspace_members where id = target_workspace_member_id;
  if target_workspace is null or not public.is_workspace_super_admin(target_workspace) then
    raise exception 'Only Super Admin can edit Team profiles';
  end if;
  update public.user_profiles set display_name = btrim(target_display_name), job_title = nullif(btrim(target_job_title), '')
  where id = target_user;
end; $$;

create or replace function public.admin_set_member_active(target_workspace_member_id uuid, make_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare target_workspace uuid; target_user uuid;
begin
  select workspace_id, user_profile_id into target_workspace, target_user
  from public.workspace_members where id = target_workspace_member_id;
  if target_workspace is null or not public.is_workspace_super_admin(target_workspace) then
    raise exception 'Only Super Admin can change Team status';
  end if;
  if target_user = auth.uid() and not make_active then raise exception 'You cannot deactivate your own access'; end if;
  update public.workspace_members set status = case when make_active then 'active' else 'deactivated' end,
    deactivated_at = case when make_active then null else now() end where id = target_workspace_member_id;
  update public.user_profiles set status = case when make_active then 'active' else 'deactivated' end,
    deactivated_at = case when make_active then null else now() end where id = target_user;
  if not make_active then
    update public.client_members set status = 'deactivated', deactivated_at = now()
    where workspace_member_id = target_workspace_member_id and status = 'active';
  end if;
end; $$;

create or replace function public.admin_set_member_roles(target_workspace_member_id uuid, target_role_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare target_workspace uuid; super_role_id uuid; target_had_super boolean; target_keeps_super boolean;
begin
  select workspace_id into target_workspace from public.workspace_members where id = target_workspace_member_id;
  if target_workspace is null or not public.is_workspace_super_admin(target_workspace) then
    raise exception 'Only Super Admin can assign roles';
  end if;
  if coalesce(array_length(target_role_ids, 1), 0) = 0 then raise exception 'At least one role is required'; end if;
  if exists (select 1 from unnest(target_role_ids) role_id left join public.roles r on r.id = role_id
    where r.id is null or r.workspace_id <> target_workspace or not r.is_active) then
    raise exception 'Every role must be active and belong to the Workspace';
  end if;
  select id into super_role_id from public.roles where workspace_id = target_workspace and code = 'super_admin';
  target_had_super := exists (select 1 from public.workspace_member_roles where workspace_member_id = target_workspace_member_id and role_id = super_role_id);
  target_keeps_super := super_role_id = any(target_role_ids);
  if target_had_super and not target_keeps_super and not exists (
    select 1 from public.workspace_member_roles wmr join public.workspace_members wm on wm.id = wmr.workspace_member_id
    where wmr.role_id = super_role_id and wmr.workspace_member_id <> target_workspace_member_id and wm.status = 'active'
  ) then raise exception 'Workspace must retain at least one active Super Admin'; end if;
  delete from public.workspace_member_roles where workspace_member_id = target_workspace_member_id and not (role_id = any(target_role_ids));
  insert into public.workspace_member_roles (workspace_member_id, role_id, assigned_by)
  select target_workspace_member_id, role_id, auth.uid() from unnest(target_role_ids) role_id
  on conflict (workspace_member_id, role_id) do nothing;
end; $$;

create or replace function public.admin_set_client_access(
  target_client_id uuid,
  target_workspace_member_id uuid,
  target_role_id uuid,
  make_active boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare target_workspace uuid;
begin
  select workspace_id into target_workspace from public.clients where id = target_client_id;
  if target_workspace is null or not public.is_workspace_super_admin(target_workspace) then
    raise exception 'Only Super Admin can manage Client access';
  end if;
  if not exists (select 1 from public.workspace_members where id = target_workspace_member_id and workspace_id = target_workspace) then
    raise exception 'Workspace member does not belong to this Client Workspace';
  end if;
  if not exists (select 1 from public.roles where id = target_role_id and workspace_id = target_workspace and is_active) then
    raise exception 'Role does not belong to this Client Workspace';
  end if;
  insert into public.client_members (client_id, workspace_member_id, role_id, status, assigned_by, deactivated_at)
  values (target_client_id, target_workspace_member_id, target_role_id,
    case when make_active then 'active' else 'deactivated' end, auth.uid(),
    case when make_active then null else now() end)
  on conflict (client_id, workspace_member_id, role_id) do update set
    status = excluded.status, assigned_by = auth.uid(), assigned_at = now(), deactivated_at = excluded.deactivated_at;
end; $$;

create or replace function public.provision_invited_user(
  invited_user_id uuid,
  invited_email text,
  invited_display_name text,
  invited_job_title text,
  target_workspace_id uuid,
  target_role_ids uuid[],
  actor_user_id uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_membership_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if coalesce(array_length(target_role_ids, 1), 0) = 0 then raise exception 'At least one role is required'; end if;
  if not exists (select 1 from public.user_profiles actor join public.workspace_members wm on wm.user_profile_id = actor.id
    join public.workspace_member_roles wmr on wmr.workspace_member_id = wm.id join public.roles r on r.id = wmr.role_id
    where actor.id = actor_user_id and wm.workspace_id = target_workspace_id and actor.status = 'active'
      and wm.status = 'active' and r.code = 'super_admin' and r.is_active) then
    raise exception 'Actor is not an active Super Admin';
  end if;
  if exists (select 1 from unnest(target_role_ids) role_id left join public.roles r on r.id = role_id
    where r.id is null or r.workspace_id <> target_workspace_id or not r.is_active) then
    raise exception 'Every role must be active and belong to the Workspace';
  end if;
  insert into public.user_profiles (id, display_name, email, job_title)
  values (invited_user_id, btrim(invited_display_name), lower(btrim(invited_email)), nullif(btrim(invited_job_title), ''));
  insert into public.workspace_members (workspace_id, user_profile_id)
  values (target_workspace_id, invited_user_id) returning id into new_membership_id;
  insert into public.workspace_member_roles (workspace_member_id, role_id, assigned_by)
  select new_membership_id, role_id, actor_user_id from unnest(target_role_ids) role_id;
  return new_membership_id;
end; $$;

revoke all on function public.create_client(uuid,text,text,text,text,text) from public, anon;
revoke all on function public.update_client(uuid,text,text,text,text,text) from public, anon;
revoke all on function public.archive_client(uuid) from public, anon;
revoke all on function public.admin_update_user_profile(uuid,text,text) from public, anon;
revoke all on function public.admin_set_member_active(uuid,boolean) from public, anon;
revoke all on function public.admin_set_member_roles(uuid,uuid[]) from public, anon;
revoke all on function public.admin_set_client_access(uuid,uuid,uuid,boolean) from public, anon;
revoke all on function public.provision_invited_user(uuid,text,text,text,uuid,uuid[],uuid) from public, anon, authenticated;

grant execute on function public.create_client(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.update_client(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.archive_client(uuid) to authenticated;
grant execute on function public.admin_update_user_profile(uuid,text,text) to authenticated;
grant execute on function public.admin_set_member_active(uuid,boolean) to authenticated;
grant execute on function public.admin_set_member_roles(uuid,uuid[]) to authenticated;
grant execute on function public.admin_set_client_access(uuid,uuid,uuid,boolean) to authenticated;
grant execute on function public.provision_invited_user(uuid,text,text,text,uuid,uuid[],uuid) to service_role;

-- Deliberately no DELETE policies. Full mutation audit events begin with M06,
-- when the activity_logs table exists; Supabase Auth retains invite delivery logs.
