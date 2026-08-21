-- Phase 5 rollback-only verification for Content Core, Campaigns, conversion, and RLS.

begin;

create temporary table phase5_actor (id uuid primary key);
insert into phase5_actor
select id from public.user_profiles where lower(email) = 'jaydenyap28work@gmail.com' limit 1;

do $$
begin
  if (select count(*) from phase5_actor) <> 1 then
    raise exception 'Phase 5 test requires the bound work Super Admin';
  end if;
end;
$$;

create temporary table phase5_ids (key text primary key, id uuid not null);
create temporary table phase5_codes (key text primary key, code text not null);
create temporary table phase5_results (test_name text primary key, actual integer not null, expected integer not null);
grant select on phase5_actor, phase5_ids, phase5_codes to authenticated, anon;
grant select, insert on phase5_ids, phase5_codes, phase5_results to authenticated, anon;

insert into public.clients (id, workspace_id, name, code, status) values
  ('f5000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Phase 5 Client A', 'PHASE5-A', 'active'),
  ('f5000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Phase 5 Client B', 'PHASE5-B', 'active');

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id from phase5_actor), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

insert into phase5_ids
select 'campaign_a', public.save_campaign(
  null, '00000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
  'Phase 5 Campaign A', 'Initial description', '2026-08-01', '2026-09-30'
);
select public.save_campaign(
  (select id from phase5_ids where key = 'campaign_a'),
  '00000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
  'Phase 5 Campaign A', 'Edited description', '2026-08-01', '2026-10-15'
);
insert into phase5_ids
select 'campaign_b', public.save_campaign(
  null, '00000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002',
  'Phase 5 Campaign B', null, null, null
);

insert into phase5_ids
select 'reference_a', public.save_reference(
  null, '00000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
  'content', 'Phase 5 Source Reference', 'Source account', '00000000-0000-4000-8000-000000000201',
  'https://example.com/phase-5-source', null, null, null, 'Short video', 'Strong source', 'Keep provenance',
  true, array['f5000000-0000-4000-8000-000000000001'::uuid], array['phase-5-source']
);

insert into phase5_ids
select 'idea_a', public.create_idea_from_reference(
  (select id from phase5_ids where key = 'reference_a'),
  '00000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
  'Phase 5 Approved Idea', 'A Client-specific angle', '00000000-0000-4000-8000-000000000301',
  'high', 'Idea notes retained', array['phase-5-idea']
);
select public.change_idea_status((select id from phase5_ids where key = 'idea_a'), 'evaluating', null);
select public.change_idea_status((select id from phase5_ids where key = 'idea_a'), 'approved', null);

insert into phase5_ids
select 'idea_not_approved', public.save_idea(
  null, '00000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
  'Phase 5 Unapproved Idea', null, null, null, null, 'Not approved yet',
  '00000000-0000-4000-8000-000000000301', null, 'normal', (select id from phase5_actor),
  null, '{}'::uuid[], array['phase-5-unapproved'], '[]'::jsonb
);

insert into phase5_ids
select 'direct_a', public.save_content(
  null, '00000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
  'Phase 5 Direct Content', 'Direct working title', '00000000-0000-4000-8000-000000000301',
  (select id from phase5_ids where key = 'campaign_a'), 'Validate direct Content path', 'normal',
  (select id from phase5_actor), 'Internal direct note', 'Private direct note', 'Client-visible direct note',
  'No source Idea exists for this operational announcement', array['phase-5-direct']
);
insert into phase5_codes
select 'direct_a', content_code from public.list_contents(
  '00000000-0000-4000-8000-000000000001', (select id from phase5_ids where key = 'direct_a')
);

select public.save_content(
  (select id from phase5_ids where key = 'direct_a'),
  '00000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
  'Phase 5 Direct Content Edited', 'Stable code after title edit', '00000000-0000-4000-8000-000000000301',
  (select id from phase5_ids where key = 'campaign_a'), 'Edited objective', 'urgent',
  (select id from phase5_actor), 'Edited internal note', 'Edited private note', 'Edited client-visible note',
  '', array['phase-5-direct', 'edited']
);

