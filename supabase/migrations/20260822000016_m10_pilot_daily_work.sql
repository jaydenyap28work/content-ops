-- M10: Pilot daily-work UX support. Existing production workflow remains unchanged.

alter table public.workspaces add column if not exists default_timezone text not null default 'Asia/Kuala_Lumpur';
alter table public.user_profiles add column if not exists preferred_language text not null default 'zh-CN'
  check (preferred_language in ('zh-CN','en'));
alter table public.user_profiles add column if not exists timezone text not null default 'Asia/Kuala_Lumpur';

create table public.idea_shooting_briefs (
  idea_id uuid primary key references public.ideas(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  why_now text,
  interview_questions text[] not null default '{}',
  key_talking_points text[] not null default '{}',
  suggested_cta text,
  target_duration text,
  talent text,
  shoot_date date,
  location text,
  shooter_user_id uuid references public.user_profiles(id) on delete restrict,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(interview_questions) <= 5)
);

create index idea_shooting_briefs_client_shoot_date_idx on public.idea_shooting_briefs(client_id, shoot_date);
create trigger idea_shooting_briefs_set_updated_at before update on public.idea_shooting_briefs
for each row execute function public.set_updated_at();
alter table public.idea_shooting_briefs enable row level security;
create policy "Authorized internal users can view Idea Shooting Briefs"
on public.idea_shooting_briefs for select to authenticated using(public.can_view_idea(idea_id));
revoke insert,update,delete on public.idea_shooting_briefs from anon,authenticated;

-- Extend the immutable Activity Log to Idea records without weakening Content scope.
alter table public.activity_logs alter column content_id drop not null;
alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check check(entity_type in(
  'idea','content','content_contributor','script_version','media_version','revision_request','approval_requirement','approval',
  'social_account','publication','analytics_snapshot'
));

create or replace function public.enforce_activity_log_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare entity_workspace uuid; entity_client uuid;
begin
  if new.entity_type='idea' then
    select i.workspace_id,i.client_id into entity_workspace,entity_client from public.ideas i where i.id=new.entity_id;
    if new.content_id is not null then raise exception 'Idea Activity must not claim a Content'; end if;
  else
    select c.workspace_id,c.client_id into entity_workspace,entity_client from public.contents c where c.id=new.content_id;
  end if;
  if entity_workspace is null or entity_workspace is distinct from new.workspace_id or entity_client is distinct from new.client_id then
    raise exception 'Activity Log scope mismatch';
  end if;
  return new;
end; $$;

drop policy if exists "Authorized internal contributors can view Activity Logs" on public.activity_logs;
create policy "Authorized internal contributors can view Activity Logs" on public.activity_logs for select to authenticated
using((entity_type='idea' and public.can_view_idea(entity_id)) or (content_id is not null and public.can_view_content(content_id)));

