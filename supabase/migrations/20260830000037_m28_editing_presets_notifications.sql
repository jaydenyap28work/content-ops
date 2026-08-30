-- ContentOS M28: maintainable editing presets, immutable Content snapshots,
-- explicit submission compatibility, and targeted in-app notifications.
-- Existing final_media_submitted events remain unchanged for Team Reports.

alter table public.media_versions drop constraint if exists media_version_location_check;
comment on table public.media_versions is
  'Immutable First Cut, Revision, and Final metadata. A link is optional for verbal/local handoff.';

create table public.editing_presets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null check (nullif(btrim(name),'') is not null),
  category text not null check (category in ('subtitle','brand_logo','pacing','transition','bgm_sfx','cover','export','gold_standard','custom')),
  preset_type text not null default 'style' check (preset_type in ('style','sop')),
  purpose text,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps)='array'),
  example_links text[] not null default '{}',
  notes text,
  version_number integer not null default 1 check (version_number>0),
  sort_order integer not null default 0,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  updated_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id,name)
);
create unique index editing_presets_default_category_key on public.editing_presets(client_id,category)
  where is_default and status='active';
create index editing_presets_client_sort_idx on public.editing_presets(client_id,status,category,sort_order,name);
create trigger editing_presets_set_updated_at before update on public.editing_presets
  for each row execute function public.set_updated_at();

create table public.content_editing_presets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete restrict,
  preset_id uuid not null references public.editing_presets(id) on delete restrict,
  usage_slot text not null check (usage_slot in ('subtitle','opening','info_insert','other')),
  preset_version integer not null check (preset_version>0),
  preset_snapshot jsonb not null check (jsonb_typeof(preset_snapshot)='object'),
  assigned_by uuid not null references public.user_profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique(content_id,usage_slot,preset_id)
);
create index content_editing_presets_content_slot_idx on public.content_editing_presets(content_id,usage_slot,assigned_at);
create trigger content_editing_presets_immutable before update or delete on public.content_editing_presets
  for each row execute function public.prevent_immutable_history_mutation();

alter table public.editing_presets enable row level security;
alter table public.content_editing_presets enable row level security;
create policy "Internal members can view Editing Presets" on public.editing_presets for select to authenticated
  using(public.is_internal_workspace_member(workspace_id) and (public.has_active_client_access(client_id) or exists(select 1 from public.clients c where c.id=client_id and c.ownership_type='internal_brand' and c.is_default_brand))); 
create policy "Authorized internal users can view Content Preset snapshots" on public.content_editing_presets for select to authenticated
  using(public.can_view_content(content_id));
revoke all on public.editing_presets,public.content_editing_presets from anon;
revoke insert,update,delete,truncate,references,trigger on public.editing_presets,public.content_editing_presets from authenticated;
grant select on public.editing_presets,public.content_editing_presets to authenticated;

create or replace function public.can_manage_editing_presets(target_client_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.clients c where c.id=target_client_id and c.status='active'
    and (public.has_active_client_access(c.id) or (c.ownership_type='internal_brand' and c.is_default_brand and public.is_internal_workspace_member(c.workspace_id)))
    and (public.is_workspace_super_admin(c.workspace_id) or public.has_workspace_role(c.workspace_id,'internal_manager')
      or public.has_workspace_role(c.workspace_id,'strategist_content_planner')));
$$;

