-- ContentOS M08: Client-scoped publication planning and append-only manual analytics.

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  platform_id uuid not null references public.platforms(id) on delete restrict,
  account_name text not null check (btrim(account_name)<>''),
  account_handle text not null check (btrim(account_handle)<>''),
  external_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id,platform_id,account_handle)
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  content_id uuid not null references public.contents(id) on delete restrict,
  platform_id uuid not null references public.platforms(id) on delete restrict,
  social_account_id uuid not null references public.social_accounts(id) on delete restrict,
  publication_sequence integer not null check (publication_sequence>0),
  is_required boolean not null default true,
  assigned_publisher_user_id uuid not null references public.user_profiles(id) on delete restrict,
  scheduled_at timestamptz,
  published_at timestamptz,
  post_url text,
  status text not null default 'draft' check (status in ('draft','scheduled','published','failed','cancelled')),
  note text,
  failure_reason text,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publications_content_platform_sequence_key unique(content_id,platform_id,publication_sequence),
  constraint publication_state_check check (
    (status='draft' and published_at is null and failure_reason is null)
    or (status='scheduled' and scheduled_at is not null and published_at is null and failure_reason is null)
    or (status='published' and published_at is not null and nullif(btrim(post_url),'') is not null and failure_reason is null)
    or (status='failed' and published_at is null and nullif(btrim(failure_reason),'') is not null)
    or (status='cancelled' and published_at is null)
  )
);

create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  publication_id uuid not null references public.publications(id) on delete restrict,
  captured_at timestamptz not null,
  snapshot_type text not null check (snapshot_type in ('24h','7d','30d','current')),
  data_source text not null check (data_source in ('manual','csv','scraper','api','client_backend')),
  views_or_plays bigint check (views_or_plays is null or views_or_plays>=0),
  reach bigint check (reach is null or reach>=0),
  impressions bigint check (impressions is null or impressions>=0),
  likes bigint check (likes is null or likes>=0),
  comments bigint check (comments is null or comments>=0),
  shares bigint check (shares is null or shares>=0),
  saves_or_collects bigint check (saves_or_collects is null or saves_or_collects>=0),
  clicks bigint check (clicks is null or clicks>=0),
  followers_gained bigint check (followers_gained is null or followers_gained>=0),
  platform_metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(platform_metrics)='object'),
  entered_by uuid not null references public.user_profiles(id) on delete restrict,
  note text,
  created_at timestamptz not null default now()
);

create index social_accounts_client_platform_active_idx on public.social_accounts(client_id,platform_id,is_active);
create index publications_client_status_schedule_idx on public.publications(client_id,status,scheduled_at);
create index publications_content_required_status_idx on public.publications(content_id,is_required,status);
create index publications_publisher_status_idx on public.publications(assigned_publisher_user_id,status);
create index analytics_snapshots_publication_capture_idx on public.analytics_snapshots(publication_id,captured_at desc);
create index analytics_snapshots_client_type_capture_idx on public.analytics_snapshots(client_id,snapshot_type,captured_at desc);

create trigger social_accounts_set_updated_at before update on public.social_accounts for each row execute function public.set_updated_at();
create trigger publications_set_updated_at before update on public.publications for each row execute function public.set_updated_at();
create trigger analytics_snapshots_immutable before update or delete on public.analytics_snapshots for each row execute function public.prevent_immutable_history_mutation();

alter table public.workflow_events drop constraint workflow_events_event_type_check;
alter table public.workflow_events add constraint workflow_events_event_type_check check(event_type in(
  'marked_ready_to_shoot','shoot_started','shoot_completed','editing_started','first_cut_submitted','review_started',
  'revision_requested','revision_started','revision_submitted','sent_to_client_review','approval_recorded',
  'final_media_submitted','final_approved','approval_overridden','publication_prepared','publication_scheduled',
  'publication_published','publication_failed','publication_cancelled','analytics_snapshot_added','content_completed'
));
alter table public.workflow_events add column publication_id uuid references public.publications(id) on delete restrict;
alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check check(entity_type in(
  'content','content_contributor','script_version','media_version','revision_request','approval_requirement','approval',
  'social_account','publication','analytics_snapshot'
));

