-- M14 non-destructive production verification. Read-only assertions only.
do $$
declare
  target_workspace uuid;
  lksoft_scope uuid;
  preserved_count integer;
  exact_dates integer;
  workflow_guard text;
begin
  select id into target_workspace from public.workspaces where name = 'ContentOS' limit 1;
  select id into lksoft_scope from public.clients where workspace_id = target_workspace and lower(btrim(name)) = 'lksoft' and ownership_type = 'internal_brand' and is_default_brand;
  if lksoft_scope is null then raise exception 'LKSoft internal brand missing'; end if;

  select count(*) into preserved_count
  from public.ideas i
  join public.contents c on c.source_idea_id = i.id and c.client_id = i.client_id and c.planned_date = i.planned_date
  join public.idea_shooting_briefs b on b.idea_id = i.id and cardinality(b.interview_questions) between 3 and 5
  where i.client_id = lksoft_scope and i.status = 'converted' and i.planning_status = 'confirmed'
    and c.record_status = 'active' and c.content_code is not null;
  if preserved_count <> 7 then raise exception 'Seven confirmed Pilot records were not preserved: %', preserved_count; end if;

  select count(*) into exact_dates from public.ideas i
  where i.client_id = lksoft_scope and i.planned_date in (
    date '2026-09-02', date '2026-09-04', date '2026-09-09', date '2026-09-11',
    date '2026-09-16', date '2026-09-18', date '2026-09-23'
  );
  if exact_dates <> 7 then raise exception 'Target publication dates changed'; end if;

  workflow_guard := lower(pg_get_functiondef('public.bulk_update_planning_items(uuid[],text,text[])'::regprocedure));
  if position('current_status' in workflow_guard) > 0 then raise exception 'Planning bulk RPC must not update Content workflow status'; end if;
  if position('shoot_scheduled_at' in workflow_guard) = 0 or position('planned_date' in workflow_guard) = 0 then raise exception 'Planning date synchronization is missing'; end if;
end $$;

select i.planned_date as target_publish_date, i.shoot_planned_at, i.planning_status,
  i.title, c.content_code, c.current_status, c.shoot_scheduled_at,
  cardinality(b.interview_questions) as interview_questions
from public.clients cl
join public.ideas i on i.client_id = cl.id
join public.contents c on c.source_idea_id = i.id
join public.idea_shooting_briefs b on b.idea_id = i.id
where lower(btrim(cl.name)) = 'lksoft' and cl.ownership_type = 'internal_brand'
  and i.planned_date between date '2026-09-01' and date '2026-09-30'
order by i.planned_date;