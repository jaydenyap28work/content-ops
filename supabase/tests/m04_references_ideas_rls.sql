-- Phase 4 rollback-only verification for References, Ideas, provenance, and RLS.
-- Run only against the verified ContentOS project through the Management API.

begin;

create temporary table phase4_actor (id uuid primary key);
insert into phase4_actor
select id from public.user_profiles where lower(email) = 'jaydenyap28work@gmail.com' limit 1;

do $$
begin
  if (select count(*) from phase4_actor) <> 1 then
    raise exception 'Phase 4 test requires the bound work Super Admin';
  end if;
end;
$$;

create temporary table phase4_ids (key text primary key, id uuid not null);
create temporary table phase4_results (
  test_name text primary key,
  actual integer not null,
  expected integer not null
);

grant select on phase4_actor, phase4_ids to authenticated, anon;
grant select, insert on phase4_ids, phase4_results to authenticated, anon;

insert into public.clients (id, workspace_id, name, code, status) values
  ('f4000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Phase 4 Client A', 'PHASE4-A', 'active'),
  ('f4000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Phase 4 Client B', 'PHASE4-B', 'active');

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id from phase4_actor), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

insert into phase4_ids
select 'reference_a', public.save_reference(
  null,
  '00000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',
  'content',
  'Phase 4 Reference A',
  'Test account',
  '00000000-0000-4000-8000-000000000201',
  'https://example.com/phase-4-shared-url',
  'Software',
  'Malaysia',
  'Founder-led',
  'Short video',
  'Clear operational hook',
  'Rollback-only test Reference',
  true,
  array[
    'f4000000-0000-4000-8000-000000000001'::uuid,
    'f4000000-0000-4000-8000-000000000002'::uuid
  ],
  array['phase-4', 'gold-standard']
);

insert into phase4_ids
select 'reference_b', public.save_reference(
  null,
  '00000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',
  'content',
  'Phase 4 Reference B',
  'Second test account',
  '00000000-0000-4000-8000-000000000202',
  'https://example.com/phase-4-shared-url',
  null,
  null,
  null,
  'Post',
  'Duplicate URLs remain valid',
  null,
  false,
  array['f4000000-0000-4000-8000-000000000001'::uuid],
  array['phase-4']
);

insert into phase4_ids
select 'reference_b_client', public.save_reference(
  null,
  '00000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000002',
  'account',
  'Phase 4 Client B Reference',
  'Client B account',
  '00000000-0000-4000-8000-000000000201',
  'https://example.com/phase-4-client-b',
  null,
  null,
  null,
  null,
  null,
  null,
  false,
  array['f4000000-0000-4000-8000-000000000002'::uuid],
  array['phase-4-b']
);

insert into phase4_ids
select 'idea_a', public.create_idea_from_reference(
  (select id from phase4_ids where key = 'reference_a'),
  '00000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',
  'Phase 4 Idea A',
  'Apply the operational hook to ContentOS',
  '00000000-0000-4000-8000-000000000301',
  'high',
  'Created from a Reference',
  array['phase-4-idea']
);

select public.save_idea(
  (select id from phase4_ids where key = 'idea_a'),
  '00000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',
  'Phase 4 Idea A edited',
  null,
  'Original topic',
  'Original hook',
  'Two sources support the angle',
  'Edited angle',
  '00000000-0000-4000-8000-000000000301',
  'Short video',
  'high',
  (select id from phase4_actor),
  'Edited through the RPC',
  array[
    (select id from phase4_ids where key = 'reference_a'),
    (select id from phase4_ids where key = 'reference_b')
  ],
  array['phase-4-idea', 'edited'],
  jsonb_build_array(jsonb_build_object(
    'userId', (select id from phase4_actor),
    'roleId', (
      select id from public.contribution_roles
      where workspace_id = '00000000-0000-4000-8000-000000000001'
        and code = 'idea_creator'
    ),
    'notes', 'Creator provenance retained'
  ))
);

insert into phase4_ids
select 'idea_b', public.save_idea(
  null,
  '00000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000002',
  'Phase 4 Idea B',
  null,
  null,
  null,
  null,
  'Client B only',
  '00000000-0000-4000-8000-000000000301',
  null,
  'normal',
  (select id from phase4_actor),
  null,
  array[(select id from phase4_ids where key = 'reference_b_client')],
  array['phase-4-b'],
  '[]'::jsonb
);

