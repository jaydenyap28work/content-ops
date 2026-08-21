-- ContentOS M04: References, Ideas, and normalized provenance.

create table public.references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid references public.clients (id) on delete restrict,
  reference_type text not null default 'content' check (reference_type in ('account', 'content')),
  parent_reference_id uuid references public.references (id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  account_name text,
  platform_id uuid references public.platforms (id) on delete restrict,
  url text not null check (btrim(url) <> ''),
  industry text,
  country text,
  content_style text,
  format text,
  why_it_works text,
  learning_notes text,
  gold_standard boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint references_archive_state_check check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create table public.reference_clients (
  reference_id uuid not null references public.references (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  primary key (reference_id, client_id)
);

create table public.reference_tags (
  reference_id uuid not null references public.references (id) on delete restrict,
  tag_id uuid not null references public.tags (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (reference_id, tag_id)
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  source_url text,
  original_topic text,
  original_hook text,
  why_it_works text,
  our_angle text,
  category_id uuid references public.content_categories (id) on delete restrict,
  suggested_format text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'evaluating', 'approved', 'converted', 'rejected', 'archived')),
  owner_user_id uuid references public.user_profiles (id) on delete restrict,
  notes text,
  status_reason text,
  created_by uuid not null references public.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ideas_archive_state_check check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived' and archived_at is null)
  )
);

create table public.idea_references (
  idea_id uuid not null references public.ideas (id) on delete restrict,
  reference_id uuid not null references public.references (id) on delete restrict,
  relationship_notes text,
  created_at timestamptz not null default now(),
  primary key (idea_id, reference_id)
);

create table public.idea_contributors (
  idea_id uuid not null references public.ideas (id) on delete restrict,
  user_profile_id uuid not null references public.user_profiles (id) on delete restrict,
  contribution_role_id uuid not null references public.contribution_roles (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_profile_id, contribution_role_id)
);