with converted as (
  select * from public.convert_idea_to_content(
    (select id from phase5_ids where key = 'idea_a'),
    'Phase 5 Converted Content', 'Converted working title',
    (select id from phase5_ids where key = 'campaign_a'),
    'Preserve the approved angle', (select id from phase5_actor),
    'Converted internal note', 'Converted private note', 'Converted client-visible note', array['phase-5-converted']
  )
)
insert into phase5_ids select 'converted_a', content_id from converted;
insert into phase5_codes
select 'converted_a', content_code from public.list_contents(
  '00000000-0000-4000-8000-000000000001', (select id from phase5_ids where key = 'converted_a')
);

insert into phase5_ids
select 'direct_b', public.save_content(
  null, '00000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002',
  'Phase 5 Client B Content', null, '00000000-0000-4000-8000-000000000301',
  (select id from phase5_ids where key = 'campaign_b'), 'Client B isolation fixture', 'normal',
  (select id from phase5_actor), null, 'Client B private note', null,
  'Direct Client B test record', array['phase-5-b']
);

select public.archive_content((select id from phase5_ids where key = 'direct_a'), 'Direct path test complete');
select public.archive_campaign((select id from phase5_ids where key = 'campaign_a'));
reset role;

do $$
begin
  if (select content_code from public.contents where id = (select id from phase5_ids where key = 'direct_a'))
     <> (select code from phase5_codes where key = 'direct_a') then
    raise exception 'Content code changed after metadata edit';
  end if;
  if (select count(distinct code) from phase5_codes) <> 2 then
    raise exception 'Content codes are not unique';
  end if;
  if exists (select 1 from phase5_codes where code !~ '^PHASE5-A-2026-[0-9]{3,}$') then
    raise exception 'Content code format is invalid';
  end if;
  if (select status from public.ideas where id = (select id from phase5_ids where key = 'idea_a')) <> 'converted' then
    raise exception 'Converted Idea status was not updated';
  end if;
  if (select source_idea_id from public.contents where id = (select id from phase5_ids where key = 'converted_a'))
     <> (select id from phase5_ids where key = 'idea_a') then
    raise exception 'Content source Idea provenance is missing';
  end if;
  if (select count(*) from public.idea_references where idea_id = (select id from phase5_ids where key = 'idea_a')) <> 1 then
    raise exception 'Idea to Reference provenance was modified';
  end if;
  if not exists (
    select 1 from public.content_contributors cc
    join public.contribution_roles cr on cr.id = cc.contribution_role_id
    where cc.content_id = (select id from phase5_ids where key = 'converted_a') and cr.code = 'idea_creator'
  ) then
    raise exception 'Idea Creator was not preserved as a Content contributor';
  end if;
  if (select count(*) from public.content_tags where content_id = (select id from phase5_ids where key = 'converted_a')) < 2 then
    raise exception 'Idea and conversion Tags were not merged';
  end if;
  if (select count(*) from public.contents where id = (select id from phase5_ids where key = 'direct_a') and record_status = 'archived') <> 1 then
    raise exception 'Archived Content was deleted or not archived';
  end if;

  begin
    perform * from public.convert_idea_to_content(
      (select id from phase5_ids where key = 'idea_a'), 'Duplicate', null, null, null, null, null, null, null, '{}'
    );
    raise exception '__duplicate_conversion_was_allowed__';
  exception when others then
    if sqlerrm = '__duplicate_conversion_was_allowed__' then raise; end if;
  end;

  begin
    perform * from public.convert_idea_to_content(
      (select id from phase5_ids where key = 'idea_not_approved'), 'Unapproved', null, null, null, null, null, null, null, '{}'
    );
    raise exception '__unapproved_conversion_was_allowed__';
  exception when others then
    if sqlerrm = '__unapproved_conversion_was_allowed__' then raise; end if;
  end;

  if exists (select 1 from public.contents where source_idea_id = (select id from phase5_ids where key = 'idea_not_approved')) then
    raise exception 'Failed conversion left a partial Content record';
  end if;
end;
$$;

