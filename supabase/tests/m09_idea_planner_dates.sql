begin;

do $$
declare
  actor_id uuid;
  target_workspace uuid;
  client_id uuid;
  category_id uuid;
  saved_idea_id uuid;
  converted_id uuid;
  inherited_date date;
  context_status text;
begin
  select up.id into actor_id
  from public.user_profiles up
  where lower(up.email) = 'jaydenyap28work@gmail.com';

  select wm.workspace_id into target_workspace
  from public.workspace_members wm
  where wm.user_profile_id = actor_id and wm.status = 'active'
  limit 1;

  if actor_id is null or target_workspace is null then
    raise exception 'M09 test requires the work Super Admin bootstrap';
  end if;

  insert into public.clients(workspace_id, code, name, status)
  values(target_workspace, 'M09-ROLLBACK', 'M09 rollback client', 'active')
  returning id into client_id;

  select cc.id into category_id from public.content_categories cc
  where cc.workspace_id = target_workspace and cc.is_active
  order by sort_order limit 1;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  saved_idea_id := public.save_idea(
    null, target_workspace, client_id, 'M09 planned Idea', '', '', '', '', '',
    category_id, '', 'normal', actor_id, '', '{}'::uuid[], array['M09'], '[]'::jsonb,
    date '2026-09-30'
  );

  if (select planned_date from public.ideas where id = saved_idea_id) <> date '2026-09-30' then
    raise exception 'Idea planned_date was not saved';
  end if;

  perform public.change_idea_status(saved_idea_id, 'evaluating', null);
  perform public.change_idea_status(saved_idea_id, 'approved', null);

  select content_id into converted_id
  from public.convert_idea_to_content(saved_idea_id, '', '', null, '', actor_id, '', '', '', '{}');

  select planned_date into inherited_date from public.contents where id = converted_id;
  if inherited_date <> date '2026-09-30' then
    raise exception 'Converted Content did not inherit Idea planned_date';
  end if;

  select linked_content_status into context_status
  from public.list_idea_planner_context(target_workspace) planner
  where planner.idea_id = saved_idea_id;
  if context_status <> 'draft' then
    raise exception 'Planner context did not expose linked Content status';
  end if;
end;
$$;

rollback;
