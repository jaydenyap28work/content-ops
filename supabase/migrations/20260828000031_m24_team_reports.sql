-- M24: factual Team Reports over existing operational history.
-- No production records are copied. One immutable Idea confirmation event is
-- backfilled from the existing Content conversion record where available.

create table public.idea_planning_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  idea_id uuid not null references public.ideas(id) on delete restrict,
  team_member_id uuid references public.team_members(id) on delete restrict,
  actor_user_id uuid not null references public.user_profiles(id) on delete restrict,
  event_type text not null check(event_type in ('confirmed_for_production')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  unique(idea_id,event_type)
);
create index idea_planning_events_workspace_occurred_idx
  on public.idea_planning_events(workspace_id,occurred_at desc,event_type);
create index ideas_workspace_provider_created_idx
  on public.ideas(workspace_id,idea_provider_team_member_id,created_at desc);
create index workflow_events_workspace_type_occurred_idx
  on public.workflow_events(workspace_id,event_type,occurred_at desc);
create index approvals_approver_decided_idx
  on public.approvals(approver_user_id,decided_at desc,content_id);
create index publications_publisher_published_idx
  on public.publications(assigned_publisher_user_id,published_at desc,content_id);

alter table public.idea_planning_events enable row level security;
revoke all on public.idea_planning_events from anon,authenticated;
create trigger idea_planning_events_immutable before update or delete on public.idea_planning_events
for each row execute function public.prevent_immutable_history_mutation();

create or replace function public.capture_idea_confirmation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.planning_status='confirmed' and old.planning_status is distinct from 'confirmed' then
    insert into public.idea_planning_events(
      workspace_id,client_id,idea_id,team_member_id,actor_user_id,event_type,occurred_at,metadata
    ) values(
      new.workspace_id,new.client_id,new.id,new.idea_provider_team_member_id,auth.uid(),
      'confirmed_for_production',now(),jsonb_build_object('source','workflow_action')
    ) on conflict(idea_id,event_type) do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.capture_idea_confirmation() from public,anon,authenticated;
create trigger ideas_capture_confirmation after update of planning_status on public.ideas
for each row execute function public.capture_idea_confirmation();

insert into public.idea_planning_events(
  workspace_id,client_id,idea_id,team_member_id,actor_user_id,event_type,occurred_at,metadata
)
select i.workspace_id,i.client_id,i.id,i.idea_provider_team_member_id,c.created_by,
  'confirmed_for_production',c.created_at,
  jsonb_build_object('source','historical_content_conversion','content_id',c.id)
from public.ideas i
join public.contents c on c.source_idea_id=i.id
where i.planning_status='confirmed'
on conflict(idea_id,event_type) do nothing;