delete from public.workspace_member_roles
where workspace_member_id = (
  select id from public.workspace_members
  where workspace_id = '00000000-0000-4000-8000-000000000001' and user_profile_id = (select id from phase5_actor)
)
and role_id = (
  select id from public.roles where workspace_id = '00000000-0000-4000-8000-000000000001' and code = 'super_admin'
);
insert into public.workspace_member_roles(workspace_member_id, role_id, assigned_by)
select wm.id, r.id, (select id from phase5_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'strategist_content_planner'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001' and wm.user_profile_id = (select id from phase5_actor);
insert into public.client_members(client_id, workspace_member_id, role_id, assigned_by)
select 'f5000000-0000-4000-8000-000000000001', wm.id, r.id, (select id from phase5_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'strategist_content_planner'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001' and wm.user_profile_id = (select id from phase5_actor);

set local role authenticated;
insert into phase5_results select 'strategist_content_projection', count(*)::integer, 2
from public.list_contents('00000000-0000-4000-8000-000000000001', null);
insert into phase5_results select 'strategist_direct_id_isolation', count(*)::integer, 0
from public.list_contents('00000000-0000-4000-8000-000000000001', (select id from phase5_ids where key = 'direct_b'));
insert into phase5_results select 'strategist_private_notes_masked', count(*)::integer, 0
from public.list_contents('00000000-0000-4000-8000-000000000001', null)
where private_management_notes is not null;
insert into phase5_results select 'strategist_base_rows_denied', count(*)::integer, 0
from public.contents where title like 'Phase 5%';
insert into phase5_results select 'strategist_campaign_scope', count(*)::integer, 1
from public.campaigns where name like 'Phase 5%';
reset role;

do $$
begin
  begin
    perform public.archive_content((select id from phase5_ids where key = 'converted_a'), 'Strategist must not archive');
    raise exception '__strategist_archive_was_allowed__';
  exception when others then
    if sqlerrm = '__strategist_archive_was_allowed__' then raise; end if;
  end;
end;
$$;

delete from public.client_members
where workspace_member_id = (
  select id from public.workspace_members
  where workspace_id = '00000000-0000-4000-8000-000000000001' and user_profile_id = (select id from phase5_actor)
);
delete from public.workspace_member_roles
where workspace_member_id = (
  select id from public.workspace_members
  where workspace_id = '00000000-0000-4000-8000-000000000001' and user_profile_id = (select id from phase5_actor)
);
insert into public.workspace_member_roles(workspace_member_id, role_id, assigned_by)
select wm.id, r.id, (select id from phase5_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'client_viewer'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001' and wm.user_profile_id = (select id from phase5_actor);
insert into public.client_members(client_id, workspace_member_id, role_id, assigned_by)
select 'f5000000-0000-4000-8000-000000000001', wm.id, r.id, (select id from phase5_actor)
from public.workspace_members wm
join public.roles r on r.workspace_id = wm.workspace_id and r.code = 'client_viewer'
where wm.workspace_id = '00000000-0000-4000-8000-000000000001' and wm.user_profile_id = (select id from phase5_actor);

set local role authenticated;
insert into phase5_results select 'client_viewer_content_denied', count(*)::integer, 0
from public.list_contents('00000000-0000-4000-8000-000000000001', null);
insert into phase5_results select 'client_viewer_campaign_denied', count(*)::integer, 0
from public.campaigns where name like 'Phase 5%';
reset role;

select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
set local role anon;
insert into phase5_results select 'anon_content_base_denied', count(*)::integer, 0
from public.contents where title like 'Phase 5%';
insert into phase5_results select 'anon_campaign_denied', count(*)::integer, 0
from public.campaigns where name like 'Phase 5%';
reset role;

do $$
begin
  if exists (select 1 from phase5_results where actual <> expected) then
    raise exception 'Phase 5 RLS assertion failed: %', (
      select string_agg(test_name || '=' || actual || '/' || expected, ', ' order by test_name)
      from phase5_results where actual <> expected
    );
  end if;
end;
$$;

select test_name, actual, expected from phase5_results order by test_name;

rollback;
