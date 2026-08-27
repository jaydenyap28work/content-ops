-- M13: Internal Brand ownership and production planning read models.
-- The existing clients table remains the security boundary to preserve every FK,
-- history row, content code, and RLS policy. ownership_type is the product meaning.

alter table public.clients
  add column if not exists ownership_type text not null default 'external_client'
  check (ownership_type in ('internal_brand', 'external_client'));

alter table public.clients
  add column if not exists is_default_brand boolean not null default false;

create unique index if not exists clients_workspace_default_brand_idx
  on public.clients(workspace_id)
  where ownership_type = 'internal_brand' and is_default_brand;

create index if not exists clients_workspace_ownership_status_idx
  on public.clients(workspace_id, ownership_type, status);

comment on column public.clients.ownership_type is
  'Product ownership classification. internal_brand records are not external Clients; the legacy table name remains an RLS compatibility boundary.';

-- Idempotent in-place classification. No production records or relationships move.
update public.clients
set ownership_type = 'internal_brand', is_default_brand = true
where lower(btrim(name)) = 'lksoft'
  and status = 'active';

drop function if exists public.list_contents(uuid, uuid);
create function public.list_contents(target_workspace_id uuid, target_content_id uuid default null)
returns table(
  id uuid, workspace_id uuid, client_id uuid, source_idea_id uuid, content_code text,
  title text, working_title text, category_id uuid, campaign_id uuid, objective text,
  priority text, current_status text, current_owner_user_id uuid, current_owner_name text,
  internal_notes text, private_management_notes text, client_visible_notes text,
  direct_creation_reason text, record_status text, created_by uuid, created_at timestamptz,
  updated_at timestamptz, archived_at timestamptz, archive_reason text, planned_date date,
  ownership_name text, ownership_type text, is_default_brand boolean
)
language sql stable security definer set search_path = '' as $$
  select
    c.id, c.workspace_id, c.client_id, c.source_idea_id, c.content_code, c.title, c.working_title,
    c.category_id, c.campaign_id, c.objective, c.priority, c.current_status, c.current_owner_user_id,
    owner.display_name, c.internal_notes,
    case when public.can_archive_content_client(c.client_id) then c.private_management_notes else null end,
    c.client_visible_notes, c.direct_creation_reason, c.record_status, c.created_by,
    c.created_at, c.updated_at, c.archived_at, c.archive_reason, c.planned_date,
    scope.name, scope.ownership_type, scope.is_default_brand
  from public.contents c
  join public.clients scope on scope.id = c.client_id
  left join public.user_profiles owner on owner.id = c.current_owner_user_id
  where c.workspace_id = target_workspace_id
    and (target_content_id is null or c.id = target_content_id)
    and public.can_view_content(c.id)
  order by c.planned_date nulls last, c.updated_at desc;
$$;

revoke all on function public.list_contents(uuid, uuid) from public, anon;
grant execute on function public.list_contents(uuid, uuid) to authenticated;

-- Calendar remains a derived read model. Converted Ideas are deduplicated by the
-- existing Content event, and review timing uses actual immutable workflow events.
create or replace function public.list_calendar_events(target_workspace_id uuid,target_from date,target_to date)
returns table(event_key text,event_type text,event_at timestamptz,title text,client_name text,status text,entity_type text,entity_id uuid)
language sql stable security definer set search_path='' as $$
  select 'plan-content-'||c.id,'PLAN',c.planned_date::timestamptz,c.title,scope.name,c.current_status,'content',c.id
  from public.contents c join public.clients scope on scope.id=c.client_id
  where c.workspace_id=target_workspace_id and c.planned_date between target_from and target_to and c.record_status='active' and public.can_view_content(c.id)
  union all
  select 'plan-idea-'||i.id,'PLAN',i.planned_date::timestamptz,i.title,scope.name,i.status,'idea',i.id
  from public.ideas i join public.clients scope on scope.id=i.client_id
  where i.workspace_id=target_workspace_id and i.planned_date between target_from and target_to and public.can_view_idea(i.id)
    and not exists(select 1 from public.contents c where c.source_idea_id=i.id)
  union all
  select 'shoot-'||c.id,'SHOOT',c.shoot_scheduled_at,c.title,scope.name,c.current_status,'content',c.id
  from public.contents c join public.clients scope on scope.id=c.client_id
  where c.workspace_id=target_workspace_id and c.shoot_scheduled_at::date between target_from and target_to and c.record_status='active' and public.can_view_content(c.id)
  union all
  select 'review-'||we.id,'REVIEW',we.occurred_at,c.title,scope.name,we.to_state,'content',c.id
  from public.workflow_events we
  join public.contents c on c.id=we.content_id
  join public.clients scope on scope.id=c.client_id
  where c.workspace_id=target_workspace_id
    and we.occurred_at::date between target_from and target_to
    and we.to_state in ('first_cut_submitted','internal_review','revision_required','client_review','approved')
    and c.record_status='active' and public.can_view_content(c.id)
  union all
  select 'publish-'||p.id,'PUBLISH',coalesce(p.published_at,p.scheduled_at),c.title,scope.name,p.status,'content',c.id
  from public.publications p join public.contents c on c.id=p.content_id join public.clients scope on scope.id=p.client_id
  where p.workspace_id=target_workspace_id and coalesce(p.published_at,p.scheduled_at)::date between target_from and target_to and public.can_view_content(c.id)
  order by 3,2;
$$;

revoke all on function public.list_calendar_events(uuid,date,date) from public,anon;
grant execute on function public.list_calendar_events(uuid,date,date) to authenticated;

notify pgrst,'reload schema';
