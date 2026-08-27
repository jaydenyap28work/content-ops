-- M18: Structured Shooting Packs, reusable shoot scenes, and Calendar V2 manual marketing events.
-- Existing briefs, scripts, workflow events, approvals, publications, assets, and account data are preserved.

create table public.shoot_scenes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null check (btrim(name)<>''),
  photo_urls text[] not null default '{}',
  location text,
  suitable_for text[] not null default '{}',
  recommended_camera_positions text[] not null default '{}',
  composition_notes text,
  lighting_notes text,
  audio_notes text,
  background_notes text,
  shooting_sop text,
  is_recommended boolean not null default false,
  status text not null default 'active' check(status in ('active','archived')),
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id,name)
);

create index shoot_scenes_client_status_recommended_idx on public.shoot_scenes(client_id,status,is_recommended desc,updated_at desc);
create trigger shoot_scenes_set_updated_at before update on public.shoot_scenes for each row execute function public.set_updated_at();
alter table public.shoot_scenes enable row level security;
create policy "Authorized internal users can view Shoot Scenes" on public.shoot_scenes for select to authenticated using(
  public.is_internal_workspace_member(workspace_id) and (public.is_workspace_super_admin(workspace_id) or public.has_active_client_access(client_id))
);
revoke insert,update,delete on public.shoot_scenes from anon,authenticated;

alter table public.idea_shooting_briefs
  add column if not exists shooting_format text not null default 'q_and_a'
    check(shooting_format in ('q_and_a','talking_head','product_demo','podcast','voice_over','event')),
  add column if not exists pack_segments jsonb not null default '[]'::jsonb check(jsonb_typeof(pack_segments)='array'),
  add column if not exists recommended_scene_id uuid references public.shoot_scenes(id) on delete set null,
  add column if not exists confirmed_scene_id uuid references public.shoot_scenes(id) on delete set null,
  add column if not exists backup_scene_id uuid references public.shoot_scenes(id) on delete set null;

comment on column public.idea_shooting_briefs.pack_segments is
  'Ordered Shooting Pack cues. Each segment may contain id, kind, prompt, referenceScript, keywords, visualCue, onScreenText, and isShot.';

-- Preserve current brief content by projecting it into structured Q&A cues only when no pack exists.
update public.idea_shooting_briefs b set pack_segments=(
  select coalesce(jsonb_agg(jsonb_build_object(
    'id','q-'||ordinality,'kind','question','prompt',question,
    'referenceScript',case when cardinality(b.key_talking_points)>0 then '可参考以下表达重点展开：'||b.key_talking_points[least(ordinality::integer,cardinality(b.key_talking_points))] else '' end,
    'keywords',case when cardinality(b.key_talking_points)>0 then jsonb_build_array(b.key_talking_points[least(ordinality::integer,cardinality(b.key_talking_points))]) else '[]'::jsonb end,
    'visualCue',case when cardinality(b.b_roll_visual_suggestions)>0 then b.b_roll_visual_suggestions[least(ordinality::integer,cardinality(b.b_roll_visual_suggestions))] else '' end,
    'onScreenText','', 'isShot',false
  ) order by ordinality),'[]'::jsonb)
  from unnest(b.interview_questions) with ordinality as questions(question,ordinality)
) where b.pack_segments='[]'::jsonb and cardinality(b.interview_questions)>0;

