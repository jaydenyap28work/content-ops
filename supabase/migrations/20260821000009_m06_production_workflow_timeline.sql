-- ContentOS M06: event-backed production workflow, contributor lifecycle,
-- production timestamps, and internal activity audit.

alter table public.contents
  add column shoot_scheduled_at timestamptz,
  add column shooting_started_at timestamptz,
  add column shooting_completed_at timestamptz,
  add column editing_started_at timestamptz;

alter table public.content_contributors
  add column status text not null default 'active' check (status in ('active', 'removed')),
  add column removed_at timestamptz,
  add column removed_by uuid references public.user_profiles (id) on delete restrict,
  add constraint content_contributors_removal_state_check check (
    (status = 'active' and removed_at is null and removed_by is null)
    or (status = 'removed' and removed_at is not null and removed_by is not null)
  );

create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  content_id uuid not null references public.contents (id) on delete restrict,
  actor_user_id uuid not null references public.user_profiles (id) on delete restrict,
  event_type text not null check (event_type in (
    'marked_ready_to_shoot', 'shoot_started', 'shoot_completed', 'editing_started'
  )),
  from_state text not null,
  to_state text not null,
  occurred_at timestamptz not null default now(),
  notes text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  content_id uuid not null references public.contents (id) on delete restrict,
  actor_user_id uuid not null references public.user_profiles (id) on delete restrict,
  entity_type text not null check (entity_type in ('content', 'content_contributor')),
  entity_id uuid not null,
  action text not null check (btrim(action) <> ''),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index workflow_events_content_occurred_idx
  on public.workflow_events (content_id, occurred_at desc, created_at desc);
create index workflow_events_workspace_client_occurred_idx
  on public.workflow_events (workspace_id, client_id, occurred_at desc);
create index workflow_events_actor_occurred_idx
  on public.workflow_events (actor_user_id, occurred_at desc);
create index activity_logs_content_occurred_idx
  on public.activity_logs (content_id, occurred_at desc, created_at desc);
create index activity_logs_workspace_client_occurred_idx
  on public.activity_logs (workspace_id, client_id, occurred_at desc);
create index activity_logs_entity_idx
  on public.activity_logs (entity_type, entity_id, occurred_at desc);
create index content_contributors_active_content_role_idx
  on public.content_contributors (content_id, contribution_role_id, user_profile_id)
  where status = 'active';

create or replace function public.prevent_immutable_history_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% history is immutable', tg_table_name;
end;
$$;

revoke all on function public.prevent_immutable_history_mutation() from public, anon, authenticated;

create trigger workflow_events_immutable
before update or delete on public.workflow_events
for each row execute function public.prevent_immutable_history_mutation();

create trigger activity_logs_immutable
before update or delete on public.activity_logs
for each row execute function public.prevent_immutable_history_mutation();

create or replace function public.enforce_workflow_event_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_workspace uuid; content_client uuid;
begin
  select workspace_id, client_id into content_workspace, content_client
  from public.contents where id = new.content_id;
  if content_workspace is null
     or content_workspace is distinct from new.workspace_id
     or content_client is distinct from new.client_id then
    raise exception 'Workflow Event must share Content ownership scope';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_activity_log_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_workspace uuid; content_client uuid;
begin
  select workspace_id, client_id into content_workspace, content_client
  from public.contents where id = new.content_id;
  if content_workspace is null
     or content_workspace is distinct from new.workspace_id
     or content_client is distinct from new.client_id then
    raise exception 'Activity Log must share Content ownership scope';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_workflow_event_scope() from public, anon, authenticated;
revoke all on function public.enforce_activity_log_scope() from public, anon, authenticated;

create trigger workflow_events_scope_check
before insert on public.workflow_events
for each row execute function public.enforce_workflow_event_scope();

create trigger activity_logs_scope_check
before insert on public.activity_logs
for each row execute function public.enforce_activity_log_scope();

create or replace function public.guard_content_status_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.current_status is distinct from new.current_status
     and coalesce(current_setting('contentos.workflow_action', true), '') <> 'allowed' then
    raise exception 'Content status can only change through an authorized Workflow Action';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_content_status_transition() from public, anon, authenticated;

create trigger contents_status_transition_guard
before update of current_status on public.contents
for each row execute function public.guard_content_status_transition();

create or replace function public.has_active_content_assignment(
  target_content_id uuid,
  target_contribution_code text,
  target_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.content_contributors cc
    join public.contents c on c.id = cc.content_id
    join public.contribution_roles cr on cr.id = cc.contribution_role_id
    join public.workspace_members wm
      on wm.workspace_id = c.workspace_id and wm.user_profile_id = cc.user_profile_id
    join public.user_profiles up on up.id = wm.user_profile_id
    where cc.content_id = target_content_id
      and cc.user_profile_id = target_user_id
      and cc.status = 'active'
      and cr.workspace_id = c.workspace_id
      and cr.code = target_contribution_code
      and cr.is_active
      and wm.status = 'active'
      and up.status = 'active'
      and (
        public.is_workspace_super_admin(c.workspace_id)
        or public.has_active_client_access(c.client_id)
      )
  );
