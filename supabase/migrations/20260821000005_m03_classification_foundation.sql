-- ContentOS M03: Classification foundation for References, Ideas, and later Content.

create table public.content_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid references public.clients (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid references public.clients (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''),
  is_active boolean not null default false,
  sort_order integer not null default 0
);

create table public.contribution_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  code text not null check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''),
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  constraint contribution_roles_workspace_code_key unique (workspace_id, code)
);

create unique index content_categories_scope_name_key
  on public.content_categories (workspace_id, client_id, lower(btrim(name))) nulls not distinct;
create unique index tags_scope_name_key
  on public.tags (workspace_id, client_id, lower(btrim(name))) nulls not distinct;
create index content_categories_workspace_active_idx on public.content_categories (workspace_id, client_id, sort_order) where is_active;
create index tags_workspace_active_idx on public.tags (workspace_id, client_id, sort_order) where is_active;
create index contribution_roles_workspace_active_idx on public.contribution_roles (workspace_id, sort_order) where is_active;

create trigger content_categories_set_updated_at before update on public.content_categories
for each row execute function public.set_updated_at();
create trigger tags_set_updated_at before update on public.tags
for each row execute function public.set_updated_at();

create or replace function public.enforce_scoped_lookup_client_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
declare client_workspace uuid;
begin
  if new.client_id is not null then
    select workspace_id into client_workspace from public.clients where id = new.client_id;
    if client_workspace is distinct from new.workspace_id then
      raise exception 'Lookup and Client must belong to the same Workspace';
    end if;
  end if;
  return new;
end; $$;

revoke all on function public.enforce_scoped_lookup_client_workspace() from public, anon, authenticated;
create trigger content_categories_client_scope before insert or update on public.content_categories
for each row execute function public.enforce_scoped_lookup_client_workspace();
create trigger tags_client_scope before insert or update on public.tags
for each row execute function public.enforce_scoped_lookup_client_workspace();

create or replace function public.has_research_role(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_workspace_super_admin(target_workspace_id)
    or public.has_workspace_role(target_workspace_id, 'internal_manager')
    or public.has_workspace_role(target_workspace_id, 'strategist_content_planner');
$$;

create or replace function public.can_manage_research_client(target_client_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clients c
    where c.id = target_client_id and c.status = 'active'
      and (
        public.is_workspace_super_admin(c.workspace_id)
        or (
          public.has_active_client_access(c.id)
          and (
            public.has_workspace_role(c.workspace_id, 'internal_manager')
            or public.has_workspace_role(c.workspace_id, 'strategist_content_planner')
          )
        )
      )
  );
$$;

create or replace function public.has_any_research_client_access(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_workspace_super_admin(target_workspace_id)
    or (
      (
        public.has_workspace_role(target_workspace_id, 'internal_manager')
        or public.has_workspace_role(target_workspace_id, 'strategist_content_planner')
      )
      and exists (
        select 1 from public.client_members cm
        join public.clients c on c.id = cm.client_id
        join public.workspace_members wm on wm.id = cm.workspace_member_id
        where c.workspace_id = target_workspace_id
          and c.status = 'active' and cm.status = 'active'
          and wm.status = 'active' and wm.user_profile_id = auth.uid()
      )
    );
$$;

revoke all on function public.has_research_role(uuid) from public, anon;
revoke all on function public.can_manage_research_client(uuid) from public, anon;
revoke all on function public.has_any_research_client_access(uuid) from public, anon;
grant execute on function public.has_research_role(uuid) to authenticated;
grant execute on function public.can_manage_research_client(uuid) to authenticated;
grant execute on function public.has_any_research_client_access(uuid) to authenticated;

alter table public.content_categories enable row level security;
alter table public.tags enable row level security;
alter table public.platforms enable row level security;
alter table public.contribution_roles enable row level security;

create policy "Research roles can view authorized categories" on public.content_categories
for select to authenticated using (
  (client_id is null and public.has_any_research_client_access(workspace_id))
  or (client_id is not null and public.can_manage_research_client(client_id))
);

create policy "Research roles can view authorized tags" on public.tags
for select to authenticated using (
  (client_id is null and public.has_any_research_client_access(workspace_id))
  or (client_id is not null and public.can_manage_research_client(client_id))
);

create policy "Internal members can view active platforms" on public.platforms
for select to authenticated using (
  is_active and exists (
    select 1 from public.workspace_members wm
    where wm.user_profile_id = auth.uid()
      and public.is_internal_workspace_member(wm.workspace_id)
  )
);

create policy "Research roles can view contribution roles" on public.contribution_roles
for select to authenticated using (public.has_any_research_client_access(workspace_id));

insert into public.platforms (id, code, name, is_active, sort_order) values
  ('00000000-0000-4000-8000-000000000201', 'facebook', 'Facebook', true, 10),
  ('00000000-0000-4000-8000-000000000202', 'xhs', 'Xiaohongshu', true, 20),
  ('00000000-0000-4000-8000-000000000203', 'instagram', 'Instagram', false, 30),
  ('00000000-0000-4000-8000-000000000204', 'tiktok', 'TikTok', false, 40),
  ('00000000-0000-4000-8000-000000000205', 'youtube', 'YouTube', false, 50)
on conflict (code) do update set name=excluded.name, is_active=excluded.is_active, sort_order=excluded.sort_order;

insert into public.content_categories (id, workspace_id, name, sort_order) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', '引流内容', 10),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', '老板 IP', 20),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', '转化 / 销售', 30),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000001', '办公室内容', 40),
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000001', '产品教育', 50),
  ('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000001', '客户案例', 60),
  ('00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000001', 'Workshop / Event', 70),
  ('00000000-0000-4000-8000-000000000308', '00000000-0000-4000-8000-000000000001', 'Promotion', 80)
on conflict do nothing;

insert into public.contribution_roles (id, workspace_id, code, name, sort_order) values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', 'idea_creator', 'Idea Creator', 10),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', 'strategist', 'Strategist', 20),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001', 'script_writer', 'Script Writer', 30),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000001', 'shooter', 'Shooter', 40),
  ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-000000000001', 'talent', 'On-camera Talent', 50),
  ('00000000-0000-4000-8000-000000000406', '00000000-0000-4000-8000-000000000001', 'editor', 'Editor', 60),
  ('00000000-0000-4000-8000-000000000407', '00000000-0000-4000-8000-000000000001', 'reviewer', 'Reviewer', 70),
  ('00000000-0000-4000-8000-000000000408', '00000000-0000-4000-8000-000000000001', 'cover_designer', 'Cover Designer', 80),
  ('00000000-0000-4000-8000-000000000409', '00000000-0000-4000-8000-000000000001', 'publisher', 'Publisher', 90),
  ('00000000-0000-4000-8000-000000000410', '00000000-0000-4000-8000-000000000001', 'analytics', 'Analytics / Strategy Review', 100),
  ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000001', 'client_communication', 'Client Communication', 110)
on conflict (workspace_id, code) do update set name=excluded.name, sort_order=excluded.sort_order, is_active=true;

-- Configuration writes remain Super Admin-only and will receive dedicated UI later.
-- Phase 4 feature RPCs may create scoped tags transactionally with their parent record.