create or replace function public.save_editing_preset(
 target_preset_id uuid,target_client_id uuid,target_name text,target_category text,target_preset_type text,
 target_purpose text,target_settings jsonb,target_steps jsonb,target_example_links text[],target_notes text,
 target_sort_order integer,target_is_default boolean,target_status text
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; row_scope public.editing_presets%rowtype; workspace_scope uuid; next_version integer;
begin
  if not public.can_manage_editing_presets(target_client_id) then raise exception 'Editing Preset access denied'; end if;
  if nullif(btrim(target_name),'') is null then raise exception 'Preset name is required'; end if;
  if target_category not in ('subtitle','brand_logo','pacing','transition','bgm_sfx','cover','export','gold_standard','custom')
    or target_preset_type not in ('style','sop') or target_status not in ('active','inactive') then raise exception 'Unsupported Preset value'; end if;
  if jsonb_typeof(coalesce(target_settings,'{}'))<>'object' or jsonb_typeof(coalesce(target_steps,'[]'))<>'array' then raise exception 'Invalid Preset structure'; end if;
  select workspace_id into workspace_scope from public.clients where id=target_client_id;
  if target_is_default and target_status='active' then update public.editing_presets set is_default=false,updated_by=auth.uid()
    where client_id=target_client_id and category=target_category and is_default and id is distinct from target_preset_id; end if;
  if target_preset_id is null then
    insert into public.editing_presets(workspace_id,client_id,name,category,preset_type,purpose,settings,steps,example_links,notes,
      sort_order,is_default,status,created_by,updated_by)
    values(workspace_scope,target_client_id,btrim(target_name),target_category,target_preset_type,nullif(btrim(target_purpose),''),
      coalesce(target_settings,'{}'),coalesce(target_steps,'[]'),coalesce(target_example_links,'{}'),nullif(btrim(target_notes),''),
      coalesce(target_sort_order,0),target_is_default,target_status,auth.uid(),auth.uid()) returning id into saved;
  else
    select * into row_scope from public.editing_presets where id=target_preset_id for update;
    if row_scope.id is null or row_scope.client_id<>target_client_id then raise exception 'Preset scope cannot be changed'; end if;
    next_version:=row_scope.version_number+1;
    update public.editing_presets set name=btrim(target_name),category=target_category,preset_type=target_preset_type,
      purpose=nullif(btrim(target_purpose),''),settings=coalesce(target_settings,'{}'),steps=coalesce(target_steps,'[]'),
      example_links=coalesce(target_example_links,'{}'),notes=nullif(btrim(target_notes),''),version_number=next_version,
      sort_order=coalesce(target_sort_order,0),is_default=target_is_default,status=target_status,updated_by=auth.uid()
    where id=target_preset_id returning id into saved;
  end if;
  return saved;
end; $$;

create or replace function public.copy_editing_preset(target_preset_id uuid,target_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare source public.editing_presets%rowtype; saved uuid;
begin
  select * into source from public.editing_presets where id=target_preset_id;
  if source.id is null or not public.can_manage_editing_presets(source.client_id) then raise exception 'Editing Preset access denied'; end if;
  insert into public.editing_presets(workspace_id,client_id,name,category,preset_type,purpose,settings,steps,example_links,notes,
    sort_order,is_default,status,created_by,updated_by)
  values(source.workspace_id,source.client_id,coalesce(nullif(btrim(target_name),''),source.name||' Copy'),source.category,source.preset_type,
    source.purpose,source.settings,source.steps,source.example_links,source.notes,source.sort_order+1,false,'active',auth.uid(),auth.uid()) returning id into saved;
  return saved;
end; $$;

create or replace function public.delete_unused_editing_preset(target_preset_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare source public.editing_presets%rowtype;
begin
  select * into source from public.editing_presets where id=target_preset_id for update;
  if source.id is null or not public.can_manage_editing_presets(source.client_id) then raise exception 'Editing Preset access denied'; end if;
  if exists(select 1 from public.content_editing_presets where preset_id=source.id) then raise exception 'Used Presets cannot be deleted; deactivate instead'; end if;
  delete from public.editing_presets where id=source.id;
end; $$;

create or replace function public.assign_content_editing_preset(target_content_id uuid,target_preset_id uuid,target_usage_slot text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; p public.editing_presets%rowtype; saved uuid;
begin
  select * into c from public.contents where id=target_content_id for update;
  select * into p from public.editing_presets where id=target_preset_id and status='active';
  if c.id is null or p.id is null or c.client_id<>p.client_id or not public.can_manage_content_assignments(c.id) then raise exception 'Content Preset assignment denied'; end if;
  if target_usage_slot not in ('subtitle','opening','info_insert','other') then raise exception 'Unsupported Preset slot'; end if;
  insert into public.content_editing_presets(content_id,preset_id,usage_slot,preset_version,preset_snapshot,assigned_by)
  values(c.id,p.id,target_usage_slot,p.version_number,jsonb_build_object('name',p.name,'category',p.category,'preset_type',p.preset_type,
    'purpose',p.purpose,'settings',p.settings,'steps',p.steps,'example_links',p.example_links,'notes',p.notes),auth.uid()) returning id into saved;
  return saved;
end; $$;

create table public.notification_preferences (
  user_profile_id uuid primary key references public.user_profiles(id) on delete restrict,
  first_cut_review boolean not null default true,
  revision_requested boolean not null default true,
  task_due boolean not null default true,
  access_requests boolean not null default true,
  equipment_proposals boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  recipient_user_id uuid not null references public.user_profiles(id) on delete restrict,
  type text not null,
  title text not null check(nullif(btrim(title),'') is not null),
  body text,
  entity_type text not null check(entity_type in ('content','idea','team','equipment_proposal','task','access_request')),
  entity_id uuid,
  route text not null check(route like '/%'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient_unread_idx on public.notifications(recipient_user_id,read_at,created_at desc);
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
create policy "Users can view own Notification Preferences" on public.notification_preferences for select to authenticated using(user_profile_id=auth.uid());
create policy "Users can view own Notifications" on public.notifications for select to authenticated using(recipient_user_id=auth.uid());
revoke all on public.notification_preferences,public.notifications from anon;
revoke insert,update,delete,truncate,references,trigger on public.notification_preferences,public.notifications from authenticated;
grant select on public.notification_preferences,public.notifications to authenticated;

create or replace function public.notification_enabled(target_user uuid,target_preference text)
returns boolean language sql stable security definer set search_path='' as $$
  select case target_preference
    when 'first_cut_review' then coalesce((select first_cut_review from public.notification_preferences where user_profile_id=target_user),true)
    when 'revision_requested' then coalesce((select revision_requested from public.notification_preferences where user_profile_id=target_user),true)
    when 'task_due' then coalesce((select task_due from public.notification_preferences where user_profile_id=target_user),true)
    when 'access_requests' then coalesce((select access_requests from public.notification_preferences where user_profile_id=target_user),true)
    when 'equipment_proposals' then coalesce((select equipment_proposals from public.notification_preferences where user_profile_id=target_user),true)
    else true end;
$$;

create or replace function public.insert_notification(target_workspace uuid,target_recipient uuid,target_type text,target_title text,
 target_body text,target_entity_type text,target_entity_id uuid,target_route text,target_preference text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
  if target_recipient is null or target_recipient=auth.uid() or not exists(select 1 from public.workspace_members wm
    join public.user_profiles up on up.id=wm.user_profile_id where wm.workspace_id=target_workspace and wm.user_profile_id=target_recipient and wm.status='active' and up.status='active') then return null; end if;
  if target_preference is not null and not public.notification_enabled(target_recipient,target_preference) then return null; end if;
  insert into public.notifications(workspace_id,recipient_user_id,type,title,body,entity_type,entity_id,route)
  values(target_workspace,target_recipient,target_type,target_title,nullif(btrim(target_body),''),target_entity_type,target_entity_id,target_route) returning id into saved;
  return saved;
end; $$;

create or replace function public.dispatch_workflow_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; owner_id uuid; title_text text; pref text:='first_cut_review'; role_code text; route_text text;
begin
  select current_owner_user_id,title into owner_id,title_text from public.contents where id=new.content_id;
  route_text:='/content/'||new.content_id;
  if new.event_type in ('first_cut_submitted','revision_submitted') then
    for recipient in select distinct cc.user_profile_id from public.content_contributors cc join public.contribution_roles cr on cr.id=cc.contribution_role_id
      where cc.content_id=new.content_id and cc.status='active' and cr.code in ('reviewer','owner') and cc.user_profile_id is not null loop
      perform public.insert_notification(new.workspace_id,recipient,new.event_type,
        case when new.event_type='first_cut_submitted' then '初剪已提交' else '修改版已提交' end,title_text,'content',new.content_id,route_text,'first_cut_review'); end loop;
  elsif new.event_type='revision_requested' then pref:='revision_requested';
    for recipient in select distinct cc.user_profile_id from public.content_contributors cc join public.contribution_roles cr on cr.id=cc.contribution_role_id
      where cc.content_id=new.content_id and cc.status='active' and cr.code in ('editor','owner') and cc.user_profile_id is not null loop
      perform public.insert_notification(new.workspace_id,recipient,new.event_type,'需要修改',title_text,'content',new.content_id,route_text,pref); end loop;
  elsif new.event_type in ('approval_recorded','final_approved') then
    for recipient in select distinct cc.user_profile_id from public.content_contributors cc join public.contribution_roles cr on cr.id=cc.contribution_role_id
      where cc.content_id=new.content_id and cc.status='active' and cr.code in ('owner','publisher') and cc.user_profile_id is not null loop
      perform public.insert_notification(new.workspace_id,recipient,'approved','内容已通过审核',title_text,'content',new.content_id,route_text,null); end loop;
  elsif new.event_type='shoot_completed' then
    for recipient in select distinct cc.user_profile_id from public.content_contributors cc join public.contribution_roles cr on cr.id=cc.contribution_role_id
      where cc.content_id=new.content_id and cc.status='active' and cr.code in ('owner','editor') and cc.user_profile_id is not null loop
      perform public.insert_notification(new.workspace_id,recipient,'shoot_completed','拍摄已完成',title_text,'content',new.content_id,route_text,null); end loop;
  elsif new.event_type in ('publication_prepared','publication_scheduled') then
    for recipient in select distinct cc.user_profile_id from public.content_contributors cc join public.contribution_roles cr on cr.id=cc.contribution_role_id
      where cc.content_id=new.content_id and cc.status='active' and cr.code in ('publisher','owner') and cc.user_profile_id is not null loop
      perform public.insert_notification(new.workspace_id,recipient,'ready_to_publish','内容待发布',title_text,'content',new.content_id,route_text,null); end loop;
  elsif new.event_type in ('publication_published','graphic_published') then
    perform public.insert_notification(new.workspace_id,owner_id,'published','内容已发布',title_text,'content',new.content_id,route_text,null);
  end if;
  return new;
end; $$;
create trigger workflow_events_notify after insert on public.workflow_events for each row execute function public.dispatch_workflow_notification();

create or replace function public.dispatch_access_request_notification()
returns trigger language plpgsql security definer set search_path='' as $$ declare recipient uuid; begin
  if new.status='pending' then for recipient in select distinct wm.user_profile_id from public.workspace_members wm
    join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id join public.roles r on r.id=wmr.role_id
    where wm.workspace_id=new.workspace_id and wm.status='active' and r.code='super_admin' loop
    perform public.insert_notification(new.workspace_id,recipient,'access_request','新的访问申请',new.email,'access_request',new.id,'/team','access_requests'); end loop; end if; return new; end $$;
create trigger access_requests_notify after insert on public.access_requests for each row execute function public.dispatch_access_request_notification();

create or replace function public.dispatch_equipment_notification()
returns trigger language plpgsql security definer set search_path='' as $$ declare recipient uuid; begin
  if new.status='pending_review' and (tg_op='INSERT' or old.status is distinct from new.status) then for recipient in select distinct wm.user_profile_id from public.workspace_members wm
    join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id join public.roles r on r.id=wmr.role_id
    where wm.workspace_id=new.workspace_id and wm.status='active' and r.code='super_admin' loop
    perform public.insert_notification(new.workspace_id,recipient,'equipment_proposal','装备提案待审核',new.title,'equipment_proposal',new.id,'/equipment-proposals','equipment_proposals'); end loop; end if; return new; end $$;
create trigger equipment_proposals_notify after insert or update of status on public.equipment_proposals for each row execute function public.dispatch_equipment_notification();

create or replace function public.list_my_notifications(target_limit integer default 40)
returns table(id uuid,type text,title text,body text,entity_type text,entity_id uuid,route text,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path='' as $$
 select n.id,n.type,n.title,n.body,n.entity_type,n.entity_id,n.route,n.created_at,n.read_at from public.notifications n
 where n.recipient_user_id=auth.uid() order by n.created_at desc limit least(greatest(coalesce(target_limit,40),1),100); $$;
create or replace function public.mark_notification_read(target_notification_id uuid)
returns void language plpgsql security definer set search_path='' as $$ begin
 update public.notifications set read_at=coalesce(read_at,now()) where id=target_notification_id and recipient_user_id=auth.uid();
 if not found then raise exception 'Notification not found'; end if; end $$;
create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path='' as $$ declare affected integer; begin
 update public.notifications set read_at=now() where recipient_user_id=auth.uid() and read_at is null; get diagnostics affected=row_count; return affected; end $$;
create or replace function public.save_notification_preferences(target_first_cut_review boolean,target_revision_requested boolean,
 target_task_due boolean,target_access_requests boolean,target_equipment_proposals boolean)
returns void language plpgsql security definer set search_path='' as $$ begin
 insert into public.notification_preferences(user_profile_id,first_cut_review,revision_requested,task_due,access_requests,equipment_proposals)
 values(auth.uid(),target_first_cut_review,target_revision_requested,target_task_due,target_access_requests,target_equipment_proposals)
 on conflict(user_profile_id) do update set first_cut_review=excluded.first_cut_review,revision_requested=excluded.revision_requested,
 task_due=excluded.task_due,access_requests=excluded.access_requests,equipment_proposals=excluded.equipment_proposals; end $$;

-- Verified LKSoft standards. They remain editable records, not UI constants.
with brand as (select c.id,c.workspace_id from public.clients c where c.ownership_type='internal_brand' and c.is_default_brand limit 1),
actor as (select wm.user_profile_id from public.workspace_members wm join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
 join public.roles r on r.id=wmr.role_id,brand where wm.workspace_id=brand.workspace_id and wm.status='active' and r.code='super_admin' limit 1)
insert into public.editing_presets(workspace_id,client_id,name,category,preset_type,purpose,settings,steps,sort_order,is_default,created_by,updated_by)
select brand.workspace_id,brand.id,seed.name,seed.category,seed.preset_type,seed.purpose,seed.settings,seed.steps,seed.sort_order,seed.is_default,actor.user_profile_id,actor.user_profile_id
from brand cross join actor cross join (values
 ('基本字幕','subtitle','style','普通对话、解释字幕、访问字幕',jsonb_build_object('font','研宋体','font_size',null,'weight',null,'color','#FFFFFF','stroke',null,'shadow','60%','background',null,'keyword_highlight',null,'position','bottom','safe_area',null,'max_chars_per_line',null,'max_lines',2,'animation',null),'[]'::jsonb,10,true),
 ('效果字幕','subtitle','style','Hook、关键词、强调字幕、趣味效果字幕',jsonb_build_object('font','思源粗宋','special_fonts',jsonb_build_array('挥墨体','金陵体'),'font_size',null,'weight','bold','color','#FFFFFF','stroke',null,'shadow','60%','background',null,'keyword_highlight',true,'position',null,'safe_area',null,'max_chars_per_line',null,'max_lines',2,'animation',null),'[]'::jsonb,20,false),
 ('口播开场','custom','sop','口播内容开场处理','{}'::jsonb,jsonb_build_array(
   jsonb_build_object('order',1,'title','关键帧放大','detail','使用关键帧完成开场放大'),jsonb_build_object('order',2,'title','可选暗礁效果','detail','按内容需要加入暗礁效果'),
   jsonb_build_object('order',3,'title','强调字体','detail','挥墨体或金陵体'),jsonb_build_object('order',4,'title','入场动画','detail','故障')),30,false),
 ('资讯插入 / 人物缩小展示资讯','custom','sop','人物缩小同时展示资讯画面','{}'::jsonb,jsonb_build_array(
   jsonb_build_object('order',1,'title','人物缩小'),jsonb_build_object('order',2,'title','主轨道人物抠像'),jsonb_build_object('order',3,'title','设置开始关键帧'),
   jsonb_build_object('order',4,'title','时间线稍微往后移动'),jsonb_build_object('order',5,'title','缩小并移到右下角'),jsonb_build_object('order',6,'title','关键帧设为放缓'),
   jsonb_build_object('order',7,'title','加入资讯背景'),jsonb_build_object('order',8,'title','人物放在副轨道')),40,false)
) as seed(name,category,preset_type,purpose,settings,steps,sort_order,is_default)
on conflict(client_id,name) do nothing;

revoke all on function public.can_manage_editing_presets(uuid),public.notification_enabled(uuid,text),
 public.insert_notification(uuid,uuid,text,text,text,text,uuid,text,text),public.dispatch_workflow_notification(),
 public.dispatch_access_request_notification(),public.dispatch_equipment_notification() from public,anon,authenticated;
revoke all on function public.save_editing_preset(uuid,uuid,text,text,text,text,jsonb,jsonb,text[],text,integer,boolean,text),
 public.copy_editing_preset(uuid,text),public.delete_unused_editing_preset(uuid),public.assign_content_editing_preset(uuid,uuid,text),
 public.list_my_notifications(integer),public.mark_notification_read(uuid),public.mark_all_notifications_read(),
 public.save_notification_preferences(boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.save_editing_preset(uuid,uuid,text,text,text,text,jsonb,jsonb,text[],text,integer,boolean,text),
 public.copy_editing_preset(uuid,text),public.delete_unused_editing_preset(uuid),public.assign_content_editing_preset(uuid,uuid,text),
 public.list_my_notifications(integer),public.mark_notification_read(uuid),public.mark_all_notifications_read(),
 public.save_notification_preferences(boolean,boolean,boolean,boolean,boolean) to authenticated;

notify pgrst,'reload schema';