$$;

-- Content planning roles see their authorized Client records. Other internal
-- roles only see a Content when they are an active contributor on that task.
create or replace function public.can_view_content(target_content_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contents c
    where c.id = target_content_id
      and public.is_internal_workspace_member(c.workspace_id)
      and (
        public.can_manage_content_client(c.client_id)
        or (
          public.has_active_client_access(c.client_id)
          and exists (
            select 1 from public.content_contributors cc
            where cc.content_id = c.id
              and cc.user_profile_id = auth.uid()
              and cc.status = 'active'
          )
        )
      )
  );
$$;

create or replace function public.can_manage_content_assignments(target_content_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contents c
    where c.id = target_content_id
      and c.record_status = 'active'
      and public.can_manage_content_client(c.client_id)
  );
$$;

revoke all on function public.has_active_content_assignment(uuid, text, uuid) from public, anon;
revoke all on function public.can_view_content(uuid) from public, anon;
revoke all on function public.can_manage_content_assignments(uuid) from public, anon;
grant execute on function public.has_active_content_assignment(uuid, text, uuid) to authenticated;
grant execute on function public.can_view_content(uuid) to authenticated;
grant execute on function public.can_manage_content_assignments(uuid) to authenticated;

alter table public.workflow_events enable row level security;
alter table public.activity_logs enable row level security;

create policy "Authorized internal contributors can view Workflow Events"
on public.workflow_events for select to authenticated
using (public.can_view_content(content_id));

create policy "Authorized internal contributors can view Activity Logs"
on public.activity_logs for select to authenticated
using (public.can_view_content(content_id));

drop policy "Content planners can view authorized Content Contributors" on public.content_contributors;
create policy "Authorized internal contributors can view Content Contributors"
on public.content_contributors for select to authenticated
using (public.can_view_content(content_id));

