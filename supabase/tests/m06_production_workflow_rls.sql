-- Phase 6 rollback-only verification for workflow actions, contributors, audit, and RLS.

begin;

create temporary table phase6_actor (id uuid primary key);
insert into phase6_actor
select id from public.user_profiles where lower(email) = 'jaydenyap28work@gmail.com' limit 1;

do $$
begin
  if (select count(*) from phase6_actor) <> 1 then
    raise exception 'Phase 6 test requires the bound work Super Admin';
  end if;
end;
$$;

create temporary table phase6_ids (key text primary key, id uuid not null);
create temporary table phase6_results (test_name text primary key, actual integer not null, expected integer not null);
grant select on phase6_actor, phase6_ids to authenticated, anon;
grant select, insert on phase6_ids, phase6_results to authenticated, anon;

insert into public.clients (id, workspace_id, name, code, status) values
  ('f6000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Phase 6 Client A', 'PHASE6-A', 'active'),
  ('f6000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Phase 6 Client B', 'PHASE6-B', 'active');

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id from phase6_actor), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

insert into phase6_ids
select 'content_a', public.save_content(
  null, '00000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001',
  'Phase 6 Production Content', 'Workflow test', null, null, 'Verify M06 workflow', 'high',
  (select id from phase6_actor), 'Internal workflow note', 'Private workflow note', null,
  'Rollback-only Phase 6 verification', array['phase-6']
);
insert into phase6_ids
select 'content_b', public.save_content(
  null, '00000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000002',
  'Phase 6 Isolated Content', null, null, null, 'Verify Client isolation', 'normal',
  (select id from phase6_actor), null, null, null,
  'Rollback-only cross-Client fixture', '{}'
);

select public.set_content_shoot_schedule(
  (select id from phase6_ids where key = 'content_a'), '2026-08-25 10:00:00+08'
);

insert into phase6_ids
select 'shooter_assignment', public.assign_content_contributor(
  (select id from phase6_ids where key = 'content_a'), (select id from phase6_actor),
  (select id from public.contribution_roles where workspace_id = '00000000-0000-4000-8000-000000000001' and code = 'shooter'),
  'Primary shoot operator'
);
insert into phase6_ids
select 'editor_assignment', public.assign_content_contributor(
  (select id from phase6_ids where key = 'content_a'), (select id from phase6_actor),
  (select id from public.contribution_roles where workspace_id = '00000000-0000-4000-8000-000000000001' and code = 'editor'),
  'Primary edit operator'
);
reset role;

-- Ordinary table updates cannot bypass the Workflow Action RPC.
do $$
begin
  begin
    update public.contents set current_status = 'ready_to_shoot'
    where id = (select id from phase6_ids where key = 'content_a');
    raise exception '__direct_status_update_was_allowed__';
  exception when others then
    if sqlerrm = '__direct_status_update_was_allowed__' then raise; end if;
  end;
end;
$$;

set local role authenticated;
select * from public.perform_content_workflow_action(
  (select id from phase6_ids where key = 'content_a'), 'mark_ready_to_shoot', 'draft', 'Brief confirmed'
);

-- Assignment alone does not grant a Shooter action without the workspace role.
do $$
begin
  begin
    perform * from public.perform_content_workflow_action(
      (select id from phase6_ids where key = 'content_a'), 'start_shooting', 'ready_to_shoot', null
    );
    raise exception '__shoot_without_role_was_allowed__';
  exception when others then
    if sqlerrm = '__shoot_without_role_was_allowed__' then raise; end if;
  end;
end;
$$;
reset role;

insert into public.workspace_member_roles(workspace_member_id, role_id, assigned_by)
select wm.id, r.id, (select id from phase6_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'shooter'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase6_actor)
on conflict do nothing;

set local role authenticated;
select * from public.perform_content_workflow_action(
  (select id from phase6_ids where key = 'content_a'), 'start_shooting', 'ready_to_shoot', 'Camera rolling'
);

