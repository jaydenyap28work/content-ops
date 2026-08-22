begin;
do $$
declare
  actor uuid;
  target_workspace uuid;
  target_client uuid;
  first_idea uuid;
  second_idea uuid;
  first_date date;
  created_count integer;
  linked_count integer;
begin
  select up.id into actor from public.user_profiles up where lower(up.email) = 'jaydenyap28work@gmail.com';
  select wm.workspace_id into target_workspace from public.workspace_members wm where wm.user_profile_id = actor and wm.status = 'active' limit 1;
  insert into public.clients (workspace_id, code, name, status)
  values (target_workspace, 'M12-ROLLBACK', 'M12 rollback client', 'active') returning id into target_client;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  first_idea := public.save_idea(null,target_workspace,target_client,'M12 first','','','','','',null,'','normal',actor,'','{}','{}','[]','2026-09-28');
  second_idea := public.save_idea(null,target_workspace,target_client,'M12 second','','','','','',null,'','normal',actor,'','{}','{}','[]','2026-09-29');
  select planned_date into first_date from public.ideas where id = first_idea;

  select count(*) filter (where prepared.content_created), count(*)
  into created_count, linked_count
  from public.prepare_confirmed_ideas_for_production(array[first_idea, second_idea]) prepared;
  if created_count <> 2 or linked_count <> 2 then raise exception 'Initial preparation result mismatch'; end if;
  if exists(select 1 from public.ideas where id in (first_idea,second_idea) and status <> 'converted') then raise exception 'Ideas not converted'; end if;
  if (select planned_date from public.contents where source_idea_id = first_idea) is distinct from first_date then raise exception 'Planned date not preserved'; end if;

  select count(*) filter (where prepared.content_created), count(*)
  into created_count, linked_count
  from public.prepare_confirmed_ideas_for_production(array[first_idea, second_idea]) prepared;
  if created_count <> 0 or linked_count <> 2 then raise exception 'Idempotent preparation result mismatch'; end if;
  if (select count(*) from public.contents where source_idea_id in (first_idea,second_idea)) <> 2 then raise exception 'Duplicate Content created'; end if;
end $$;
rollback;