create or replace function public.can_view_team_reports(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_workspace_super_admin(target_workspace_id)
    or public.has_workspace_role(target_workspace_id,'internal_manager')
    or public.has_workspace_role(target_workspace_id,'publisher_marketing');
$$;

create or replace function public.list_team_report(
  target_workspace_id uuid,
  target_from timestamptz,
  target_to timestamptz,
  target_team_member_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare report jsonb;
begin
  if not public.can_view_team_reports(target_workspace_id) then raise exception 'Team Report access denied'; end if;
  if target_from is null or target_to is null or target_from>=target_to
    or target_to-target_from>interval '366 days' then raise exception 'Invalid Team Report date range'; end if;
  if target_team_member_id is not null and not exists(
    select 1 from public.team_members where id=target_team_member_id and workspace_id=target_workspace_id
  ) then raise exception 'Team Member is outside this Workspace'; end if;

  with facts as (
    select 'idea-submitted-'||i.id event_key,'ideas_submitted' metric,i.idea_provider_team_member_id team_member_id,
      'idea_provider' role_code,i.created_at occurred_at,'idea' entity_type,i.id entity_id,null::uuid content_id,
      i.title,'idea_submitted' action_code,i.planning_status result
    from public.ideas i
    where i.workspace_id=target_workspace_id and i.created_at>=target_from and i.created_at<target_to

    union all
    select 'idea-confirmed-'||e.id,'ideas_confirmed',coalesce(e.team_member_id,i.idea_provider_team_member_id),
      'idea_provider',e.occurred_at,'idea',i.id,c.id,i.title,'confirmed_for_production','confirmed'
    from public.idea_planning_events e join public.ideas i on i.id=e.idea_id
    left join public.contents c on c.source_idea_id=i.id
    where e.workspace_id=target_workspace_id and e.event_type='confirmed_for_production'
      and e.occurred_at>=target_from and e.occurred_at<target_to

    union all
    select 'shoot-'||we.id,'shoots_completed',cc.team_member_id,cr.code,we.occurred_at,'content',c.id,c.id,c.title,
      'shoot_completed',we.to_state
    from public.workflow_events we join public.contents c on c.id=we.content_id
    join public.content_contributors cc on cc.content_id=c.id and cc.created_at<=we.occurred_at
      and (cc.removed_at is null or cc.removed_at>=we.occurred_at)
    join public.contribution_roles cr on cr.id=cc.contribution_role_id and cr.code in ('director','shooter')
    where we.workspace_id=target_workspace_id and we.event_type='shoot_completed'
      and we.occurred_at>=target_from and we.occurred_at<target_to

    union all
    select 'shoot-'||we.id,'shoots_completed',null,'unassigned',we.occurred_at,'content',c.id,c.id,c.title,
      'shoot_completed',we.to_state
    from public.workflow_events we join public.contents c on c.id=we.content_id
    where we.workspace_id=target_workspace_id and we.event_type='shoot_completed'
      and we.occurred_at>=target_from and we.occurred_at<target_to

    union all
    select 'edit-'||we.id,'edits_completed',cc.team_member_id,'editor',we.occurred_at,'content',c.id,c.id,c.title,
      we.event_type,we.to_state
    from public.workflow_events we join public.contents c on c.id=we.content_id
    join public.content_contributors cc on cc.content_id=c.id and cc.created_at<=we.occurred_at
      and (cc.removed_at is null or cc.removed_at>=we.occurred_at)
    join public.contribution_roles cr on cr.id=cc.contribution_role_id and cr.code='editor'
    where we.workspace_id=target_workspace_id and we.event_type in ('first_cut_submitted','revision_submitted','final_media_submitted')
      and we.occurred_at>=target_from and we.occurred_at<target_to

    union all
    select 'edit-'||we.id,'edits_completed',null,'unassigned',we.occurred_at,'content',c.id,c.id,c.title,
      we.event_type,we.to_state
    from public.workflow_events we join public.contents c on c.id=we.content_id
    where we.workspace_id=target_workspace_id and we.event_type in ('first_cut_submitted','revision_submitted','final_media_submitted')
      and we.occurred_at>=target_from and we.occurred_at<target_to

    union all
    select 'review-'||a.id,'reviews_completed',tm.id,'reviewer',a.decided_at,'content',c.id,c.id,c.title,
      'review_decided',a.result
    from public.approvals a join public.contents c on c.id=a.content_id
    left join public.team_members tm on tm.workspace_id=c.workspace_id and tm.auth_user_id=a.approver_user_id
    where c.workspace_id=target_workspace_id and a.decided_at>=target_from and a.decided_at<target_to

    union all
    select 'publish-'||we.id,'published',tm.id,'publisher',we.occurred_at,'content',c.id,c.id,c.title,
      'publication_published','published'
    from public.workflow_events we join public.contents c on c.id=we.content_id
    join public.publications p on p.id=we.publication_id
    left join public.team_members tm on tm.workspace_id=c.workspace_id and tm.auth_user_id=p.assigned_publisher_user_id
    where we.workspace_id=target_workspace_id and we.event_type='publication_published'
      and we.occurred_at>=target_from and we.occurred_at<target_to
  ), filtered as (
    select * from facts where target_team_member_id is null or team_member_id=target_team_member_id
  )
  select jsonb_build_object(
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',tm.id,'name',tm.name,'status',tm.status) order by tm.name)
      from public.team_members tm where tm.workspace_id=target_workspace_id),'[]'::jsonb),
    'actions',coalesce((select jsonb_agg(jsonb_build_object(
      'eventKey',f.event_key,'metric',f.metric,'teamMemberId',f.team_member_id,'roleCode',f.role_code,
      'occurredAt',f.occurred_at,'entityType',f.entity_type,'entityId',f.entity_id,'contentId',f.content_id,
      'title',f.title,'actionCode',f.action_code,'result',f.result
    ) order by f.occurred_at desc) from filtered f),'[]'::jsonb)
  ) into report;
  return report;
end; $$;

revoke all on function public.can_view_team_reports(uuid),public.list_team_report(uuid,timestamptz,timestamptz,uuid) from public,anon;
grant execute on function public.can_view_team_reports(uuid),public.list_team_report(uuid,timestamptz,timestamptz,uuid) to authenticated;
notify pgrst,'reload schema';