-- A stale duplicate carries the old expected state and must fail without a second event.
do $$
begin
  begin
    perform * from public.perform_content_workflow_action(
      (select id from phase6_ids where key = 'content_a'), 'start_shooting', 'ready_to_shoot', 'Duplicate click'
    );
    raise exception '__stale_action_was_allowed__';
  exception when others then
    if sqlerrm = '__stale_action_was_allowed__' then raise; end if;
  end;
end;
$$;

select * from public.perform_content_workflow_action(
  (select id from phase6_ids where key = 'content_a'), 'complete_shooting', 'shooting', 'Raw footage location pending'
);

do $$
begin
  begin
    perform * from public.perform_content_workflow_action(
      (select id from phase6_ids where key = 'content_a'), 'start_editing', 'shot_awaiting_edit', null
    );
    raise exception '__edit_without_role_was_allowed__';
  exception when others then
    if sqlerrm = '__edit_without_role_was_allowed__' then raise; end if;
  end;
end;
$$;
reset role;

insert into public.workspace_member_roles(workspace_member_id, role_id, assigned_by)
select wm.id, r.id, (select id from phase6_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'editor'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase6_actor)
on conflict do nothing;

set local role authenticated;
select * from public.perform_content_workflow_action(
  (select id from phase6_ids where key = 'content_a'), 'start_editing', 'shot_awaiting_edit', 'Project file opened'
);
select public.remove_content_contributor((select id from phase6_ids where key = 'editor_assignment'));
reset role;

do $$
begin
  if (select current_status from public.contents where id = (select id from phase6_ids where key = 'content_a')) <> 'editing' then
    raise exception 'Content status did not follow the legal transition sequence';
  end if;
  if (select count(*) from public.workflow_events where content_id = (select id from phase6_ids where key = 'content_a')) <> 4 then
    raise exception 'Workflow event count is not exactly four';
  end if;
  if exists (
    select 1 from public.workflow_events
    where content_id = (select id from phase6_ids where key = 'content_a')
      and (actor_user_id <> (select id from phase6_actor) or from_state = to_state)
  ) then raise exception 'Workflow event actor or state transition is invalid'; end if;
  if exists (
    select 1 from public.contents where id = (select id from phase6_ids where key = 'content_a')
      and (shooting_started_at is null or shooting_completed_at is null or editing_started_at is null)
  ) then raise exception 'Automatic production timestamps are missing'; end if;
  if (select shoot_scheduled_at from public.contents where id = (select id from phase6_ids where key = 'content_a'))
     <> '2026-08-25 10:00:00+08'::timestamptz then raise exception 'Manual shoot schedule was not retained'; end if;
  if (select status from public.content_contributors where id = (select id from phase6_ids where key = 'editor_assignment')) <> 'removed' then
    raise exception 'Contributor removal did not preserve a removed record';
  end if;
  if (select count(*) from public.activity_logs where content_id = (select id from phase6_ids where key = 'content_a')) <> 4 then
    raise exception 'Assignment, removal, and schedule activity count is invalid';
  end if;

  begin
    update public.workflow_events set notes = 'tampered'
    where content_id = (select id from phase6_ids where key = 'content_a');
    raise exception '__workflow_history_update_was_allowed__';
  exception when others then
    if sqlerrm = '__workflow_history_update_was_allowed__' then raise; end if;
  end;
  begin
    delete from public.workflow_events where content_id = (select id from phase6_ids where key = 'content_a');
    raise exception '__workflow_history_delete_was_allowed__';
  exception when others then
    if sqlerrm = '__workflow_history_delete_was_allowed__' then raise; end if;
  end;
  begin
    update public.activity_logs set action = 'tampered'
    where content_id = (select id from phase6_ids where key = 'content_a');
    raise exception '__activity_history_update_was_allowed__';
  exception when others then
    if sqlerrm = '__activity_history_update_was_allowed__' then raise; end if;
  end;
end;
$$;