-- Explicit Phase 4 requirement: Ideas need normalized Tags.
create table public.idea_tags (
  idea_id uuid not null references public.ideas (id) on delete restrict,
  tag_id uuid not null references public.tags (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (idea_id, tag_id)
);

create index references_workspace_status_idx on public.references (workspace_id, status, updated_at desc);
create index references_client_status_idx on public.references (client_id, status) where client_id is not null;
create index references_platform_idx on public.references (platform_id);
create index references_url_idx on public.references (workspace_id, url);
create index reference_clients_client_idx on public.reference_clients (client_id, reference_id);
create index reference_tags_tag_idx on public.reference_tags (tag_id, reference_id);
create index ideas_client_status_idx on public.ideas (client_id, status, updated_at desc);
create index ideas_workspace_updated_idx on public.ideas (workspace_id, updated_at desc);
create index ideas_category_idx on public.ideas (category_id);
create index ideas_owner_idx on public.ideas (owner_user_id);
create index idea_references_reference_idx on public.idea_references (reference_id, idea_id);
create index idea_contributors_user_idx on public.idea_contributors (user_profile_id, idea_id);
create index idea_contributors_role_idx on public.idea_contributors (contribution_role_id);
create index idea_tags_tag_idx on public.idea_tags (tag_id, idea_id);

create trigger references_set_updated_at before update on public.references
for each row execute function public.set_updated_at();
create trigger ideas_set_updated_at before update on public.ideas
for each row execute function public.set_updated_at();

create or replace function public.enforce_reference_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare linked_workspace uuid; parent_workspace uuid; parent_type text;
begin
  if new.client_id is not null then
    select workspace_id into linked_workspace from public.clients where id = new.client_id;
    if linked_workspace is distinct from new.workspace_id then raise exception 'Reference and Client must share a Workspace'; end if;
  end if;
  if new.parent_reference_id is not null then
    select workspace_id, reference_type into parent_workspace, parent_type from public.references where id = new.parent_reference_id;
    if new.reference_type <> 'content' or parent_type <> 'account' or parent_workspace is distinct from new.workspace_id then
      raise exception 'Content Reference parent must be an Account Reference in the same Workspace';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.enforce_reference_client_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ref_workspace uuid; client_workspace uuid;
begin
  select workspace_id into ref_workspace from public.references where id=new.reference_id;
  select workspace_id into client_workspace from public.clients where id=new.client_id;
  if ref_workspace is null or ref_workspace is distinct from client_workspace then raise exception 'Reference and related Client must share a Workspace'; end if;
  return new;
end; $$;

create or replace function public.enforce_reference_tag_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ref_workspace uuid; ref_client uuid; tag_workspace uuid; tag_client uuid;
begin
  select workspace_id, client_id into ref_workspace, ref_client from public.references where id=new.reference_id;
  select workspace_id, client_id into tag_workspace, tag_client from public.tags where id=new.tag_id;
  if ref_workspace is null or ref_workspace is distinct from tag_workspace or (tag_client is not null and tag_client is distinct from ref_client) then
    raise exception 'Tag scope does not cover this Reference';
  end if;
  return new;
end; $$;

create or replace function public.enforce_idea_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare client_workspace uuid; category_workspace uuid; category_client uuid;
begin
  select workspace_id into client_workspace from public.clients where id=new.client_id;
  if client_workspace is null or client_workspace is distinct from new.workspace_id then raise exception 'Idea and Client must share a Workspace'; end if;
  if new.category_id is not null then
    select workspace_id, client_id into category_workspace, category_client from public.content_categories where id=new.category_id and is_active;
    if category_workspace is distinct from new.workspace_id or (category_client is not null and category_client is distinct from new.client_id) then
      raise exception 'Category scope does not cover this Idea';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.enforce_idea_reference_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare idea_workspace uuid; idea_client uuid; ref_workspace uuid; ref_client uuid;
begin
  select workspace_id, client_id into idea_workspace, idea_client from public.ideas where id=new.idea_id;
  select workspace_id, client_id into ref_workspace, ref_client from public.references where id=new.reference_id;
  if idea_workspace is null or idea_workspace is distinct from ref_workspace
     or not (ref_client is null or ref_client=idea_client or exists (
       select 1 from public.reference_clients rc where rc.reference_id=new.reference_id and rc.client_id=idea_client
     )) then raise exception 'Reference scope does not cover this Idea Client'; end if;
  return new;
end; $$;

create or replace function public.enforce_idea_contributor_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare idea_workspace uuid; idea_client uuid; role_workspace uuid;
begin
  select workspace_id, client_id into idea_workspace, idea_client from public.ideas where id=new.idea_id;
  select workspace_id into role_workspace from public.contribution_roles where id=new.contribution_role_id and is_active;
  if idea_workspace is null or idea_workspace is distinct from role_workspace or not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id=idea_workspace and wm.user_profile_id=new.user_profile_id and wm.status='active'
      and (
        exists (select 1 from public.workspace_member_roles wmr join public.roles r on r.id=wmr.role_id where wmr.workspace_member_id=wm.id and r.code='super_admin' and r.is_active)
        or exists (select 1 from public.client_members cm where cm.workspace_member_id=wm.id and cm.client_id=idea_client and cm.status='active')
      )
  ) then raise exception 'Contributor must be an active authorized member of the Idea Client'; end if;
  return new;
end; $$;

create or replace function public.enforce_idea_tag_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare idea_workspace uuid; idea_client uuid; tag_workspace uuid; tag_client uuid;
begin
  select workspace_id, client_id into idea_workspace, idea_client from public.ideas where id=new.idea_id;
  select workspace_id, client_id into tag_workspace, tag_client from public.tags where id=new.tag_id;
  if idea_workspace is null or idea_workspace is distinct from tag_workspace or (tag_client is not null and tag_client is distinct from idea_client) then
    raise exception 'Tag scope does not cover this Idea';
  end if;
  return new;
end; $$;

revoke all on function public.enforce_reference_scope() from public, anon, authenticated;
revoke all on function public.enforce_reference_client_scope() from public, anon, authenticated;
revoke all on function public.enforce_reference_tag_scope() from public, anon, authenticated;
revoke all on function public.enforce_idea_scope() from public, anon, authenticated;
revoke all on function public.enforce_idea_reference_scope() from public, anon, authenticated;
revoke all on function public.enforce_idea_contributor_scope() from public, anon, authenticated;
revoke all on function public.enforce_idea_tag_scope() from public, anon, authenticated;

