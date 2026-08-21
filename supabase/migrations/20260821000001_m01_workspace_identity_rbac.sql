-- ContentOS M01: Workspace Identity & RBAC Foundation
-- Schema only. This migration intentionally contains no business seed data.

create extension if not exists pgcrypto with schema extensions;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text not null check (btrim(display_name) <> ''),
  email text not null check (btrim(email) <> ''),
  avatar_url text,
  job_title text,
  status text not null default 'active'
    check (status in ('active', 'deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint user_profiles_deactivation_state_check check (
    (status = 'active' and deactivated_at is null)
    or (status = 'deactivated' and deactivated_at is not null)
  )
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  code text not null check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_workspace_code_key unique (workspace_id, code)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''),
  description text,
  is_active boolean not null default true,
  constraint permissions_code_key unique (code)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete restrict,
  permission_id uuid not null references public.permissions (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  user_profile_id uuid not null references public.user_profiles (id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'deactivated')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint workspace_members_workspace_user_key unique (workspace_id, user_profile_id),
  constraint workspace_members_deactivation_state_check check (
    (status = 'active' and deactivated_at is null)
    or (status = 'deactivated' and deactivated_at is not null)
  )
);

create table public.workspace_member_roles (
  workspace_member_id uuid not null references public.workspace_members (id) on delete restrict,
  role_id uuid not null references public.roles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid not null references public.user_profiles (id) on delete restrict,
  primary key (workspace_member_id, role_id)
);

create index roles_workspace_active_idx
  on public.roles (workspace_id)
  where is_active;

create index role_permissions_permission_id_idx
  on public.role_permissions (permission_id);

create index workspace_members_workspace_status_idx
  on public.workspace_members (workspace_id, status);

create index workspace_members_user_status_idx
  on public.workspace_members (user_profile_id, status);

create index workspace_member_roles_role_id_idx
  on public.workspace_member_roles (role_id);

create index workspace_member_roles_assigned_by_idx
  on public.workspace_member_roles (assigned_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

create or replace function public.enforce_workspace_member_role_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_workspace_id uuid;
  role_workspace_id uuid;
begin
  select workspace_id
    into member_workspace_id
    from public.workspace_members
   where id = new.workspace_member_id;

  select workspace_id
    into role_workspace_id
    from public.roles
   where id = new.role_id;

  if member_workspace_id is distinct from role_workspace_id then
    raise exception 'Workspace member and role must belong to the same workspace';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_workspace_member_role_scope() from public, anon, authenticated;

create trigger workspace_member_roles_scope_check
before insert or update on public.workspace_member_roles
for each row execute function public.enforce_workspace_member_role_scope();

alter table public.workspaces enable row level security;
alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_member_roles enable row level security;

-- TODO(M01 RLS): Add policies only after authenticated membership bootstrap,
-- role/permission checks, inactive denial, and service-side provisioning paths
-- are defined and can be tested together. With no policies, access through the
-- public anon/authenticated API remains fail-closed.