create or replace function public.save_shoot_scene(
  target_scene_id uuid,target_client_id uuid,target_name text,target_photo_urls text[],target_location text,
  target_suitable_for text[],target_camera_positions text[],target_composition text,target_lighting text,
  target_audio text,target_background text,target_sop text,target_recommended boolean,target_status text default 'active'
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; workspace_scope uuid;
begin
  select workspace_id into workspace_scope from public.clients where id=target_client_id and status='active';
  if workspace_scope is null or not public.can_manage_content_client(target_client_id) then raise exception 'Shoot Scene access denied'; end if;
  if nullif(btrim(target_name),'') is null then raise exception 'Scene name is required'; end if;
  if target_status not in ('active','archived') then raise exception 'Invalid Scene status'; end if;
  if target_scene_id is null then
    insert into public.shoot_scenes(workspace_id,client_id,name,photo_urls,location,suitable_for,recommended_camera_positions,composition_notes,lighting_notes,audio_notes,background_notes,shooting_sop,is_recommended,status,created_by)
    values(workspace_scope,target_client_id,btrim(target_name),coalesce(target_photo_urls,'{}'),nullif(btrim(target_location),''),coalesce(target_suitable_for,'{}'),coalesce(target_camera_positions,'{}'),nullif(btrim(target_composition),''),nullif(btrim(target_lighting),''),nullif(btrim(target_audio),''),nullif(btrim(target_background),''),nullif(btrim(target_sop),''),target_recommended,target_status,auth.uid()) returning id into saved;
  else
    update public.shoot_scenes set name=btrim(target_name),photo_urls=coalesce(target_photo_urls,'{}'),location=nullif(btrim(target_location),''),suitable_for=coalesce(target_suitable_for,'{}'),recommended_camera_positions=coalesce(target_camera_positions,'{}'),composition_notes=nullif(btrim(target_composition),''),lighting_notes=nullif(btrim(target_lighting),''),audio_notes=nullif(btrim(target_audio),''),background_notes=nullif(btrim(target_background),''),shooting_sop=nullif(btrim(target_sop),''),is_recommended=target_recommended,status=target_status where id=target_scene_id and client_id=target_client_id returning id into saved;
    if saved is null then raise exception 'Shoot Scene not found'; end if;
  end if;
  insert into public.activity_logs(workspace_id,client_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(workspace_scope,target_client_id,auth.uid(),'shoot_scene',saved,'shoot_scene_saved',jsonb_build_object('status',target_status,'recommended',target_recommended));
  return saved;
end; $$;

create or replace function public.save_shooting_pack(
  target_idea_id uuid,target_format text,target_segments jsonb,target_recommended_scene_id uuid,
  target_confirmed_scene_id uuid,target_backup_scene_id uuid
) returns void language plpgsql security definer set search_path='' as $$
declare source public.ideas%rowtype; scene_id uuid;
begin
  select * into source from public.ideas where id=target_idea_id for update;
  if source.id is null or not public.can_manage_research_client(source.client_id) then raise exception 'Shooting Pack access denied'; end if;
  if target_format not in ('q_and_a','talking_head','product_demo','podcast','voice_over','event') then raise exception 'Unsupported Shooting format'; end if;
  if jsonb_typeof(target_segments)<>'array' or jsonb_array_length(target_segments)>30 then raise exception 'Shooting Pack requires an array of no more than 30 segments'; end if;
  foreach scene_id in array array[target_recommended_scene_id,target_confirmed_scene_id,target_backup_scene_id] loop
    if scene_id is not null and not exists(select 1 from public.shoot_scenes s where s.id=scene_id and s.client_id=source.client_id and s.status='active') then raise exception 'Shoot Scene is outside this Client or archived'; end if;
  end loop;
  update public.idea_shooting_briefs set shooting_format=target_format,pack_segments=target_segments,
    recommended_scene_id=target_recommended_scene_id,confirmed_scene_id=target_confirmed_scene_id,backup_scene_id=target_backup_scene_id,
    generation_source='manual' where idea_id=source.id;
  if not found then raise exception 'Create the Shooting Brief before saving a Shooting Pack'; end if;
  insert into public.activity_logs(workspace_id,client_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(source.workspace_id,source.client_id,auth.uid(),'idea',source.id,'shooting_pack_saved',jsonb_build_object('format',target_format,'segment_count',jsonb_array_length(target_segments)));
end; $$;

create or replace function public.mark_shooting_pack_segment(target_idea_id uuid,target_segment_id text,target_is_shot boolean)
returns void language plpgsql security definer set search_path='' as $$
declare source public.ideas%rowtype; updated_segments jsonb; content_scope uuid;
begin
  select * into source from public.ideas where id=target_idea_id for update;
  select id into content_scope from public.contents where source_idea_id=target_idea_id;
  if source.id is null or content_scope is null or not public.can_view_content(content_scope) then raise exception 'Shooting segment access denied'; end if;
  if not (public.can_manage_content_assignments(content_scope) or (public.has_workspace_role(source.workspace_id,'shooter') and public.has_active_content_assignment(content_scope,'shooter'))) then raise exception 'Shooting segment permission denied'; end if;
  select jsonb_agg(case when item->>'id'=target_segment_id then jsonb_set(item,'{isShot}',to_jsonb(target_is_shot),true) else item end order by ordinality)
    into updated_segments from jsonb_array_elements((select pack_segments from public.idea_shooting_briefs where idea_id=target_idea_id)) with ordinality as segments(item,ordinality);
  if not exists(select 1 from jsonb_array_elements(coalesce(updated_segments,'[]'::jsonb)) item where item->>'id'=target_segment_id) then raise exception 'Shooting segment not found'; end if;
  update public.idea_shooting_briefs set pack_segments=updated_segments where idea_id=target_idea_id;
  insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(source.workspace_id,source.client_id,content_scope,auth.uid(),'content',content_scope,'shooting_segment_updated',jsonb_build_object('segment_id',target_segment_id,'is_shot',target_is_shot));
end; $$;

create table public.marketing_calendar_events (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,event_type text not null check(event_type in ('meeting','workshop_event','offsite','custom')),
  title text not null check(btrim(title)<>''),starts_at timestamptz not null,ends_at timestamptz,all_day boolean not null default false,
  location text,notes text,status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')),
  created_by uuid not null references public.user_profiles(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check(ends_at is null or ends_at>=starts_at)
);
create index marketing_calendar_events_workspace_start_idx on public.marketing_calendar_events(workspace_id,starts_at,event_type,status);

-- Extend the existing immutable audit log without weakening entity scope checks.
alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check check(entity_type in(
  'idea','content','content_contributor','script_version','media_version','revision_request','approval_requirement','approval',
  'social_account','publication','analytics_snapshot','shoot_scene','calendar_event'
));

create or replace function public.enforce_activity_log_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare entity_workspace uuid; entity_client uuid;
begin
  if new.entity_type='idea' then
    select i.workspace_id,i.client_id into entity_workspace,entity_client from public.ideas i where i.id=new.entity_id;
    if new.content_id is not null then raise exception 'Idea Activity must not claim a Content'; end if;
  elsif new.entity_type='shoot_scene' then
    select s.workspace_id,s.client_id into entity_workspace,entity_client from public.shoot_scenes s where s.id=new.entity_id;
    if new.content_id is not null then raise exception 'Shoot Scene Activity must not claim a Content'; end if;
  elsif new.entity_type='calendar_event' then
    select e.workspace_id,e.client_id into entity_workspace,entity_client from public.marketing_calendar_events e where e.id=new.entity_id;
    if new.content_id is not null then raise exception 'Calendar Activity must not claim a Content'; end if;
  else
    select c.workspace_id,c.client_id into entity_workspace,entity_client from public.contents c where c.id=new.content_id;
  end if;
  if entity_workspace is null or entity_workspace is distinct from new.workspace_id or entity_client is distinct from new.client_id then raise exception 'Activity Log scope mismatch'; end if;
  return new;
end; $$;
create trigger marketing_calendar_events_set_updated_at before update on public.marketing_calendar_events for each row execute function public.set_updated_at();
alter table public.marketing_calendar_events enable row level security;
create policy "Authorized internal users can view Marketing Calendar" on public.marketing_calendar_events for select to authenticated using(
  public.is_internal_workspace_member(workspace_id) and (client_id is null or public.is_workspace_super_admin(workspace_id) or public.has_active_client_access(client_id))
);
revoke insert,update,delete on public.marketing_calendar_events from anon,authenticated;

create or replace function public.save_marketing_calendar_event(target_event_id uuid,target_workspace_id uuid,target_client_id uuid,target_type text,target_title text,target_starts_at timestamptz,target_ends_at timestamptz,target_all_day boolean,target_location text,target_notes text,target_status text default 'scheduled')
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
  if not public.is_internal_workspace_member(target_workspace_id) then raise exception 'Marketing Calendar access denied'; end if;
  if target_client_id is not null and (not public.can_manage_content_client(target_client_id) or not exists(select 1 from public.clients where id=target_client_id and workspace_id=target_workspace_id)) then raise exception 'Calendar Client access denied'; end if;
  if target_client_id is null and not (public.is_workspace_super_admin(target_workspace_id) or public.has_workspace_role(target_workspace_id,'internal_manager') or public.has_workspace_role(target_workspace_id,'strategist')) then raise exception 'Workspace Calendar management denied'; end if;
  if target_type not in ('meeting','workshop_event','offsite','custom') or target_status not in ('scheduled','cancelled','completed') then raise exception 'Invalid Calendar value'; end if;
  if nullif(btrim(target_title),'') is null or target_starts_at is null or (target_ends_at is not null and target_ends_at<target_starts_at) then raise exception 'Valid title and time are required'; end if;
  if target_event_id is null then
    insert into public.marketing_calendar_events(workspace_id,client_id,event_type,title,starts_at,ends_at,all_day,location,notes,status,created_by)
    values(target_workspace_id,target_client_id,target_type,btrim(target_title),target_starts_at,target_ends_at,target_all_day,nullif(btrim(target_location),''),nullif(btrim(target_notes),''),target_status,auth.uid()) returning id into saved;
  else
    update public.marketing_calendar_events set client_id=target_client_id,event_type=target_type,title=btrim(target_title),starts_at=target_starts_at,ends_at=target_ends_at,all_day=target_all_day,location=nullif(btrim(target_location),''),notes=nullif(btrim(target_notes),''),status=target_status where id=target_event_id and workspace_id=target_workspace_id returning id into saved;
    if saved is null then raise exception 'Calendar Event not found'; end if;
  end if;
  if target_client_id is not null then
    insert into public.activity_logs(workspace_id,client_id,actor_user_id,entity_type,entity_id,action,metadata)
    values(target_workspace_id,target_client_id,auth.uid(),'calendar_event',saved,'marketing_calendar_event_saved',jsonb_build_object('event_type',target_type,'status',target_status));
  end if;
  return saved;
end; $$;

create or replace function public.list_calendar_events(target_workspace_id uuid,target_from date,target_to date)
returns table(event_key text,event_type text,event_at timestamptz,title text,client_name text,status text,entity_type text,entity_id uuid)
language sql stable security definer set search_path='' as $$
  select 'shoot-'||c.id,'SHOOT',coalesce(c.shoot_scheduled_at,c.planned_shoot_date::timestamptz),c.title,scope.name,c.current_status,'content',c.id
  from public.contents c join public.clients scope on scope.id=c.client_id where c.workspace_id=target_workspace_id and coalesce(c.shoot_scheduled_at::date,c.planned_shoot_date) between target_from and target_to and c.record_status='active' and public.can_view_content(c.id)
  union all
  select 'target-publish-'||c.id,'PUBLISH_TARGET',c.planned_date::timestamptz,c.title,scope.name,c.current_status,'content',c.id
  from public.contents c join public.clients scope on scope.id=c.client_id where c.workspace_id=target_workspace_id and c.planned_date between target_from and target_to and c.record_status='active' and public.can_view_content(c.id)
  union all
  select 'review-'||we.id,'REVIEW',we.occurred_at,c.title,scope.name,we.to_state,'content',c.id from public.workflow_events we join public.contents c on c.id=we.content_id join public.clients scope on scope.id=c.client_id
  where c.workspace_id=target_workspace_id and we.occurred_at::date between target_from and target_to and we.to_state in ('first_cut_submitted','internal_review','revision_required','client_review','approved') and public.can_view_content(c.id)
  union all
  select 'publication-'||p.id,'PUBLISH',coalesce(p.published_at,p.scheduled_at),c.title,scope.name,p.status,'content',c.id from public.publications p join public.contents c on c.id=p.content_id join public.clients scope on scope.id=p.client_id
  where p.workspace_id=target_workspace_id and coalesce(p.published_at,p.scheduled_at)::date between target_from and target_to and public.can_view_content(c.id)
  union all
  select 'marketing-'||e.id,upper(e.event_type),e.starts_at,e.title,coalesce(scope.name,'Marketing'),e.status,'calendar_event',e.id from public.marketing_calendar_events e left join public.clients scope on scope.id=e.client_id
  where e.workspace_id=target_workspace_id and e.starts_at::date between target_from and target_to and e.status<>'cancelled'
    and public.is_internal_workspace_member(e.workspace_id) and (e.client_id is null or public.is_workspace_super_admin(e.workspace_id) or public.has_active_client_access(e.client_id))
  order by 3,2;
$$;

revoke all on function public.save_shoot_scene(uuid,uuid,text,text[],text,text[],text[],text,text,text,text,text,boolean,text),public.save_shooting_pack(uuid,text,jsonb,uuid,uuid,uuid),public.mark_shooting_pack_segment(uuid,text,boolean),public.save_marketing_calendar_event(uuid,uuid,uuid,text,text,timestamptz,timestamptz,boolean,text,text,text),public.list_calendar_events(uuid,date,date) from public,anon;
grant execute on function public.save_shoot_scene(uuid,uuid,text,text[],text,text[],text[],text,text,text,text,text,boolean,text),public.save_shooting_pack(uuid,text,jsonb,uuid,uuid,uuid),public.mark_shooting_pack_segment(uuid,text,boolean),public.save_marketing_calendar_event(uuid,uuid,uuid,text,text,timestamptz,timestamptz,boolean,text,text,text),public.list_calendar_events(uuid,date,date) to authenticated;
notify pgrst,'reload schema';