create or replace function public.change_idea_status(target_idea_id uuid,target_status text,target_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare source public.ideas%rowtype; allowed boolean;
begin
  select * into source from public.ideas where id=target_idea_id for update;
  if source.id is null or not public.can_manage_research_client(source.client_id) then raise exception 'Idea status access denied'; end if;
  if target_status='converted' then raise exception 'Converted is reserved for Content conversion'; end if;
  allowed:=case source.status
    when 'new' then target_status in ('evaluating','rejected','archived')
    when 'evaluating' then target_status in ('new','approved','rejected','archived')
    when 'approved' then target_status in ('evaluating','rejected','archived')
    when 'rejected' then target_status in ('evaluating','archived')
    when 'archived' then target_status in ('new','evaluating')
    when 'converted' then false
    else false end;
  if not allowed then raise exception 'Invalid Idea status transition from % to %',source.status,target_status; end if;
  if target_status in ('rejected','archived') and nullif(btrim(target_reason),'') is null then raise exception 'Reason is required for Reject or Archive'; end if;
  update public.ideas set status=target_status,status_reason=nullif(btrim(target_reason),''),archived_at=case when target_status='archived' then now() else null end where id=source.id;
  insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(source.workspace_id,source.client_id,null,auth.uid(),'idea',source.id,'idea_status_changed',jsonb_build_object('from',source.status,'to',target_status,'reason',nullif(btrim(target_reason),'')));
end; $$;

create or replace function public.bulk_update_ideas(target_idea_ids uuid[],target_field text,target_values text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare source public.ideas%rowtype; changed integer:=0; tag_name text; tag_id uuid;
begin
  if coalesce(cardinality(target_idea_ids),0)=0 then raise exception 'Select at least one Idea'; end if;
  if target_field not in ('owner','planned_date','priority','category','tags') then raise exception 'Unsupported bulk field'; end if;
  for source in select * from public.ideas where id=any(target_idea_ids) order by id for update loop
    if not public.can_manage_research_client(source.client_id) then raise exception 'Idea bulk access denied'; end if;
    if source.status in ('converted','archived') then raise exception 'Converted or archived Ideas cannot be bulk edited'; end if;
    if target_field='owner' then
      if nullif(target_values[1],'') is not null and not exists(
        select 1 from public.workspace_members wm
        where wm.workspace_id=source.workspace_id and wm.user_profile_id=target_values[1]::uuid and wm.status='active'
          and (exists(select 1 from public.workspace_member_roles wmr join public.roles r on r.id=wmr.role_id where wmr.workspace_member_id=wm.id and r.code='super_admin' and r.is_active)
            or exists(select 1 from public.client_members cm where cm.workspace_member_id=wm.id and cm.client_id=source.client_id and cm.status='active'))
      ) then raise exception 'Owner does not have active Client access'; end if;
      update public.ideas set owner_user_id=nullif(target_values[1],'')::uuid where id=source.id;
    elsif target_field='planned_date' then update public.ideas set planned_date=nullif(target_values[1],'')::date where id=source.id;
    elsif target_field='priority' then
      if target_values[1] not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
      update public.ideas set priority=target_values[1] where id=source.id;
    elsif target_field='category' then
      if nullif(target_values[1],'') is not null and not exists(select 1 from public.content_categories cc where cc.id=target_values[1]::uuid and cc.workspace_id=source.workspace_id and cc.is_active) then raise exception 'Category is outside the Idea Workspace or inactive'; end if;
      update public.ideas set category_id=nullif(target_values[1],'')::uuid where id=source.id;
    elsif target_field='tags' then
      delete from public.idea_tags where idea_id=source.id;
      foreach tag_name in array coalesce(target_values,'{}') loop
        if btrim(tag_name)<>'' then
          select id into tag_id from public.tags where workspace_id=source.workspace_id and client_id is not distinct from source.client_id and lower(btrim(name))=lower(btrim(tag_name)) limit 1;
          if tag_id is null then insert into public.tags(workspace_id,client_id,name) values(source.workspace_id,source.client_id,btrim(tag_name)) on conflict do nothing returning id into tag_id; end if;
          if tag_id is null then select id into tag_id from public.tags where workspace_id=source.workspace_id and client_id is not distinct from source.client_id and lower(btrim(name))=lower(btrim(tag_name)) limit 1; end if;
          insert into public.idea_tags(idea_id,tag_id) values(source.id,tag_id) on conflict do nothing;
        end if;
      end loop;
    end if;
    insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
    values(source.workspace_id,source.client_id,null,auth.uid(),'idea',source.id,'idea_bulk_updated',jsonb_build_object('field',target_field,'values',target_values));
    changed:=changed+1;
  end loop;
  if changed<>cardinality(target_idea_ids) then raise exception 'One or more selected Ideas were not found'; end if;
  return changed;
end; $$;

create or replace function public.save_idea_shooting_brief(
  target_idea_id uuid,target_why_now text,target_interview_questions text[],target_key_talking_points text[],
  target_suggested_cta text,target_target_duration text,target_talent text,target_shoot_date date,target_location text,target_shooter_user_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare source public.ideas%rowtype;
begin
  select * into source from public.ideas where id=target_idea_id for update;
  if source.id is null or not public.can_manage_research_client(source.client_id) then raise exception 'Shooting Brief access denied'; end if;
  if source.status not in ('approved','converted') then raise exception 'Shooting Brief requires an Approved Idea'; end if;
  if cardinality(coalesce(target_interview_questions,'{}'))>5 then raise exception 'Use no more than five Interview Questions'; end if;
  if target_shooter_user_id is not null and not exists(
    select 1 from public.workspace_members wm join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id join public.roles r on r.id=wmr.role_id
    where wm.workspace_id=source.workspace_id and wm.user_profile_id=target_shooter_user_id and wm.status='active' and r.code='shooter' and r.is_active
      and (exists(select 1 from public.client_members cm where cm.workspace_member_id=wm.id and cm.client_id=source.client_id and cm.status='active') or public.is_workspace_super_admin(source.workspace_id))
  ) then raise exception 'Shooter does not have an active Shooter role and Client access'; end if;
  insert into public.idea_shooting_briefs(idea_id,workspace_id,client_id,why_now,interview_questions,key_talking_points,suggested_cta,target_duration,talent,shoot_date,location,shooter_user_id,created_by)
  values(source.id,source.workspace_id,source.client_id,nullif(btrim(target_why_now),''),coalesce(target_interview_questions,'{}'),coalesce(target_key_talking_points,'{}'),nullif(btrim(target_suggested_cta),''),nullif(btrim(target_target_duration),''),nullif(btrim(target_talent),''),target_shoot_date,nullif(btrim(target_location),''),target_shooter_user_id,auth.uid())
  on conflict(idea_id) do update set why_now=excluded.why_now,interview_questions=excluded.interview_questions,key_talking_points=excluded.key_talking_points,suggested_cta=excluded.suggested_cta,target_duration=excluded.target_duration,talent=excluded.talent,shoot_date=excluded.shoot_date,location=excluded.location,shooter_user_id=excluded.shooter_user_id;
  insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(source.workspace_id,source.client_id,null,auth.uid(),'idea',source.id,'shooting_brief_saved','{}');
end; $$;

create or replace function public.list_idea_activity(target_idea_id uuid)
returns table(id uuid,actor_name text,action text,occurred_at timestamptz,metadata jsonb)
language sql stable security definer set search_path='' as $$
  select al.id,up.display_name,al.action,al.occurred_at,al.metadata from public.activity_logs al
  join public.user_profiles up on up.id=al.actor_user_id
  where al.entity_type='idea' and al.entity_id=target_idea_id and public.can_view_idea(target_idea_id)
  order by al.occurred_at desc;
$$;

create or replace function public.list_calendar_events(target_workspace_id uuid,target_from date,target_to date)
returns table(event_key text,event_type text,event_at timestamptz,title text,client_name text,status text,entity_type text,entity_id uuid)
language sql stable security definer set search_path='' as $$
  select 'plan-content-'||c.id,'PLAN',c.planned_date::timestamptz,c.title,cl.name,c.current_status,'content',c.id
  from public.contents c join public.clients cl on cl.id=c.client_id
  where c.workspace_id=target_workspace_id and c.planned_date between target_from and target_to and c.record_status='active' and public.can_view_content(c.id)
  union all
  select 'plan-idea-'||i.id,'PLAN',i.planned_date::timestamptz,i.title,cl.name,i.status,'idea',i.id
  from public.ideas i join public.clients cl on cl.id=i.client_id
  where i.workspace_id=target_workspace_id and i.planned_date between target_from and target_to and public.can_view_idea(i.id)
    and not exists(select 1 from public.contents c where c.source_idea_id=i.id)
  union all
  select 'shoot-'||c.id,'SHOOT',c.shoot_scheduled_at,c.title,cl.name,c.current_status,'content',c.id
  from public.contents c join public.clients cl on cl.id=c.client_id
  where c.workspace_id=target_workspace_id and c.shoot_scheduled_at::date between target_from and target_to and c.record_status='active' and public.can_view_content(c.id)
  union all
  select 'publish-'||p.id,'PUBLISH',coalesce(p.published_at,p.scheduled_at),c.title,cl.name,p.status,'content',c.id
  from public.publications p join public.contents c on c.id=p.content_id join public.clients cl on cl.id=p.client_id
  where p.workspace_id=target_workspace_id and coalesce(p.published_at,p.scheduled_at)::date between target_from and target_to and public.can_view_content(c.id)
  order by 3,2;
$$;

create or replace function public.save_user_preferences(target_display_name text,target_language text,target_timezone text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if target_language not in ('zh-CN','en') then raise exception 'Unsupported language'; end if;
  if nullif(btrim(target_display_name),'') is null then raise exception 'Display name is required'; end if;
  update public.user_profiles set display_name=btrim(target_display_name),preferred_language=target_language,timezone=target_timezone where id=auth.uid();
end; $$;

create or replace function public.save_workspace_settings(target_workspace_id uuid,target_name text,target_timezone text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_workspace_super_admin(target_workspace_id) then raise exception 'Super Admin required'; end if;
  if nullif(btrim(target_name),'') is null then raise exception 'Workspace name is required'; end if;
  update public.workspaces set name=btrim(target_name),default_timezone=target_timezone where id=target_workspace_id;
end; $$;

revoke all on function public.change_idea_status(uuid,text,text) from public,anon;
revoke all on function public.bulk_update_ideas(uuid[],text,text[]) from public,anon;
revoke all on function public.save_idea_shooting_brief(uuid,text,text[],text[],text,text,text,date,text,uuid) from public,anon;
revoke all on function public.list_idea_activity(uuid) from public,anon;
revoke all on function public.list_calendar_events(uuid,date,date) from public,anon;
revoke all on function public.save_user_preferences(text,text,text) from public,anon;
revoke all on function public.save_workspace_settings(uuid,text,text) from public,anon;
grant execute on function public.change_idea_status(uuid,text,text) to authenticated;
grant execute on function public.bulk_update_ideas(uuid[],text,text[]) to authenticated;
grant execute on function public.save_idea_shooting_brief(uuid,text,text[],text[],text,text,text,date,text,uuid) to authenticated;
grant execute on function public.list_idea_activity(uuid) to authenticated;
grant execute on function public.list_calendar_events(uuid,date,date) to authenticated;
grant execute on function public.save_user_preferences(text,text,text) to authenticated;
grant execute on function public.save_workspace_settings(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