select public.change_idea_status((select id from phase4_ids where key = 'idea_a'), 'evaluating', null);
select public.change_idea_status((select id from phase4_ids where key = 'idea_a'), 'approved', null);
select public.change_idea_status((select id from phase4_ids where key = 'idea_a'), 'evaluating', null);
select public.change_idea_status((select id from phase4_ids where key = 'idea_a'), 'rejected', 'Not for the current publishing window');
select public.archive_reference((select id from phase4_ids where key = 'reference_a'));

reset role;

do $$
begin
  if (select count(*) from public.references where url = 'https://example.com/phase-4-shared-url') <> 2 then
    raise exception 'Reference CRUD or duplicate URL test failed';
  end if;
  if (select count(*) from public.idea_references where idea_id = (select id from phase4_ids where key = 'idea_a')) <> 2 then
    raise exception 'Idea provenance was not preserved after edit/archive';
  end if;
  if not exists (
    select 1 from public.idea_contributors ic
    join public.contribution_roles cr on cr.id = ic.contribution_role_id
    where ic.idea_id = (select id from phase4_ids where key = 'idea_b')
      and cr.code = 'idea_creator'
  ) then
    raise exception 'Automatic Idea Creator provenance is missing';
  end if;
  begin
    perform public.change_idea_status((select id from phase4_ids where key = 'idea_a'), 'converted', null);
    raise exception 'Converted should be reserved for M05';
  exception when others then
    if sqlerrm = 'Converted should be reserved for M05' then raise; end if;
  end;
end;
$$;

delete from public.workspace_member_roles
where workspace_member_id = (
  select id from public.workspace_members
  where workspace_id = '00000000-0000-4000-8000-000000000001'
    and user_profile_id = (select id from phase4_actor)
)
and role_id = (
  select id from public.roles
  where workspace_id = '00000000-0000-4000-8000-000000000001'
    and code = 'super_admin'
);

insert into public.workspace_member_roles (workspace_member_id, role_id, assigned_by)
select wm.id, r.id, (select id from phase4_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'strategist_content_planner'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase4_actor);

insert into public.client_members (client_id, workspace_member_id, role_id, assigned_by)
select
  'f4000000-0000-4000-8000-000000000001',
  wm.id,
  r.id,
  (select id from phase4_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'strategist_content_planner'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase4_actor);

set local role authenticated;
insert into phase4_results
select 'strategist_reference_scope', count(*)::integer, 2
from public.references where title like 'Phase 4%';
insert into phase4_results
select 'strategist_idea_scope', count(*)::integer, 1
from public.ideas where title like 'Phase 4%';
insert into phase4_results
select 'strategist_reference_client_visibility', count(*)::integer, 2
from public.reference_clients
where reference_id in (select id from phase4_ids where key in ('reference_a', 'reference_b'));
reset role;

delete from public.client_members
where workspace_member_id = (
  select id from public.workspace_members
  where workspace_id = '00000000-0000-4000-8000-000000000001'
    and user_profile_id = (select id from phase4_actor)
);
delete from public.workspace_member_roles
where workspace_member_id = (
  select id from public.workspace_members
  where workspace_id = '00000000-0000-4000-8000-000000000001'
    and user_profile_id = (select id from phase4_actor)
);

insert into public.workspace_member_roles (workspace_member_id, role_id, assigned_by)
select wm.id, r.id, (select id from phase4_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'client_viewer'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase4_actor);

insert into public.client_members (client_id, workspace_member_id, role_id, assigned_by)
select
  'f4000000-0000-4000-8000-000000000001',
  wm.id,
  r.id,
  (select id from phase4_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'client_viewer'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001'
  and wm.user_profile_id = (select id from phase4_actor);

set local role authenticated;
insert into phase4_results
select 'client_viewer_references_denied', count(*)::integer, 0
from public.references where title like 'Phase 4%';
insert into phase4_results
select 'client_viewer_ideas_denied', count(*)::integer, 0
from public.ideas where title like 'Phase 4%';
reset role;

select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
set local role anon;
insert into phase4_results
select 'anon_references_denied', count(*)::integer, 0
from public.references where title like 'Phase 4%';
insert into phase4_results
select 'anon_ideas_denied', count(*)::integer, 0
from public.ideas where title like 'Phase 4%';
reset role;

do $$
begin
  if exists (select 1 from phase4_results where actual <> expected) then
    raise exception 'Phase 4 RLS assertion failed: %', (
      select string_agg(test_name || '=' || actual || '/' || expected, ', ' order by test_name)
      from phase4_results where actual <> expected
    );
  end if;
end;
$$;

select test_name, actual, expected
from phase4_results
order by test_name;

rollback;
