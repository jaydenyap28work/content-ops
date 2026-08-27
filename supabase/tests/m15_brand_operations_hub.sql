-- M15 non-destructive verification. Read-only assertions only.
do $$
declare
  target_workspace uuid;
  lksoft_scope uuid;
  preserved_count integer;
  exact_dates integer;
  platform_count integer;
  drive_count integer;
  confirm_definition text;
  brand_assets_rls boolean;
begin
  select id into target_workspace from public.workspaces where name='ContentOS' limit 1;
  select id into lksoft_scope from public.clients where workspace_id=target_workspace and lower(btrim(name))='lksoft'
    and ownership_type='internal_brand' and is_default_brand and status='active';
  if lksoft_scope is null then raise exception 'LKSoft internal brand missing'; end if;

  select count(*) into preserved_count
  from public.ideas i
  join public.contents c on c.source_idea_id=i.id and c.client_id=i.client_id and c.planned_date=i.planned_date
  join public.idea_shooting_briefs b on b.idea_id=i.id and b.client_id=i.client_id and cardinality(b.interview_questions) between 3 and 5
  where i.client_id=lksoft_scope and i.status='converted' and i.planning_status='confirmed'
    and c.record_status='active' and c.content_code is not null;
  if preserved_count <> 7 then raise exception 'Seven Pilot records were not preserved: %',preserved_count; end if;

  select count(*) into exact_dates from public.ideas i
  join public.contents c on c.source_idea_id=i.id and c.planned_date=i.planned_date
  where i.client_id=lksoft_scope and i.planned_date in (
    date '2026-09-02',date '2026-09-04',date '2026-09-09',date '2026-09-11',
    date '2026-09-16',date '2026-09-18',date '2026-09-23'
  );
  if exact_dates <> 7 then raise exception 'Pilot target publication dates changed'; end if;

  select count(*) into platform_count from public.platforms where code in ('facebook','instagram','youtube','xhs','threads','lemon8') and is_active;
  if platform_count <> 6 then raise exception 'Brand account platform matrix incomplete: %',platform_count; end if;

  select count(*) into drive_count from public.brand_assets where client_id=lksoft_scope and name='LKSoft 常用素材库'
    and location='https://drive.google.com/drive/folders/1t-0wy9Fu-Y8XCa3UQh-irWq_XjABOwVt?usp=sharing' and is_recommended and status='active';
  if drive_count <> 1 then raise exception 'LKSoft Drive index must exist exactly once: %',drive_count; end if;

  select relrowsecurity into brand_assets_rls from pg_class where oid='public.brand_assets'::regclass;
  if not brand_assets_rls then raise exception 'Brand Assets RLS is not enabled'; end if;

  confirm_definition:=lower(pg_get_functiondef('public.confirm_idea_for_production(uuid)'::regprocedure));
  if position('for update' in confirm_definition)=0 or position('convert_idea_to_content' in confirm_definition)=0
    or position('created_new' in confirm_definition)=0 then raise exception 'Confirm-to-Production idempotency/locking guard missing'; end if;
end $$;

select i.planned_date as target_publish_date,i.planning_status,i.title,c.content_code,c.current_status,
  c.shoot_scheduled_at,cardinality(b.interview_questions) as interview_questions
from public.clients cl
join public.ideas i on i.client_id=cl.id
join public.contents c on c.source_idea_id=i.id
join public.idea_shooting_briefs b on b.idea_id=i.id
where lower(btrim(cl.name))='lksoft' and cl.ownership_type='internal_brand'
  and i.planned_date between date '2026-09-01' and date '2026-09-30'
order by i.planned_date;