create trigger references_scope_check before insert or update on public.references for each row execute function public.enforce_reference_scope();
create trigger reference_clients_scope_check before insert or update on public.reference_clients for each row execute function public.enforce_reference_client_scope();
create trigger reference_tags_scope_check before insert or update on public.reference_tags for each row execute function public.enforce_reference_tag_scope();
create trigger ideas_scope_check before insert or update on public.ideas for each row execute function public.enforce_idea_scope();
create trigger idea_references_scope_check before insert or update on public.idea_references for each row execute function public.enforce_idea_reference_scope();
create trigger idea_contributors_scope_check before insert or update on public.idea_contributors for each row execute function public.enforce_idea_contributor_scope();
create trigger idea_tags_scope_check before insert or update on public.idea_tags for each row execute function public.enforce_idea_tag_scope();

create or replace function public.can_view_reference(target_reference_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.references ref
    where ref.id=target_reference_id and (
      public.is_workspace_super_admin(ref.workspace_id)
      or (public.has_research_role(ref.workspace_id) and (
        (ref.client_id is not null and public.can_manage_research_client(ref.client_id))
        or exists (select 1 from public.reference_clients rc where rc.reference_id=ref.id and public.can_manage_research_client(rc.client_id))
      ))
    )
  );
$$;

create or replace function public.can_view_idea(target_idea_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ideas i where i.id=target_idea_id and public.can_manage_research_client(i.client_id));
$$;

revoke all on function public.can_view_reference(uuid) from public, anon;
revoke all on function public.can_view_idea(uuid) from public, anon;
grant execute on function public.can_view_reference(uuid) to authenticated;
grant execute on function public.can_view_idea(uuid) to authenticated;

alter table public.references enable row level security;
alter table public.reference_clients enable row level security;
alter table public.reference_tags enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_references enable row level security;
alter table public.idea_contributors enable row level security;
alter table public.idea_tags enable row level security;

create policy "Research roles can view authorized References" on public.references for select to authenticated using (public.can_view_reference(id));
create policy "Research roles can view authorized Reference Clients" on public.reference_clients for select to authenticated using (public.can_view_reference(reference_id) and public.can_manage_research_client(client_id));
create policy "Research roles can view authorized Reference Tags" on public.reference_tags for select to authenticated using (public.can_view_reference(reference_id));
create policy "Research roles can view authorized Ideas" on public.ideas for select to authenticated using (public.can_view_idea(id));
create policy "Research roles can view Idea provenance" on public.idea_references for select to authenticated using (public.can_view_idea(idea_id));
create policy "Research roles can view Idea contributors" on public.idea_contributors for select to authenticated using (public.can_view_idea(idea_id));
create policy "Research roles can view Idea Tags" on public.idea_tags for select to authenticated using (public.can_view_idea(idea_id));

