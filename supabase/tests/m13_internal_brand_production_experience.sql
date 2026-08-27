-- M13 non-destructive production verification. Read-only assertions only.
do $$
declare
  target_workspace uuid;
  lksoft_scope uuid;
  idea_count integer;
  content_count integer;
  preserved_count integer;
  september_plan_count integer;
begin
  select id into target_workspace from public.workspaces where name = 'ContentOS' limit 1;
  if target_workspace is null then raise exception 'ContentOS workspace missing'; end if;

  select id into lksoft_scope
  from public.clients
  where workspace_id = target_workspace and lower(btrim(name)) = 'lksoft'
    and ownership_type = 'internal_brand' and is_default_brand and status = 'active';
  if lksoft_scope is null then raise exception 'LKSoft Internal Brand classification missing'; end if;

  select count(*) into idea_count from public.ideas where client_id = lksoft_scope and planned_date between date '2026-09-01' and date '2026-09-30';
  select count(*) into content_count from public.contents where client_id = lksoft_scope and planned_date between date '2026-09-01' and date '2026-09-30' and record_status = 'active';
  select count(*) into preserved_count
  from public.ideas i
  join public.contents c on c.source_idea_id = i.id and c.client_id = i.client_id and c.planned_date = i.planned_date
  join public.idea_shooting_briefs b on b.idea_id = i.id and b.client_id = i.client_id
  where i.client_id = lksoft_scope and i.status = 'converted' and cardinality(b.interview_questions) between 3 and 5;
  if idea_count <> 7 or content_count <> 7 or preserved_count <> 7 then
    raise exception 'Pilot preservation mismatch ideas %, contents %, briefs/provenance %', idea_count, content_count, preserved_count;
  end if;

  -- The function requires an authenticated context in live execution; its SQL
  -- definition is inspected here to prove PLAN dedupe remains present.
  if position('not exists' in lower(pg_get_functiondef('public.list_calendar_events(uuid,date,date)'::regprocedure))) = 0 then
    raise exception 'Calendar Idea-to-Content dedupe guard missing';
  end if;

  select count(*) into september_plan_count
  from public.contents c
  where c.client_id = lksoft_scope and c.planned_date in (
    date '2026-09-02', date '2026-09-04', date '2026-09-09', date '2026-09-11',
    date '2026-09-16', date '2026-09-18', date '2026-09-23'
  );
  if september_plan_count <> 7 then raise exception 'September Pilot dates changed'; end if;
end $$;

select
  cl.name as brand,
  cl.ownership_type,
  cl.is_default_brand,
  i.planned_date,
  i.title,
  i.status as idea_status,
  c.content_code,
  c.current_status as content_status,
  cardinality(b.interview_questions) as interview_questions,
  cardinality(b.key_talking_points) as talking_points
from public.clients cl
join public.ideas i on i.client_id = cl.id
join public.contents c on c.source_idea_id = i.id
join public.idea_shooting_briefs b on b.idea_id = i.id
where lower(btrim(cl.name)) = 'lksoft'
  and cl.ownership_type = 'internal_brand'
  and i.planned_date between date '2026-09-01' and date '2026-09-30'
order by i.planned_date;