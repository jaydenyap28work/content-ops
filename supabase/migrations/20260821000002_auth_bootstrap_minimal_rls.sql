-- ContentOS Auth Bootstrap + Minimal Workspace RLS
-- Seeds only the internal Workspace and predefined roles. No Auth user,
-- password, credential, or business data is created by this migration.

insert into public.workspaces (id, name, status)
values ('00000000-0000-4000-8000-000000000001', 'ContentOS', 'active')
on conflict (id) do nothing;

insert into public.roles (id, workspace_id, code, name, description, is_active)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'super_admin', 'Super Admin', 'Workspace administration and audited override authority.', true),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'internal_manager', 'Internal Manager', 'Assigned Client operations, planning, and delivery management.', true),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'strategist_content_planner', 'Strategist / Content Planner', 'Reference, idea, topic, script, and production planning.', true),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'shooter', 'Shooter', 'Assigned shooting tasks and own shooting actions.', true),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'editor', 'Editor', 'Assigned editing tasks and own submissions.', true),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'publisher_marketing', 'Publisher / Marketing', 'Assigned publication and manual analytics work.', true),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'intern', 'Intern', 'Least-privilege access granted only for assigned work.', true),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', 'client_admin', 'Client Admin', 'Assigned Client access to client-visible data and designated approvals.', true),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000001', 'client_viewer', 'Client Viewer', 'Read-only access to explicitly shared Client-visible data.', true)
on conflict (workspace_id, code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function public.is_active_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as membership
    join public.user_profiles as profile
      on profile.id = membership.user_profile_id
    where membership.workspace_id = target_workspace_id
      and membership.user_profile_id = (select auth.uid())
      and membership.status = 'active'
      and profile.status = 'active'
  );
$$;

create or replace function public.is_own_active_workspace_member(target_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as membership
    join public.user_profiles as profile
      on profile.id = membership.user_profile_id
    where membership.id = target_membership_id
      and membership.user_profile_id = (select auth.uid())
      and membership.status = 'active'
      and profile.status = 'active'
  );
$$;

create or replace function public.is_workspace_super_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as membership
    join public.user_profiles as profile
      on profile.id = membership.user_profile_id
    join public.workspace_member_roles as member_role
      on member_role.workspace_member_id = membership.id
    join public.roles as role
      on role.id = member_role.role_id
    where membership.workspace_id = target_workspace_id
      and membership.user_profile_id = (select auth.uid())
      and membership.status = 'active'
      and profile.status = 'active'
      and role.workspace_id = target_workspace_id
      and role.code = 'super_admin'
      and role.is_active
  );
$$;

revoke all on function public.is_active_workspace_member(uuid) from public;
revoke all on function public.is_own_active_workspace_member(uuid) from public;
revoke all on function public.is_workspace_super_admin(uuid) from public;
grant execute on function public.is_active_workspace_member(uuid) to authenticated;
grant execute on function public.is_own_active_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_super_admin(uuid) to authenticated;

create policy "Authenticated members can view their active workspaces"
on public.workspaces
for select
to authenticated
using (
  status = 'active'
  and public.is_active_workspace_member(id)
);

create policy "Authenticated users can view their own profile"
on public.user_profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Authenticated users can view their own memberships"
on public.workspace_members
for select
to authenticated
using (user_profile_id = (select auth.uid()));

create policy "Active members can view workspace roles"
on public.roles
for select
to authenticated
using (public.is_active_workspace_member(workspace_id));

create policy "Active members can view the permission catalog"
on public.permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members as membership
    where membership.user_profile_id = (select auth.uid())
      and public.is_active_workspace_member(membership.workspace_id)
  )
);

create policy "Active members can view workspace role permissions"
on public.role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.roles as role
    where role.id = role_permissions.role_id
      and public.is_active_workspace_member(role.workspace_id)
  )
);

create policy "Active members can view their assigned roles"
on public.workspace_member_roles
for select
to authenticated
using (public.is_own_active_workspace_member(workspace_member_id));

-- No INSERT, UPDATE, or DELETE policies are added in this phase. Provisioning
-- remains an explicit trusted administrator action; browser clients fail closed.
