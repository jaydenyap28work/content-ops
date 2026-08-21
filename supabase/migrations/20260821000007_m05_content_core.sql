-- ContentOS M05: Content Core, minimal Campaigns, and transaction-safe Idea conversion.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  description text,
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint campaigns_date_order_check check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint campaigns_archive_state_check check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  source_idea_id uuid references public.ideas (id) on delete restrict,
  content_code text not null check (btrim(content_code) <> ''),
  title text not null check (btrim(title) <> ''),
  working_title text,
  category_id uuid references public.content_categories (id) on delete restrict,
  campaign_id uuid references public.campaigns (id) on delete restrict,
  objective text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  current_status text not null default 'draft' check (current_status in (
    'draft', 'ready_to_shoot', 'shooting', 'shot_awaiting_edit', 'editing',
    'first_cut_submitted', 'internal_review', 'revision_required', 'client_review',
    'approved', 'ready_for_publishing', 'analytics_tracking', 'completed', 'cancelled'
  )),
  current_owner_user_id uuid references public.user_profiles (id) on delete restrict,
  internal_notes text,
  private_management_notes text,
  client_visible_notes text,
  direct_creation_reason text,
  record_status text not null default 'active' check (record_status in ('active', 'archived')),
  created_by uuid not null references public.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.user_profiles (id) on delete restrict,
  archive_reason text,
  constraint contents_workspace_code_key unique (workspace_id, content_code),
  constraint contents_source_or_direct_reason_check check (
    source_idea_id is not null or nullif(btrim(direct_creation_reason), '') is not null
  ),
  constraint contents_archive_state_check check (
    (record_status = 'active' and archived_at is null and archived_by is null and archive_reason is null)
    or (
      record_status = 'archived' and archived_at is not null and archived_by is not null
      and nullif(btrim(archive_reason), '') is not null
    )
  )
);

