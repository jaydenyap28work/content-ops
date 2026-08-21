-- Run once in the Supabase SQL Editor only after the Auth user below has been
-- created manually and its email has been confirmed. This file contains no
-- password or credential and is intentionally not an automatic migration.

do $$
declare
  target_email constant text := 'jaydenyap28work@gmail.com';
  target_user_id uuid;
  target_workspace_id constant uuid := '00000000-0000-4000-8000-000000000001';
  target_role_id uuid;
  target_membership_id uuid;
begin
  select id
    into target_user_id
    from auth.users
   where lower(email) = lower(target_email)
     and email_confirmed_at is not null;

  if target_user_id is null then
    raise exception 'A confirmed Auth user for % must exist before binding', target_email;
  end if;

  select id
    into target_role_id
    from public.roles
   where workspace_id = target_workspace_id
     and code = 'super_admin'
     and is_active;

  if target_role_id is null then
    raise exception 'The ContentOS Super Admin role is not available';
  end if;

  if exists (
    select 1
      from public.workspace_member_roles as member_role
      join public.workspace_members as membership
        on membership.id = member_role.workspace_member_id
     where member_role.role_id = target_role_id
       and membership.user_profile_id <> target_user_id
  ) then
    raise exception 'An initial Super Admin is already bound to another Auth user';
  end if;

  insert into public.user_profiles (id, display_name, email, status)
  values (target_user_id, 'Jayden Yap', target_email, 'active')
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    email = excluded.email,
    updated_at = now();

  insert into public.workspace_members (workspace_id, user_profile_id, status)
  values (target_workspace_id, target_user_id, 'active')
  on conflict (workspace_id, user_profile_id) do nothing
  returning id into target_membership_id;

  if target_membership_id is null then
    select id
      into target_membership_id
      from public.workspace_members
     where workspace_id = target_workspace_id
       and user_profile_id = target_user_id;
  end if;

  if not exists (
    select 1
      from public.workspace_members
     where id = target_membership_id
       and status = 'active'
  ) then
    raise exception 'Existing Workspace membership is not active; review it manually';
  end if;

  insert into public.workspace_member_roles (
    workspace_member_id,
    role_id,
    assigned_by
  )
  values (target_membership_id, target_role_id, target_user_id)
  on conflict (workspace_member_id, role_id) do nothing;
end
$$;