create or replace function public.can_manage_publication_plan(target_content_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.can_manage_content_assignments(target_content_id);
$$;
create or replace function public.can_execute_publication(target_publication_id uuid,target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.publications p where p.id=target_publication_id
    and p.assigned_publisher_user_id=target_user_id and public.can_view_content(p.content_id)
    and public.has_workspace_role(p.workspace_id,'publisher_marketing')
    and public.has_active_content_assignment(p.content_id,'publisher',target_user_id));
$$;
create or replace function public.can_update_publication_analytics(target_publication_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.publications p where p.id=target_publication_id and (
    public.can_manage_content_assignments(p.content_id) or public.can_execute_publication(p.id)
  ));
$$;
create or replace function public.content_publication_state(target_content_id uuid)
returns text language sql stable security definer set search_path='' as $$
  with counts as(select count(*) filter(where is_required) required_count,
    count(*) filter(where is_required and status='published') published_count,
    bool_or(status='failed' or (is_required and status='cancelled')) has_failure from public.publications where content_id=target_content_id)
  select case when coalesce(has_failure,false) then 'needs_attention'
    when required_count=0 or published_count=0 then 'not_published'
    when published_count<required_count then 'partially_published'
    else 'fully_published' end from counts;
$$;

revoke all on function public.can_manage_publication_plan(uuid),public.can_execute_publication(uuid,uuid),public.can_update_publication_analytics(uuid),public.content_publication_state(uuid) from public,anon;
grant execute on function public.can_manage_publication_plan(uuid),public.can_execute_publication(uuid,uuid),public.can_update_publication_analytics(uuid),public.content_publication_state(uuid) to authenticated;

alter table public.social_accounts enable row level security;
alter table public.publications enable row level security;
alter table public.analytics_snapshots enable row level security;
create policy "Authorized internal users can view Social Accounts" on public.social_accounts for select to authenticated
using(exists(select 1 from public.clients c where c.id=client_id and public.is_internal_workspace_member(c.workspace_id) and (public.is_workspace_super_admin(c.workspace_id) or public.has_active_client_access(c.id))));
create policy "Authorized internal users can view Publications" on public.publications for select to authenticated using(public.can_view_content(content_id));
create policy "Authorized internal users can view Analytics" on public.analytics_snapshots for select to authenticated
using(exists(select 1 from public.publications p where p.id=publication_id and p.client_id=analytics_snapshots.client_id and p.workspace_id=analytics_snapshots.workspace_id and public.can_view_content(p.content_id)));
revoke insert,update,delete on public.social_accounts,public.publications,public.analytics_snapshots from anon,authenticated;

create or replace function public.save_social_account(target_account_id uuid,target_client_id uuid,target_platform_id uuid,target_account_name text,target_account_handle text,target_external_url text default null,target_active boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; workspace_scope uuid;
begin
  select workspace_id into workspace_scope from public.clients where id=target_client_id and status='active';
  if workspace_scope is null or not public.can_manage_content_client(target_client_id) then raise exception 'Social Account access denied'; end if;
  if not exists(select 1 from public.platforms where id=target_platform_id and is_active) then raise exception 'Active Platform required'; end if;
  if nullif(btrim(target_account_name),'') is null or nullif(btrim(target_account_handle),'') is null then raise exception 'Account name and handle are required'; end if;
  if target_account_id is null then
    insert into public.social_accounts(client_id,platform_id,account_name,account_handle,external_url,is_active)
    values(target_client_id,target_platform_id,btrim(target_account_name),btrim(target_account_handle),nullif(btrim(target_external_url),''),target_active) returning id into saved;
  else
    update public.social_accounts set account_name=btrim(target_account_name),account_handle=btrim(target_account_handle),external_url=nullif(btrim(target_external_url),''),is_active=target_active
    where id=target_account_id and client_id=target_client_id returning id into saved;
    if saved is null then raise exception 'Social Account not found'; end if;
  end if;
  return saved;
end; $$;

create or replace function public.create_publication(target_content_id uuid,target_platform_id uuid,target_social_account_id uuid,target_publisher_user_id uuid,target_required boolean default true,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; saved uuid; next_sequence integer; old_summary text; new_summary text;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.record_status<>'active' or c.current_status not in('approved','ready_for_publishing','analytics_tracking') then raise exception 'Approved Content required'; end if;
  if not public.can_manage_publication_plan(c.id) then raise exception 'Publication planning access denied'; end if;
  if not exists(select 1 from public.social_accounts sa where sa.id=target_social_account_id and sa.client_id=c.client_id and sa.platform_id=target_platform_id and sa.is_active) then raise exception 'Active Social Account must match Content Client and Platform'; end if;
  if not(exists(select 1 from public.workspace_members wm join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id join public.roles r on r.id=wmr.role_id join public.user_profiles up on up.id=wm.user_profile_id where wm.workspace_id=c.workspace_id and wm.user_profile_id=target_publisher_user_id and wm.status='active' and up.status='active' and r.code='publisher_marketing' and r.is_active) and public.has_active_content_assignment(c.id,'publisher',target_publisher_user_id)) then raise exception 'Assigned Publisher must have active role and Content assignment'; end if;
  old_summary:=public.content_publication_state(c.id);
  select coalesce(max(publication_sequence),0)+1 into next_sequence from public.publications where content_id=c.id and platform_id=target_platform_id;
  insert into public.publications(workspace_id,client_id,content_id,platform_id,social_account_id,publication_sequence,is_required,assigned_publisher_user_id,note,created_by)
  values(c.workspace_id,c.client_id,c.id,target_platform_id,target_social_account_id,next_sequence,target_required,target_publisher_user_id,nullif(btrim(target_note),''),auth.uid()) returning id into saved;
  new_summary:=public.content_publication_state(c.id);
  if c.current_status='approved' then perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='ready_for_publishing' where id=c.id; perform set_config('contentos.workflow_action','',true); end if;
  insert into public.workflow_events(workspace_id,client_id,content_id,actor_user_id,event_type,from_state,to_state,notes,publication_id,metadata)
  values(c.workspace_id,c.client_id,c.id,auth.uid(),'publication_prepared',c.current_status,case when c.current_status='approved' then 'ready_for_publishing' else c.current_status end,nullif(btrim(target_note),''),saved,jsonb_build_object('publication_state_from',old_summary,'publication_state_to',new_summary));
  return saved;
end; $$;

create or replace function public.schedule_publication(target_publication_id uuid,expected_status text,target_scheduled_at timestamptz,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.publications%rowtype; event_id uuid;
begin
  select * into p from public.publications where id=target_publication_id for update;
  if p.id is null or p.status is distinct from expected_status then raise exception 'Stale Publication Action'; end if;
  if expected_status not in('draft','scheduled','failed') or target_scheduled_at is null then raise exception 'Illegal Publication schedule transition'; end if;
  if not public.can_execute_publication(p.id) then raise exception 'Assigned Publisher permission required'; end if;
  update public.publications set status='scheduled',scheduled_at=target_scheduled_at,failure_reason=null,note=coalesce(nullif(btrim(target_note),''),note) where id=p.id;
  insert into public.workflow_events(workspace_id,client_id,content_id,actor_user_id,event_type,from_state,to_state,notes,publication_id,metadata)
  values(p.workspace_id,p.client_id,p.content_id,auth.uid(),'publication_scheduled',(select current_status from public.contents where id=p.content_id),(select current_status from public.contents where id=p.content_id),nullif(btrim(target_note),''),p.id,jsonb_build_object('publication_status_from',p.status,'publication_status_to','scheduled','scheduled_at',target_scheduled_at)) returning id into event_id;
  return event_id;
end; $$;

create or replace function public.mark_publication_published(target_publication_id uuid,expected_status text,target_published_at timestamptz,target_post_url text,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.publications%rowtype; c public.contents%rowtype; event_id uuid; old_summary text; new_summary text;
begin
  select * into p from public.publications where id=target_publication_id for update;
  select * into c from public.contents where id=p.content_id for update;
  if p.id is null or p.status is distinct from expected_status then raise exception 'Stale Publication Action'; end if;
  if expected_status not in('draft','scheduled','failed') or target_published_at is null or nullif(btrim(target_post_url),'') is null then raise exception 'Published time and URL are required'; end if;
  if not public.can_execute_publication(p.id) then raise exception 'Assigned Publisher permission required'; end if;
  old_summary:=public.content_publication_state(c.id);
  update public.publications set status='published',published_at=target_published_at,post_url=btrim(target_post_url),failure_reason=null,note=coalesce(nullif(btrim(target_note),''),note) where id=p.id;
  new_summary:=public.content_publication_state(c.id);
  if c.current_status='ready_for_publishing' then perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='analytics_tracking' where id=c.id; perform set_config('contentos.workflow_action','',true); end if;
  insert into public.workflow_events(workspace_id,client_id,content_id,actor_user_id,event_type,from_state,to_state,notes,publication_id,metadata)
  values(p.workspace_id,p.client_id,p.content_id,auth.uid(),'publication_published',c.current_status,case when c.current_status='ready_for_publishing' then 'analytics_tracking' else c.current_status end,nullif(btrim(target_note),''),p.id,jsonb_build_object('publication_state_from',old_summary,'publication_state_to',new_summary,'published_at',target_published_at,'post_url',btrim(target_post_url))) returning id into event_id;
  return event_id;
end; $$;

create or replace function public.mark_publication_failed(target_publication_id uuid,expected_status text,target_reason text,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.publications%rowtype; event_id uuid;
begin
  select * into p from public.publications where id=target_publication_id for update;
  if p.id is null or p.status is distinct from expected_status then raise exception 'Stale Publication Action'; end if;
  if expected_status not in('draft','scheduled') or nullif(btrim(target_reason),'') is null then raise exception 'Failure reason is required'; end if;
  if not public.can_execute_publication(p.id) then raise exception 'Assigned Publisher permission required'; end if;
  update public.publications set status='failed',published_at=null,failure_reason=btrim(target_reason),note=coalesce(nullif(btrim(target_note),''),note) where id=p.id;
  insert into public.workflow_events(workspace_id,client_id,content_id,actor_user_id,event_type,from_state,to_state,notes,publication_id,metadata)
  values(p.workspace_id,p.client_id,p.content_id,auth.uid(),'publication_failed',(select current_status from public.contents where id=p.content_id),(select current_status from public.contents where id=p.content_id),nullif(btrim(target_note),''),p.id,jsonb_build_object('reason',btrim(target_reason))) returning id into event_id; return event_id;
end; $$;

create or replace function public.cancel_publication(target_publication_id uuid,expected_status text,target_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.publications%rowtype; event_id uuid;
begin
  select * into p from public.publications where id=target_publication_id for update;
  if p.id is null or p.status is distinct from expected_status or expected_status='published' then raise exception 'Stale or illegal Publication cancellation'; end if;
  if not public.can_execute_publication(p.id) or nullif(btrim(target_reason),'') is null then raise exception 'Assigned Publisher and cancellation reason required'; end if;
  update public.publications set status='cancelled',published_at=null,failure_reason=null,note=btrim(target_reason) where id=p.id;
  insert into public.workflow_events(workspace_id,client_id,content_id,actor_user_id,event_type,from_state,to_state,notes,publication_id)
  values(p.workspace_id,p.client_id,p.content_id,auth.uid(),'publication_cancelled',(select current_status from public.contents where id=p.content_id),(select current_status from public.contents where id=p.content_id),btrim(target_reason),p.id) returning id into event_id; return event_id;
end; $$;

create or replace function public.add_manual_analytics_snapshot(target_publication_id uuid,target_captured_at timestamptz,target_snapshot_type text,target_views_or_plays bigint default null,target_reach bigint default null,target_impressions bigint default null,target_likes bigint default null,target_comments bigint default null,target_shares bigint default null,target_saves_or_collects bigint default null,target_clicks bigint default null,target_followers_gained bigint default null,target_platform_metrics jsonb default '{}'::jsonb,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.publications%rowtype; saved uuid; cstate text;
begin
  select * into p from public.publications where id=target_publication_id for update;
  if p.id is null or p.status<>'published' then raise exception 'Published Publication required'; end if;
  if not public.can_update_publication_analytics(p.id) then raise exception 'Analytics access denied'; end if;
  if target_captured_at is null or target_snapshot_type not in('24h','7d','30d','current') then raise exception 'Valid snapshot type and captured time required'; end if;
  insert into public.analytics_snapshots(workspace_id,client_id,publication_id,captured_at,snapshot_type,data_source,views_or_plays,reach,impressions,likes,comments,shares,saves_or_collects,clicks,followers_gained,platform_metrics,entered_by,note)
  values(p.workspace_id,p.client_id,p.id,target_captured_at,target_snapshot_type,'manual',target_views_or_plays,target_reach,target_impressions,target_likes,target_comments,target_shares,target_saves_or_collects,target_clicks,target_followers_gained,coalesce(target_platform_metrics,'{}'::jsonb),auth.uid(),nullif(btrim(target_note),'')) returning id into saved;
  select current_status into cstate from public.contents where id=p.content_id;
  insert into public.workflow_events(workspace_id,client_id,content_id,actor_user_id,event_type,from_state,to_state,notes,publication_id,metadata)
  values(p.workspace_id,p.client_id,p.content_id,auth.uid(),'analytics_snapshot_added',cstate,cstate,nullif(btrim(target_note),''),p.id,jsonb_build_object('snapshot_id',saved,'snapshot_type',target_snapshot_type,'data_source','manual'));
  return saved;
end; $$;

create or replace function public.complete_content_analytics(target_content_id uuid,expected_from_state text,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; event_id uuid;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  if expected_from_state<>'analytics_tracking' or not public.can_manage_content_assignments(c.id) then raise exception 'Analytics completion access denied'; end if;
  if public.content_publication_state(c.id)<>'fully_published' then raise exception 'All required Publications must be Published'; end if;
  if exists(select 1 from public.publications p where p.content_id=c.id and p.is_required and p.status='published' and exists(select 1 from unnest(array['24h','7d','30d']) as needed(snapshot_type) where not exists(select 1 from public.analytics_snapshots a where a.publication_id=p.id and a.snapshot_type=needed.snapshot_type))) then raise exception 'Required 24h, 7d, and 30d Snapshots are incomplete'; end if;
  perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='completed' where id=c.id; perform set_config('contentos.workflow_action','',true);
  insert into public.workflow_events(workspace_id,client_id,content_id,actor_user_id,event_type,from_state,to_state,notes)
  values(c.workspace_id,c.client_id,c.id,auth.uid(),'content_completed',c.current_status,'completed',nullif(btrim(target_note),'')) returning id into event_id; return event_id;
end; $$;

revoke all on function public.save_social_account(uuid,uuid,uuid,text,text,text,boolean),public.create_publication(uuid,uuid,uuid,uuid,boolean,text),public.schedule_publication(uuid,text,timestamptz,text),public.mark_publication_published(uuid,text,timestamptz,text,text),public.mark_publication_failed(uuid,text,text,text),public.cancel_publication(uuid,text,text),public.add_manual_analytics_snapshot(uuid,timestamptz,text,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,jsonb,text),public.complete_content_analytics(uuid,text,text) from public,anon;
grant execute on function public.save_social_account(uuid,uuid,uuid,text,text,text,boolean),public.create_publication(uuid,uuid,uuid,uuid,boolean,text),public.schedule_publication(uuid,text,timestamptz,text),public.mark_publication_published(uuid,text,timestamptz,text,text),public.mark_publication_failed(uuid,text,text,text),public.cancel_publication(uuid,text,text),public.add_manual_analytics_snapshot(uuid,timestamptz,text,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,jsonb,text),public.complete_content_analytics(uuid,text,text) to authenticated;