-- Switch the actor to an assigned Shooter without management authority.
delete from public.workspace_member_roles
where workspace_member_id = (
  select id from public.workspace_members
  where workspace_id = '00000000-0000-4000-8000-000000000001'
    and user_profile_id = (select id from phase6_actor)
);
insert into public.workspace_member_roles(workspace_member_id, role_id, assigned_by)
select wm.id, r.id, (select id from phase6_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'shooter'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase6_actor);
insert into public.client_members(client_id, workspace_member_id, role_id, assigned_by)
select 'f6000000-0000-4000-8000-000000000001', wm.id, r.id, (select id from phase6_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'shooter'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase6_actor);

set local role authenticated;
insert into phase6_results select 'assigned_shooter_content_projection', count(*)::integer, 1
from public.list_contents('00000000-0000-4000-8000-000000000001', null);
insert into phase6_results select 'assigned_shooter_cross_client_denied', count(*)::integer, 0
from public.list_contents('00000000-0000-4000-8000-000000000001', (select id from phase6_ids where key = 'content_b'));
insert into phase6_results select 'assigned_shooter_timeline', count(*)::integer, 4
from public.list_workflow_events((select id from phase6_ids where key = 'content_a'));
insert into phase6_results select 'assigned_shooter_activity', count(*)::integer, 4
from public.list_content_activity((select id from phase6_ids where key = 'content_a'));
insert into phase6_results select 'assigned_shooter_contributor_history', count(*)::integer, 2
from public.list_content_contributors((select id from phase6_ids where key = 'content_a'));
insert into phase6_results select 'assigned_shooter_base_rows_denied', count(*)::integer, 0
from public.contents where title like 'Phase 6%';

do $$
begin
  begin
    perform * from public.perform_content_workflow_action(
      (select id from phase6_ids where key = 'content_b'), 'mark_ready_to_shoot', 'draft', null
    );
    raise exception '__cross_client_action_was_allowed__';
  exception when others then
    if sqlerrm = '__cross_client_action_was_allowed__' then raise; end if;
  end;
end;
$$;
reset role;

delete from public.client_members
where workspace_member_id = (
  select id from public.workspace_members
  where workspace_id = '00000000-0000-4000-8000-000000000001'
    and user_profile_id = (select id from phase6_actor)
);
delete from public.workspace_member_roles
where workspace_member_id = (
  select id from public.workspace_members
  where workspace_id = '00000000-0000-4000-8000-000000000001'
    and user_profile_id = (select id from phase6_actor)
);
insert into public.workspace_member_roles(workspace_member_id, role_id, assigned_by)
select wm.id, r.id, (select id from phase6_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'client_viewer'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase6_actor);
insert into public.client_members(client_id, workspace_member_id, role_id, assigned_by)
select 'f6000000-0000-4000-8000-000000000001', wm.id, r.id, (select id from phase6_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'client_viewer'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase6_actor);

set local role authenticated;
insert into phase6_results select 'client_viewer_content_denied', count(*)::integer, 0
from public.list_contents('00000000-0000-4000-8000-000000000001', null);
insert into phase6_results select 'client_viewer_timeline_denied', count(*)::integer, 0
from public.list_workflow_events((select id from phase6_ids where key = 'content_a'));
insert into phase6_results select 'client_viewer_activity_denied', count(*)::integer, 0
from public.list_content_activity((select id from phase6_ids where key = 'content_a'));
reset role;

select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
set local role anon;
insert into phase6_results select 'anon_workflow_denied', count(*)::integer, 0
from public.workflow_events;
insert into phase6_results select 'anon_activity_denied', count(*)::integer, 0
from public.activity_logs;
reset role;

do $$
begin
  if exists (select 1 from phase6_results where actual <> expected) then
    raise exception 'Phase 6 RLS assertion failed: %', (
      select string_agg(test_name || '=' || actual || '/' || expected, ', ' order by test_name)
      from phase6_results where actual <> expected
    );
  end if;
end;
$$;

select test_name, actual, expected from phase6_results order by test_name;

rollback;