create table public.content_tags (
  content_id uuid not null references public.contents (id) on delete restrict,
  tag_id uuid not null references public.tags (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (content_id, tag_id)
);

create table public.content_contributors (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete restrict,
  user_profile_id uuid not null references public.user_profiles (id) on delete restrict,
  contribution_role_id uuid not null references public.contribution_roles (id) on delete restrict,
  notes text,
  added_by uuid not null references public.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint content_contributors_unique_fact unique (content_id, user_profile_id, contribution_role_id)
);

-- The explicit V0.1 Convert action is one Idea -> one Content. This database
-- invariant is paired with an Idea row lock in convert_idea_to_content().
create unique index contents_source_idea_once_idx on public.contents (source_idea_id)
where source_idea_id is not null;
create unique index campaigns_client_name_unique_idx on public.campaigns (client_id, lower(btrim(name))) where status = 'active';
create index campaigns_workspace_client_status_idx on public.campaigns (workspace_id, client_id, status);
create index campaigns_client_dates_idx on public.campaigns (client_id, starts_on, ends_on);
create index contents_workspace_client_status_idx on public.contents (workspace_id, client_id, current_status);
create index contents_client_category_idx on public.contents (client_id, category_id);
create index contents_client_campaign_idx on public.contents (client_id, campaign_id);
create index contents_client_priority_idx on public.contents (client_id, priority);
create index contents_owner_status_idx on public.contents (current_owner_user_id, current_status);
create index contents_record_updated_idx on public.contents (record_status, updated_at desc);
create index content_tags_tag_idx on public.content_tags (tag_id, content_id);
create index content_contributors_user_role_idx on public.content_contributors (user_profile_id, contribution_role_id, content_id);
create index content_contributors_content_role_idx on public.content_contributors (content_id, contribution_role_id);

create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();
create trigger contents_set_updated_at before update on public.contents
for each row execute function public.set_updated_at();

create or replace function public.enforce_campaign_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare client_workspace uuid;
begin
  select workspace_id into client_workspace from public.clients where id = new.client_id;
  if client_workspace is null or client_workspace is distinct from new.workspace_id then
    raise exception 'Campaign and Client must share a Workspace';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_content_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  client_workspace uuid;
  idea_workspace uuid;
  idea_client uuid;
  category_workspace uuid;
  category_client uuid;
  campaign_workspace uuid;
  campaign_client uuid;
begin
  select workspace_id into client_workspace from public.clients where id = new.client_id;
  if client_workspace is null or client_workspace is distinct from new.workspace_id then
    raise exception 'Content and Client must share a Workspace';
  end if;

  if new.source_idea_id is not null then
    select workspace_id, client_id into idea_workspace, idea_client from public.ideas where id = new.source_idea_id;
    if idea_workspace is null or idea_workspace is distinct from new.workspace_id or idea_client is distinct from new.client_id then
      raise exception 'Source Idea must belong to the Content Client';
    end if;
  end if;

  if new.category_id is not null then
    select workspace_id, client_id into category_workspace, category_client from public.content_categories where id = new.category_id;
    if category_workspace is null or category_workspace is distinct from new.workspace_id
       or (category_client is not null and category_client is distinct from new.client_id) then
      raise exception 'Category scope does not cover this Content';
    end if;
  end if;

  if new.campaign_id is not null then
    select workspace_id, client_id into campaign_workspace, campaign_client from public.campaigns where id = new.campaign_id;
    if campaign_workspace is null or campaign_workspace is distinct from new.workspace_id or campaign_client is distinct from new.client_id then
      raise exception 'Campaign must belong to the Content Client';
    end if;
  end if;

  if new.current_owner_user_id is not null and not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = new.workspace_id
      and wm.user_profile_id = new.current_owner_user_id
      and wm.status = 'active'
      and (
        exists (
          select 1 from public.workspace_member_roles wmr
          join public.roles r on r.id = wmr.role_id
          where wmr.workspace_member_id = wm.id and r.code = 'super_admin' and r.is_active
        )
        or exists (
          select 1 from public.client_members cm
          where cm.workspace_member_id = wm.id and cm.client_id = new.client_id and cm.status = 'active'
        )
      )
  ) then
    raise exception 'Content owner must be active and authorized for the Client';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_content_tag_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_workspace uuid; content_client uuid; tag_workspace uuid; tag_client uuid;
begin
  select workspace_id, client_id into content_workspace, content_client from public.contents where id = new.content_id;
  select workspace_id, client_id into tag_workspace, tag_client from public.tags where id = new.tag_id;
  if content_workspace is null or content_workspace is distinct from tag_workspace
     or (tag_client is not null and tag_client is distinct from content_client) then
    raise exception 'Tag scope does not cover this Content';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_content_contributor_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_workspace uuid; content_client uuid; role_workspace uuid;
begin
  select workspace_id, client_id into content_workspace, content_client from public.contents where id = new.content_id;
  select workspace_id into role_workspace from public.contribution_roles where id = new.contribution_role_id and is_active;
  if content_workspace is null or content_workspace is distinct from role_workspace or not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = content_workspace and wm.user_profile_id = new.user_profile_id and wm.status = 'active'
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
  ) then
    raise exception 'Contributor must be an active authorized member of the Content Client';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_campaign_scope() from public, anon, authenticated;
revoke all on function public.enforce_content_scope() from public, anon, authenticated;
revoke all on function public.enforce_content_tag_scope() from public, anon, authenticated;
revoke all on function public.enforce_content_contributor_scope() from public, anon, authenticated;

create trigger campaigns_scope_check before insert or update on public.campaigns
for each row execute function public.enforce_campaign_scope();
create trigger contents_scope_check before insert or update on public.contents
for each row execute function public.enforce_content_scope();
create trigger content_tags_scope_check before insert or update on public.content_tags
for each row execute function public.enforce_content_tag_scope();
create trigger content_contributors_scope_check before insert or update on public.content_contributors
for each row execute function public.enforce_content_contributor_scope();