create or replace function public.list_contents(target_workspace_id uuid, target_content_id uuid default null)
returns table(
  id uuid, workspace_id uuid, client_id uuid, source_idea_id uuid, content_code text,
  title text, working_title text, category_id uuid, campaign_id uuid, objective text,
  priority text, current_status text, current_owner_user_id uuid, current_owner_name text,
  internal_notes text, private_management_notes text, client_visible_notes text,
  direct_creation_reason text, record_status text, created_by uuid, created_at timestamptz,
  updated_at timestamptz, archived_at timestamptz, archive_reason text
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
    and public.can_view_content(c.id)
  order by c.updated_at desc;
$contentos$;

create or replace function public.get_content_production(target_content_id uuid)
returns table(
  shoot_scheduled_at timestamptz,
  shooting_started_at timestamptz,
  shooting_completed_at timestamptz,
  editing_started_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select c.shoot_scheduled_at, c.shooting_started_at, c.shooting_completed_at, c.editing_started_at
  from public.contents c
  where c.id = target_content_id and public.can_view_content(c.id);
$$;

create or replace function public.list_content_contributors(target_content_id uuid)
returns table(
  id uuid,
  user_profile_id uuid,
  display_name text,
  contribution_role_id uuid,
  contribution_role_code text,
  contribution_role_name text,
  notes text,
  status text,
  added_by uuid,
  created_at timestamptz,
  removed_at timestamptz,
  removed_by uuid
)
language sql stable security definer set search_path = '' as $$
  select cc.id, cc.user_profile_id, up.display_name, cc.contribution_role_id,
    cr.code, cr.name, cc.notes, cc.status, cc.added_by, cc.created_at, cc.removed_at, cc.removed_by
  from public.content_contributors cc
  join public.user_profiles up on up.id = cc.user_profile_id
  join public.contribution_roles cr on cr.id = cc.contribution_role_id
  where cc.content_id = target_content_id and public.can_view_content(cc.content_id)
  order by (cc.status = 'active') desc, cr.sort_order, up.display_name;
$$;

create or replace function public.list_workflow_events(target_content_id uuid)
returns table(
  id uuid,
  actor_user_id uuid,
  actor_name text,
  event_type text,
  from_state text,
  to_state text,
  occurred_at timestamptz,
  notes text,
  metadata jsonb
)
language sql stable security definer set search_path = '' as $$
  select we.id, we.actor_user_id, up.display_name, we.event_type, we.from_state,
    we.to_state, we.occurred_at, we.notes, we.metadata
  from public.workflow_events we
  join public.user_profiles up on up.id = we.actor_user_id
  where we.content_id = target_content_id and public.can_view_content(we.content_id)
  order by we.occurred_at desc, we.created_at desc;
$$;

create or replace function public.list_content_activity(target_content_id uuid)
returns table(
  id uuid,
  actor_user_id uuid,
  actor_name text,
  entity_type text,
  entity_id uuid,
  action text,
  occurred_at timestamptz,
  metadata jsonb
)
language sql stable security definer set search_path = '' as $$
  select al.id, al.actor_user_id, up.display_name, al.entity_type, al.entity_id,
    al.action, al.occurred_at, al.metadata
  from public.activity_logs al
  join public.user_profiles up on up.id = al.actor_user_id
  where al.content_id = target_content_id and public.can_view_content(al.content_id)
  order by al.occurred_at desc, al.created_at desc;
$$;

revoke all on function public.get_content_production(uuid) from public, anon;
revoke all on function public.list_content_contributors(uuid) from public, anon;
revoke all on function public.list_workflow_events(uuid) from public, anon;
revoke all on function public.list_content_activity(uuid) from public, anon;
grant execute on function public.get_content_production(uuid) to authenticated;
grant execute on function public.list_content_contributors(uuid) to authenticated;
grant execute on function public.list_workflow_events(uuid) to authenticated;
grant execute on function public.list_content_activity(uuid) to authenticated;

create or replace function public.assign_content_contributor(
  target_content_id uuid,
  target_user_id uuid,
  target_contribution_role_id uuid,
  target_notes text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_id uuid; content_scope public.contents%rowtype; role_name text; user_name text;
begin
  select * into content_scope from public.contents where id = target_content_id for update;
  if content_scope.id is null then raise exception 'Content not found'; end if;
  if not public.can_manage_content_assignments(target_content_id) then raise exception 'Contributor assignment access denied'; end if;

  select name into role_name from public.contribution_roles
  where id = target_contribution_role_id and workspace_id = content_scope.workspace_id and is_active;
  select display_name into user_name from public.user_profiles where id = target_user_id;
  if role_name is null or user_name is null then raise exception 'Contributor or contribution role not found'; end if;

  insert into public.content_contributors(
    content_id, user_profile_id, contribution_role_id, notes, added_by
  ) values (
    target_content_id, target_user_id, target_contribution_role_id,
    nullif(btrim(target_notes), ''), auth.uid()
  )
  on conflict (content_id, user_profile_id, contribution_role_id) do update
    set status = 'active', removed_at = null, removed_by = null,
        notes = excluded.notes, added_by = auth.uid(), created_at = now()
  returning id into saved_id;

  insert into public.activity_logs(
    workspace_id, client_id, content_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    content_scope.workspace_id, content_scope.client_id, target_content_id, auth.uid(),
    'content_contributor', saved_id, 'contributor_assigned',
    jsonb_build_object('user_id', target_user_id, 'user_name', user_name,
      'contribution_role_id', target_contribution_role_id, 'contribution_role', role_name)
  );
  return saved_id;
end;
$$;

create or replace function public.remove_content_contributor(target_contributor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare contributor public.content_contributors%rowtype; content_scope public.contents%rowtype; role_name text; user_name text;
begin
  select * into contributor from public.content_contributors where id = target_contributor_id for update;
  if contributor.id is null then raise exception 'Content contributor not found'; end if;
  select * into content_scope from public.contents where id = contributor.content_id;
  if not public.can_manage_content_assignments(contributor.content_id) then raise exception 'Contributor removal access denied'; end if;
  if contributor.status <> 'active' then raise exception 'Content contributor is already removed'; end if;
  select name into role_name from public.contribution_roles where id = contributor.contribution_role_id;
  select display_name into user_name from public.user_profiles where id = contributor.user_profile_id;

  update public.content_contributors
  set status = 'removed', removed_at = now(), removed_by = auth.uid()
  where id = target_contributor_id;

  insert into public.activity_logs(
    workspace_id, client_id, content_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    content_scope.workspace_id, content_scope.client_id, contributor.content_id, auth.uid(),
    'content_contributor', contributor.id, 'contributor_removed',
    jsonb_build_object('user_id', contributor.user_profile_id, 'user_name', user_name,
      'contribution_role_id', contributor.contribution_role_id, 'contribution_role', role_name)
  );
end;
$$;

create or replace function public.set_content_shoot_schedule(
  target_content_id uuid,
  target_shoot_scheduled_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
declare content_scope public.contents%rowtype; previous_schedule timestamptz; action_name text;
begin
  select * into content_scope from public.contents where id = target_content_id for update;
  if content_scope.id is null then raise exception 'Content not found'; end if;
  if content_scope.record_status <> 'active' then raise exception 'Archived Content cannot be scheduled'; end if;
  if not public.can_manage_content_assignments(target_content_id) then raise exception 'Shoot schedule access denied'; end if;
  previous_schedule := content_scope.shoot_scheduled_at;
  if previous_schedule is not distinct from target_shoot_scheduled_at then return; end if;

  update public.contents set shoot_scheduled_at = target_shoot_scheduled_at where id = target_content_id;
  action_name := case
    when target_shoot_scheduled_at is null then 'shoot_schedule_cleared'
    when previous_schedule is null then 'shoot_scheduled'
    else 'shoot_rescheduled'
  end;
  insert into public.activity_logs(
    workspace_id, client_id, content_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    content_scope.workspace_id, content_scope.client_id, target_content_id, auth.uid(),
    'content', target_content_id, action_name,
    jsonb_build_object('from', previous_schedule, 'to', target_shoot_scheduled_at)
  );
end;
$$;

create or replace function public.perform_content_workflow_action(
  target_content_id uuid,
  target_action text,
  expected_from_state text,
  target_note text default null
)
returns table(event_id uuid, new_status text, occurred_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  content_scope public.contents%rowtype;
  required_state text;
  next_state text;
  event_name text;
  action_time timestamptz := now();
  saved_event_id uuid;
  permitted boolean := false;
begin
  select * into content_scope from public.contents where id = target_content_id for update;
  if content_scope.id is null then raise exception 'Content not found'; end if;
  if content_scope.record_status <> 'active' then raise exception 'Archived Content cannot transition'; end if;
  if not public.can_view_content(target_content_id) then raise exception 'Workflow Content access denied'; end if;

  case target_action
    when 'mark_ready_to_shoot' then
      required_state := 'draft'; next_state := 'ready_to_shoot'; event_name := 'marked_ready_to_shoot';
      permitted := public.can_manage_content_assignments(target_content_id);
    when 'start_shooting' then
      required_state := 'ready_to_shoot'; next_state := 'shooting'; event_name := 'shoot_started';
      permitted := public.has_workspace_role(content_scope.workspace_id, 'shooter')
        and public.has_active_content_assignment(target_content_id, 'shooter');
    when 'complete_shooting' then
      required_state := 'shooting'; next_state := 'shot_awaiting_edit'; event_name := 'shoot_completed';
      permitted := public.has_workspace_role(content_scope.workspace_id, 'shooter')
        and public.has_active_content_assignment(target_content_id, 'shooter');
    when 'start_editing' then
      required_state := 'shot_awaiting_edit'; next_state := 'editing'; event_name := 'editing_started';
      permitted := public.has_workspace_role(content_scope.workspace_id, 'editor')
        and public.has_active_content_assignment(target_content_id, 'editor');
    else raise exception 'Unsupported Workflow Action';
  end case;

  if not permitted then raise exception 'Workflow Action permission or assignment denied'; end if;
  if expected_from_state is distinct from required_state then
    raise exception 'Invalid expected state for Workflow Action';
  end if;
  if content_scope.current_status is distinct from expected_from_state then
    raise exception 'Stale Workflow Action: Content is currently %', content_scope.current_status;
  end if;

  perform set_config('contentos.workflow_action', 'allowed', true);
  update public.contents set
    current_status = next_state,
    shooting_started_at = case when target_action = 'start_shooting' then action_time else shooting_started_at end,
    shooting_completed_at = case when target_action = 'complete_shooting' then action_time else shooting_completed_at end,
    editing_started_at = case when target_action = 'start_editing' then action_time else editing_started_at end
  where id = target_content_id;

  perform set_config('contentos.workflow_action', '', true);

  insert into public.workflow_events(
    workspace_id, client_id, content_id, actor_user_id, event_type,
    from_state, to_state, occurred_at, notes
  ) values (
    content_scope.workspace_id, content_scope.client_id, target_content_id, auth.uid(), event_name,
    content_scope.current_status, next_state, action_time, nullif(btrim(target_note), '')
  ) returning id into saved_event_id;

  return query select saved_event_id, next_state, action_time;
end;
$$;

revoke all on function public.assign_content_contributor(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.remove_content_contributor(uuid) from public, anon;
revoke all on function public.set_content_shoot_schedule(uuid, timestamptz) from public, anon;
revoke all on function public.perform_content_workflow_action(uuid, text, text, text) from public, anon;
grant execute on function public.assign_content_contributor(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.remove_content_contributor(uuid) to authenticated;
grant execute on function public.set_content_shoot_schedule(uuid, timestamptz) to authenticated;
grant execute on function public.perform_content_workflow_action(uuid, text, text, text) to authenticated;

-- History tables are written only by security-definer action RPCs. Authenticated
-- users receive SELECT through RLS; anon receives no table or RPC access.
revoke insert, update, delete on public.workflow_events from anon, authenticated;
revoke insert, update, delete on public.activity_logs from anon, authenticated;