create or replace function public.save_reference(
  target_reference_id uuid,
  target_workspace_id uuid,
  target_client_id uuid,
  target_reference_type text,
  target_title text,
  target_account_name text,
  target_platform_id uuid,
  target_url text,
  target_industry text,
  target_country text,
  target_content_style text,
  target_format text,
  target_why_it_works text,
  target_learning_notes text,
  target_gold_standard boolean,
  target_related_client_ids uuid[],
  target_tag_names text[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_id uuid; existing_workspace uuid; existing_client uuid; related_client uuid; tag_name text; tag_id uuid;
begin
  if target_reference_id is null then
    if target_client_id is null then
      if not public.is_workspace_super_admin(target_workspace_id) then raise exception 'Only Super Admin can create Workspace-wide References'; end if;
    elsif not public.can_manage_research_client(target_client_id) then raise exception 'Reference Client access denied'; end if;
    insert into public.references (workspace_id,client_id,reference_type,title,account_name,platform_id,url,industry,country,content_style,format,why_it_works,learning_notes,gold_standard,created_by)
    values (target_workspace_id,target_client_id,target_reference_type,btrim(target_title),nullif(btrim(target_account_name),''),target_platform_id,btrim(target_url),nullif(btrim(target_industry),''),nullif(btrim(target_country),''),nullif(btrim(target_content_style),''),nullif(btrim(target_format),''),nullif(btrim(target_why_it_works),''),nullif(btrim(target_learning_notes),''),target_gold_standard,auth.uid()) returning id into saved_id;
  else
    select workspace_id,client_id into existing_workspace,existing_client from public.references where id=target_reference_id;
    if existing_workspace is null then raise exception 'Reference not found'; end if;
    if existing_client is null then
      if not public.is_workspace_super_admin(existing_workspace) then raise exception 'Only Super Admin can edit Workspace-wide References'; end if;
    elsif not public.can_manage_research_client(existing_client) then raise exception 'Reference Client access denied'; end if;
    if target_workspace_id<>existing_workspace or target_client_id is distinct from existing_client then raise exception 'Reference ownership scope cannot be changed'; end if;
    update public.references set reference_type=target_reference_type,title=btrim(target_title),account_name=nullif(btrim(target_account_name),''),platform_id=target_platform_id,url=btrim(target_url),industry=nullif(btrim(target_industry),''),country=nullif(btrim(target_country),''),content_style=nullif(btrim(target_content_style),''),format=nullif(btrim(target_format),''),why_it_works=nullif(btrim(target_why_it_works),''),learning_notes=nullif(btrim(target_learning_notes),''),gold_standard=target_gold_standard where id=target_reference_id and status='active';
    saved_id:=target_reference_id;
  end if;
  foreach related_client in array coalesce(target_related_client_ids,'{}'::uuid[]) loop
    if not public.can_manage_research_client(related_client) then raise exception 'Related Client access denied'; end if;
    insert into public.reference_clients(reference_id,client_id) values(saved_id,related_client) on conflict do nothing;
  end loop;
  delete from public.reference_clients rc where rc.reference_id=saved_id and not (rc.client_id=any(coalesce(target_related_client_ids,'{}'::uuid[])))
    and not exists (select 1 from public.idea_references ir join public.ideas i on i.id=ir.idea_id where ir.reference_id=saved_id and i.client_id=rc.client_id);
  delete from public.reference_tags where reference_id=saved_id;
  foreach tag_name in array coalesce(target_tag_names,'{}'::text[]) loop
    if btrim(tag_name)<>'' then
      select id into tag_id from public.tags where workspace_id=target_workspace_id and client_id is not distinct from target_client_id and lower(btrim(name))=lower(btrim(tag_name)) limit 1;
      if tag_id is null then insert into public.tags(workspace_id,client_id,name) values(target_workspace_id,target_client_id,btrim(tag_name)) on conflict do nothing returning id into tag_id; end if;
      if tag_id is null then select id into tag_id from public.tags where workspace_id=target_workspace_id and client_id is not distinct from target_client_id and lower(btrim(name))=lower(btrim(tag_name)) limit 1; end if;
      insert into public.reference_tags(reference_id,tag_id) values(saved_id,tag_id) on conflict do nothing;
    end if;
  end loop;
  return saved_id;
end; $$;

create or replace function public.archive_reference(target_reference_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare ref_workspace uuid; ref_client uuid;
begin
  select workspace_id,client_id into ref_workspace,ref_client from public.references where id=target_reference_id;
  if ref_workspace is null then raise exception 'Reference not found'; end if;
  if (ref_client is null and not public.is_workspace_super_admin(ref_workspace)) or (ref_client is not null and not public.can_manage_research_client(ref_client)) then raise exception 'Reference archive access denied'; end if;
  update public.references set status='archived',archived_at=coalesce(archived_at,now()) where id=target_reference_id and status='active';
end; $$;

create or replace function public.save_idea(
  target_idea_id uuid,
  target_workspace_id uuid,
  target_client_id uuid,
  target_title text,
  target_source_url text,
  target_original_topic text,
  target_original_hook text,
  target_why_it_works text,
  target_our_angle text,
  target_category_id uuid,
  target_suggested_format text,
  target_priority text,
  target_owner_user_id uuid,
  target_notes text,
  target_reference_ids uuid[],
  target_tag_names text[],
  target_contributors jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_id uuid; existing_client uuid; existing_status text; reference_id uuid; tag_name text; tag_id uuid; item jsonb; is_new boolean := target_idea_id is null;
begin
  if not public.can_manage_research_client(target_client_id) then raise exception 'Idea Client access denied'; end if;
  if target_idea_id is null then
    insert into public.ideas(workspace_id,client_id,title,source_url,original_topic,original_hook,why_it_works,our_angle,category_id,suggested_format,priority,owner_user_id,notes,created_by)
    values(target_workspace_id,target_client_id,btrim(target_title),nullif(btrim(target_source_url),''),nullif(btrim(target_original_topic),''),nullif(btrim(target_original_hook),''),nullif(btrim(target_why_it_works),''),nullif(btrim(target_our_angle),''),target_category_id,nullif(btrim(target_suggested_format),''),target_priority,coalesce(target_owner_user_id,auth.uid()),nullif(btrim(target_notes),''),auth.uid()) returning id into saved_id;
  else
    select client_id,status into existing_client,existing_status from public.ideas where id=target_idea_id;
    if existing_client is null or existing_client<>target_client_id then raise exception 'Idea ownership scope cannot be changed'; end if;
    if existing_status in ('converted','archived') then raise exception 'Converted or archived Idea cannot be edited'; end if;
    update public.ideas set title=btrim(target_title),source_url=nullif(btrim(target_source_url),''),original_topic=nullif(btrim(target_original_topic),''),original_hook=nullif(btrim(target_original_hook),''),why_it_works=nullif(btrim(target_why_it_works),''),our_angle=nullif(btrim(target_our_angle),''),category_id=target_category_id,suggested_format=nullif(btrim(target_suggested_format),''),priority=target_priority,owner_user_id=coalesce(target_owner_user_id,owner_user_id),notes=nullif(btrim(target_notes),'') where id=target_idea_id;
    saved_id:=target_idea_id;
  end if;
  foreach reference_id in array coalesce(target_reference_ids,'{}'::uuid[]) loop
    if not public.can_view_reference(reference_id) then raise exception 'Source Reference access denied'; end if;
    insert into public.idea_references(idea_id,reference_id) values(saved_id,reference_id) on conflict do nothing;
  end loop;
  delete from public.idea_tags where idea_id=saved_id;
  foreach tag_name in array coalesce(target_tag_names,'{}'::text[]) loop
    if btrim(tag_name)<>'' then
      select id into tag_id from public.tags where workspace_id=target_workspace_id and client_id is not distinct from target_client_id and lower(btrim(name))=lower(btrim(tag_name)) limit 1;
      if tag_id is null then insert into public.tags(workspace_id,client_id,name) values(target_workspace_id,target_client_id,btrim(tag_name)) on conflict do nothing returning id into tag_id; end if;
      if tag_id is null then select id into tag_id from public.tags where workspace_id=target_workspace_id and client_id is not distinct from target_client_id and lower(btrim(name))=lower(btrim(tag_name)) limit 1; end if;
      insert into public.idea_tags(idea_id,tag_id) values(saved_id,tag_id) on conflict do nothing;
    end if;
  end loop;
  delete from public.idea_contributors where idea_id=saved_id;
  for item in select * from jsonb_array_elements(coalesce(target_contributors,'[]'::jsonb)) loop
    insert into public.idea_contributors(idea_id,user_profile_id,contribution_role_id,notes)
    values(saved_id,(item->>'userId')::uuid,(item->>'roleId')::uuid,nullif(btrim(item->>'notes'),'')) on conflict do nothing;
  end loop;
  if is_new then
    insert into public.idea_contributors(idea_id,user_profile_id,contribution_role_id,notes)
    select saved_id,auth.uid(),id,'Idea creator' from public.contribution_roles
    where workspace_id=target_workspace_id and code='idea_creator' and is_active
    on conflict do nothing;
  end if;
  return saved_id;
end; $$;

create or replace function public.create_idea_from_reference(
  target_reference_id uuid,
  target_workspace_id uuid,
  target_client_id uuid,
  target_title text,
  target_our_angle text,
  target_category_id uuid,
  target_priority text,
  target_notes text,
  target_tag_names text[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare ref_url text; ref_title text; ref_why text;
begin
  if not public.can_view_reference(target_reference_id) or not public.can_manage_research_client(target_client_id) then raise exception 'Reference conversion access denied'; end if;
  select url,title,why_it_works into ref_url,ref_title,ref_why from public.references where id=target_reference_id;
  return public.save_idea(null,target_workspace_id,target_client_id,target_title,ref_url,ref_title,null,ref_why,target_our_angle,target_category_id,null,target_priority,auth.uid(),target_notes,array[target_reference_id],target_tag_names,jsonb_build_array(jsonb_build_object('userId',auth.uid(),'roleId',(select id from public.contribution_roles where workspace_id=target_workspace_id and code='idea_creator'),'notes','Created through Reference conversion')));
end; $$;

create or replace function public.change_idea_status(target_idea_id uuid,target_status text,target_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare old_status text; idea_client uuid; allowed boolean;
begin
  select status,client_id into old_status,idea_client from public.ideas where id=target_idea_id;
  if idea_client is null or not public.can_manage_research_client(idea_client) then raise exception 'Idea status access denied'; end if;
  if target_status='converted' then raise exception 'Converted is reserved for the Content conversion action in M05'; end if;
  allowed:=case old_status
    when 'new' then target_status in ('evaluating','rejected','archived')
    when 'evaluating' then target_status in ('new','approved','rejected','archived')
    when 'approved' then target_status in ('evaluating','rejected','archived')
    when 'rejected' then target_status in ('evaluating','archived')
    when 'archived' then target_status in ('new','evaluating')
    when 'converted' then target_status='archived'
    else false end;
  if not allowed then raise exception 'Invalid Idea status transition from % to %',old_status,target_status; end if;
  if target_status in ('rejected','archived') and nullif(btrim(target_reason),'') is null then raise exception 'Reason is required for Reject or Archive'; end if;
  update public.ideas set status=target_status,status_reason=nullif(btrim(target_reason),''),archived_at=case when target_status='archived' then now() else null end where id=target_idea_id;
end; $$;

create or replace function public.list_research_contributors(target_client_id uuid)
returns table(user_profile_id uuid,display_name text) language sql stable security definer set search_path = '' as $$
  select distinct up.id,up.display_name from public.user_profiles up
  join public.workspace_members wm on wm.user_profile_id=up.id
  join public.clients c on c.workspace_id=wm.workspace_id and c.id=target_client_id
  where up.status='active' and wm.status='active' and public.can_manage_research_client(target_client_id)
    and (exists (select 1 from public.client_members cm where cm.workspace_member_id=wm.id and cm.client_id=target_client_id and cm.status='active')
      or exists (select 1 from public.workspace_member_roles wmr join public.roles r on r.id=wmr.role_id where wmr.workspace_member_id=wm.id and r.code='super_admin' and r.is_active))
  order by up.display_name;
$$;

revoke all on function public.save_reference(uuid,uuid,uuid,text,text,text,uuid,text,text,text,text,text,text,text,boolean,uuid[],text[]) from public,anon;
revoke all on function public.archive_reference(uuid) from public,anon;
revoke all on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb) from public,anon;
revoke all on function public.create_idea_from_reference(uuid,uuid,uuid,text,text,uuid,text,text,text[]) from public,anon;
revoke all on function public.change_idea_status(uuid,text,text) from public,anon;
revoke all on function public.list_research_contributors(uuid) from public,anon;
grant execute on function public.save_reference(uuid,uuid,uuid,text,text,text,uuid,text,text,text,text,text,text,text,boolean,uuid[],text[]) to authenticated;
grant execute on function public.archive_reference(uuid) to authenticated;
grant execute on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb) to authenticated;
grant execute on function public.create_idea_from_reference(uuid,uuid,uuid,text,text,uuid,text,text,text[]) to authenticated;
grant execute on function public.change_idea_status(uuid,text,text) to authenticated;
grant execute on function public.list_research_contributors(uuid) to authenticated;

-- Source links and contributors are normalized and never cascade-deleted.
-- Full append-only status/activity history begins with M06; M04 preserves the
-- current transition reason without pretending that a history table exists.