create or replace function public.has_content_planning_role(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_workspace_super_admin(target_workspace_id)
    or public.has_workspace_role(target_workspace_id, 'internal_manager')
    or public.has_workspace_role(target_workspace_id, 'strategist_content_planner');
$$;

create or replace function public.can_manage_content_client(target_client_id uuid)
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

create or replace function public.can_archive_content_client(target_client_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clients c
    where c.id = target_client_id and c.status = 'active'
      and (
        public.is_workspace_super_admin(c.workspace_id)
        or (
          public.has_active_client_access(c.id)
          and public.has_workspace_role(c.workspace_id, 'internal_manager')
        )
      )
  );
$$;

create or replace function public.can_view_content(target_content_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contents c
    where c.id = target_content_id and public.can_manage_content_client(c.client_id)
  );
$$;

revoke all on function public.has_content_planning_role(uuid) from public, anon;
revoke all on function public.can_manage_content_client(uuid) from public, anon;
revoke all on function public.can_archive_content_client(uuid) from public, anon;
revoke all on function public.can_view_content(uuid) from public, anon;
grant execute on function public.has_content_planning_role(uuid) to authenticated;
grant execute on function public.can_manage_content_client(uuid) to authenticated;
grant execute on function public.can_archive_content_client(uuid) to authenticated;
grant execute on function public.can_view_content(uuid) to authenticated;

alter table public.campaigns enable row level security;
alter table public.contents enable row level security;
alter table public.content_tags enable row level security;
alter table public.content_contributors enable row level security;

create policy "Content planners can view authorized Campaigns" on public.campaigns
for select to authenticated using (public.can_manage_content_client(client_id));
create policy "Managers can view Content base rows" on public.contents
for select to authenticated using (public.can_archive_content_client(client_id));
create policy "Content planners can view authorized Content Tags" on public.content_tags
for select to authenticated using (public.can_view_content(content_id));
create policy "Content planners can view authorized Content Contributors" on public.content_contributors
for select to authenticated using (public.can_view_content(content_id));

create or replace function public.list_contents(target_workspace_id uuid, target_content_id uuid default null)
returns table(
  id uuid,
  workspace_id uuid,
  client_id uuid,
  source_idea_id uuid,
  content_code text,
  title text,
  working_title text,
  category_id uuid,
  campaign_id uuid,
  objective text,
  priority text,
  current_status text,
  current_owner_user_id uuid,
  current_owner_name text,
  internal_notes text,
  private_management_notes text,
  client_visible_notes text,
  direct_creation_reason text,
  record_status text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz,
  archive_reason text
)
language sql stable security definer set search_path = '' as $contentos$
  select
    c.id, c.workspace_id, c.client_id, c.source_idea_id, c.content_code, c.title, c.working_title,
    c.category_id, c.campaign_id, c.objective, c.priority, c.current_status, c.current_owner_user_id,
    owner.display_name,
    c.internal_notes,
    case when public.can_archive_content_client(c.client_id) then c.private_management_notes else null end,
    c.client_visible_notes, c.direct_creation_reason, c.record_status, c.created_by,
    c.created_at, c.updated_at, c.archived_at, c.archive_reason
  from public.contents c
  left join public.user_profiles owner on owner.id = c.current_owner_user_id
  where c.workspace_id = target_workspace_id
    and (target_content_id is null or c.id = target_content_id)
    and public.can_manage_content_client(c.client_id)
  order by c.updated_at desc;
$contentos$;

revoke all on function public.list_contents(uuid, uuid) from public, anon;
grant execute on function public.list_contents(uuid, uuid) to authenticated;

create or replace function public.next_content_code(target_workspace_id uuid, target_client_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare client_code text; code_prefix text; next_number integer; local_year text;
begin
  select code into client_code from public.clients
  where id = target_client_id and workspace_id = target_workspace_id and status = 'active';
  if client_code is null then raise exception 'Active Client not found for Content code'; end if;
  local_year := to_char(timezone('Asia/Kuala_Lumpur', now()), 'YYYY');
  code_prefix := trim(both '-' from regexp_replace(upper(btrim(client_code)), '[^A-Z0-9]+', '-', 'g')) || '-' || local_year || '-';
  perform pg_advisory_xact_lock(hashtextextended(target_workspace_id::text || ':' || target_client_id::text || ':' || local_year, 0));
  select coalesce(max((substring(content_code from '([0-9]+)$'))::integer), 0) + 1
    into next_number
  from public.contents
  where workspace_id = target_workspace_id and client_id = target_client_id and content_code like code_prefix || '%';
  return code_prefix || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.next_content_code(uuid, uuid) from public, anon, authenticated;

create or replace function public.save_campaign(
  target_campaign_id uuid,
  target_workspace_id uuid,
  target_client_id uuid,
  target_name text,
  target_description text,
  target_starts_on date,
  target_ends_on date
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_id uuid; existing_client uuid; existing_status text;
begin
  if not public.can_manage_content_client(target_client_id) then raise exception 'Campaign Client access denied'; end if;
  if target_campaign_id is null then
    insert into public.campaigns(workspace_id, client_id, name, description, starts_on, ends_on, created_by)
    values(target_workspace_id, target_client_id, btrim(target_name), nullif(btrim(target_description), ''), target_starts_on, target_ends_on, auth.uid())
    returning id into saved_id;
  else
    select client_id, status into existing_client, existing_status from public.campaigns where id = target_campaign_id;
    if existing_client is null or existing_client is distinct from target_client_id then raise exception 'Campaign ownership scope cannot be changed'; end if;
    if existing_status <> 'active' then raise exception 'Archived Campaign cannot be edited'; end if;
    update public.campaigns
    set name = btrim(target_name), description = nullif(btrim(target_description), ''), starts_on = target_starts_on, ends_on = target_ends_on
    where id = target_campaign_id;
    saved_id := target_campaign_id;
  end if;
  return saved_id;
end;
$$;

create or replace function public.archive_campaign(target_campaign_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare campaign_client uuid;
begin
  select client_id into campaign_client from public.campaigns where id = target_campaign_id;
  if campaign_client is null or not public.can_manage_content_client(campaign_client) then raise exception 'Campaign archive access denied'; end if;
  update public.campaigns set status = 'archived', archived_at = coalesce(archived_at, now())
  where id = target_campaign_id and status = 'active';
end;
$$;

create or replace function public.save_content(
  target_content_id uuid,
  target_workspace_id uuid,
  target_client_id uuid,
  target_title text,
  target_working_title text,
  target_category_id uuid,
  target_campaign_id uuid,
  target_objective text,
  target_priority text,
  target_owner_user_id uuid,
  target_internal_notes text,
  target_private_management_notes text,
  target_client_visible_notes text,
  target_direct_creation_reason text,
  target_tag_names text[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_id uuid; existing_client uuid; existing_status text; tag_name text; tag_id uuid; can_manage_private boolean := public.can_archive_content_client(target_client_id);
begin
  if not public.can_manage_content_client(target_client_id) then raise exception 'Content Client access denied'; end if;
  if not can_manage_private and nullif(btrim(target_private_management_notes), '') is not null then raise exception 'Private Management Notes access denied'; end if;
  if target_content_id is null then
    if nullif(btrim(target_direct_creation_reason), '') is null then raise exception 'Direct creation reason is required'; end if;
    insert into public.contents(
      workspace_id, client_id, content_code, title, working_title, category_id, campaign_id, objective,
      priority, current_owner_user_id, internal_notes, private_management_notes, client_visible_notes,
      direct_creation_reason, created_by
    ) values (
      target_workspace_id, target_client_id, public.next_content_code(target_workspace_id, target_client_id),
      btrim(target_title), nullif(btrim(target_working_title), ''), target_category_id, target_campaign_id,
      nullif(btrim(target_objective), ''), target_priority, coalesce(target_owner_user_id, auth.uid()),
      nullif(btrim(target_internal_notes), ''), case when can_manage_private then nullif(btrim(target_private_management_notes), '') else null end,
      nullif(btrim(target_client_visible_notes), ''), btrim(target_direct_creation_reason), auth.uid()
    ) returning id into saved_id;
  else
    select client_id, record_status into existing_client, existing_status from public.contents where id = target_content_id;
    if existing_client is null or existing_client is distinct from target_client_id then raise exception 'Content ownership scope cannot be changed'; end if;
    if existing_status <> 'active' then raise exception 'Archived Content cannot be edited'; end if;
    update public.contents set
      title = btrim(target_title), working_title = nullif(btrim(target_working_title), ''),
      category_id = target_category_id, campaign_id = target_campaign_id,
      objective = nullif(btrim(target_objective), ''), priority = target_priority,
      current_owner_user_id = coalesce(target_owner_user_id, current_owner_user_id),
      internal_notes = nullif(btrim(target_internal_notes), ''),
      private_management_notes = case when can_manage_private then nullif(btrim(target_private_management_notes), '') else private_management_notes end,
      client_visible_notes = nullif(btrim(target_client_visible_notes), '')
    where id = target_content_id;
    saved_id := target_content_id;
  end if;

  delete from public.content_tags where content_id = saved_id;
  foreach tag_name in array coalesce(target_tag_names, '{}'::text[]) loop
    if btrim(tag_name) <> '' then
      select id into tag_id from public.tags
      where workspace_id = target_workspace_id and client_id is not distinct from target_client_id
        and lower(btrim(name)) = lower(btrim(tag_name)) limit 1;
      if tag_id is null then
        insert into public.tags(workspace_id, client_id, name)
        values(target_workspace_id, target_client_id, btrim(tag_name)) on conflict do nothing returning id into tag_id;
      end if;
      if tag_id is null then
        select id into tag_id from public.tags
        where workspace_id = target_workspace_id and client_id is not distinct from target_client_id
          and lower(btrim(name)) = lower(btrim(tag_name)) limit 1;
      end if;
      insert into public.content_tags(content_id, tag_id) values(saved_id, tag_id) on conflict do nothing;
    end if;
  end loop;
  return saved_id;
end;
$$;

create or replace function public.convert_idea_to_content(
  target_idea_id uuid,
  target_title text,
  target_working_title text,
  target_campaign_id uuid,
  target_objective text,
  target_owner_user_id uuid,
  target_internal_notes text,
  target_private_management_notes text,
  target_client_visible_notes text,
  target_tag_names text[]
)
returns table(content_id uuid, content_code text) language plpgsql security definer set search_path = '' as $$
declare
  source_idea public.ideas%rowtype;
  saved_content_id uuid;
  saved_content_code text;
  tag_name text;
  tag_id uuid;
  can_manage_private boolean;
begin
  select * into source_idea from public.ideas where id = target_idea_id for update;
  if source_idea.id is null then raise exception 'Idea not found'; end if;
  if not public.can_manage_content_client(source_idea.client_id) then raise exception 'Idea conversion access denied'; end if;
  can_manage_private := public.can_archive_content_client(source_idea.client_id);
  if not can_manage_private and nullif(btrim(target_private_management_notes), '') is not null then raise exception 'Private Management Notes access denied'; end if;
  if source_idea.status <> 'approved' then raise exception 'Only an Approved Idea can be converted'; end if;
  if exists (select 1 from public.contents where source_idea_id = target_idea_id) then raise exception 'Idea has already been converted'; end if;

  insert into public.contents(
    workspace_id, client_id, source_idea_id, content_code, title, working_title, category_id, campaign_id,
    objective, priority, current_owner_user_id, internal_notes, private_management_notes, client_visible_notes, created_by
  ) values (
    source_idea.workspace_id, source_idea.client_id, source_idea.id,
    public.next_content_code(source_idea.workspace_id, source_idea.client_id),
    coalesce(nullif(btrim(target_title), ''), source_idea.title),
    coalesce(nullif(btrim(target_working_title), ''), source_idea.title),
    source_idea.category_id, target_campaign_id,
    coalesce(nullif(btrim(target_objective), ''), source_idea.our_angle), source_idea.priority,
    coalesce(target_owner_user_id, source_idea.owner_user_id, auth.uid()),
    nullif(btrim(target_internal_notes), ''), case when can_manage_private then nullif(btrim(target_private_management_notes), '') else null end,
    nullif(btrim(target_client_visible_notes), ''), auth.uid()
  ) returning id, contents.content_code into saved_content_id, saved_content_code;

  insert into public.content_tags(content_id, tag_id)
  select saved_content_id, it.tag_id from public.idea_tags it where it.idea_id = source_idea.id
  on conflict do nothing;

  foreach tag_name in array coalesce(target_tag_names, '{}'::text[]) loop
    if btrim(tag_name) <> '' then
      select id into tag_id from public.tags
      where workspace_id = source_idea.workspace_id and client_id is not distinct from source_idea.client_id
        and lower(btrim(name)) = lower(btrim(tag_name)) limit 1;
      if tag_id is null then
        insert into public.tags(workspace_id, client_id, name)
        values(source_idea.workspace_id, source_idea.client_id, btrim(tag_name)) on conflict do nothing returning id into tag_id;
      end if;
      if tag_id is null then
        select id into tag_id from public.tags
        where workspace_id = source_idea.workspace_id and client_id is not distinct from source_idea.client_id
          and lower(btrim(name)) = lower(btrim(tag_name)) limit 1;
      end if;
      insert into public.content_tags(content_id, tag_id) values(saved_content_id, tag_id) on conflict do nothing;
    end if;
  end loop;

  insert into public.content_contributors(content_id, user_profile_id, contribution_role_id, notes, added_by)
  select saved_content_id, ic.user_profile_id, ic.contribution_role_id,
    coalesce(ic.notes, 'Preserved from source Idea'), auth.uid()
  from public.idea_contributors ic
  join public.contribution_roles cr on cr.id = ic.contribution_role_id
  where ic.idea_id = source_idea.id and cr.code = 'idea_creator'
  on conflict do nothing;

  update public.ideas
  set status = 'converted', status_reason = 'Converted to ' || saved_content_code, archived_at = null
  where id = source_idea.id;

  return query select saved_content_id, saved_content_code;
end;
$$;

create or replace function public.archive_content(target_content_id uuid, target_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare content_client uuid;
begin
  select client_id into content_client from public.contents where id = target_content_id;
  if content_client is null or not public.can_archive_content_client(content_client) then raise exception 'Content archive access denied'; end if;
  if nullif(btrim(target_reason), '') is null then raise exception 'Archive reason is required'; end if;
  update public.contents set
    record_status = 'archived', archived_at = now(), archived_by = auth.uid(), archive_reason = btrim(target_reason)
  where id = target_content_id and record_status = 'active';
end;
$$;

revoke all on function public.save_campaign(uuid,uuid,uuid,text,text,date,date) from public, anon;
revoke all on function public.archive_campaign(uuid) from public, anon;
revoke all on function public.save_content(uuid,uuid,uuid,text,text,uuid,uuid,text,text,uuid,text,text,text,text,text[]) from public, anon;
revoke all on function public.convert_idea_to_content(uuid,text,text,uuid,text,uuid,text,text,text,text[]) from public, anon;
revoke all on function public.archive_content(uuid,text) from public, anon;
grant execute on function public.save_campaign(uuid,uuid,uuid,text,text,date,date) to authenticated;
grant execute on function public.archive_campaign(uuid) to authenticated;
grant execute on function public.save_content(uuid,uuid,uuid,text,text,uuid,uuid,text,text,uuid,text,text,text,text,text[]) to authenticated;
grant execute on function public.convert_idea_to_content(uuid,text,text,uuid,text,uuid,text,text,text,text[]) to authenticated;
grant execute on function public.archive_content(uuid,text) to authenticated;

-- M06 will add workflow_events/activity_logs and all production transitions.
-- M05 intentionally permits only Draft creation and metadata edits.
