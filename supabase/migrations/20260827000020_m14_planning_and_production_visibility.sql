-- M14: Separate planning decisions from production workflow and clarify planning dates.

alter table public.ideas
  add column if not exists planning_status text not null default 'new'
  check (planning_status in ('new','evaluating','confirmed','paused','rejected','archived'));

alter table public.ideas
  add column if not exists shoot_planned_at timestamptz;

update public.ideas
set planning_status = case status
  when 'evaluating' then 'evaluating'
  when 'approved' then 'confirmed'
  when 'converted' then 'confirmed'
  when 'rejected' then 'rejected'
  when 'archived' then 'archived'
  else 'new'
end;

comment on column public.ideas.planned_date is
  'Target publication date for Marketing planning. Not a shoot date or actual published_at.';
comment on column public.contents.planned_date is
  'Target publication date inherited from planning. Not a shoot date or actual published_at.';
comment on column public.ideas.shoot_planned_at is
  'Planned shooting date/time. Actual shooting timestamps are recorded by workflow actions.';

create index if not exists ideas_client_planning_status_target_date_idx
  on public.ideas(client_id, planning_status, planned_date);
create index if not exists ideas_client_shoot_planned_at_idx
  on public.ideas(client_id, shoot_planned_at);

drop function if exists public.list_idea_planner_context(uuid);
create function public.list_idea_planner_context(target_workspace_id uuid)
returns table(
  idea_id uuid,
  owner_name text,
  creator_name text,
  linked_content_id uuid,
  linked_content_code text,
  linked_content_status text,
  linked_content_record_status text,
  linked_content_planned_date date,
  linked_content_shoot_scheduled_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select i.id, owner_profile.display_name, creator_profile.display_name,
    c.id, c.content_code, c.current_status, c.record_status, c.planned_date, c.shoot_scheduled_at
  from public.ideas i
  left join public.user_profiles owner_profile on owner_profile.id = i.owner_user_id
  left join public.user_profiles creator_profile on creator_profile.id = i.created_by
  left join public.contents c on c.source_idea_id = i.id and public.can_manage_content_client(c.client_id)
  where i.workspace_id = target_workspace_id and public.can_view_idea(i.id)
  order by i.planned_date nulls last, i.updated_at desc;
$$;

drop function if exists public.list_contents(uuid, uuid);
create function public.list_contents(target_workspace_id uuid, target_content_id uuid default null)
returns table(
  id uuid, workspace_id uuid, client_id uuid, source_idea_id uuid, content_code text,
  title text, working_title text, category_id uuid, campaign_id uuid, objective text,
  priority text, current_status text, current_owner_user_id uuid, current_owner_name text,
  internal_notes text, private_management_notes text, client_visible_notes text,
  direct_creation_reason text, record_status text, created_by uuid, created_at timestamptz,
  updated_at timestamptz, archived_at timestamptz, archive_reason text, planned_date date,
  shoot_scheduled_at timestamptz, ownership_name text, ownership_type text, is_default_brand boolean
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.workspace_id, c.client_id, c.source_idea_id, c.content_code, c.title, c.working_title,
    c.category_id, c.campaign_id, c.objective, c.priority, c.current_status, c.current_owner_user_id,
    owner.display_name, c.internal_notes,
    case when public.can_archive_content_client(c.client_id) then c.private_management_notes else null end,
    c.client_visible_notes, c.direct_creation_reason, c.record_status, c.created_by,
    c.created_at, c.updated_at, c.archived_at, c.archive_reason, c.planned_date,
    c.shoot_scheduled_at, scope.name, scope.ownership_type, scope.is_default_brand
  from public.contents c
  join public.clients scope on scope.id = c.client_id
  left join public.user_profiles owner on owner.id = c.current_owner_user_id
  where c.workspace_id = target_workspace_id
    and (target_content_id is null or c.id = target_content_id)
    and public.can_view_content(c.id)
  order by c.planned_date nulls last, c.updated_at desc;
$$;

create or replace function public.bulk_update_planning_items(target_idea_ids uuid[], target_field text, target_values text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
  source public.ideas%rowtype;
  linked_content_id uuid;
  changed integer := 0;
  legacy_status text;
  tag_name text;
  tag_id uuid;
begin
  if coalesce(cardinality(target_idea_ids), 0) = 0 then raise exception 'Select at least one Idea'; end if;
  if target_field not in ('planning_status','owner','target_publish_date','shoot_planned_at','priority','category','tags') then
    raise exception 'Unsupported planning bulk field';
  end if;

  for source in select * from public.ideas where id = any(target_idea_ids) order by id for update loop
    if not public.can_manage_research_client(source.client_id) then raise exception 'Idea bulk access denied'; end if;
    select c.id into linked_content_id from public.contents c where c.source_idea_id = source.id;

    if target_field = 'planning_status' then
      if target_values[1] not in ('new','evaluating','confirmed','paused','rejected','archived') then raise exception 'Invalid planning status'; end if;
      update public.ideas set planning_status = target_values[1] where id = source.id;
      if source.status <> 'converted' then
        legacy_status := case target_values[1]
          when 'new' then 'new' when 'evaluating' then 'evaluating' when 'confirmed' then 'approved'
          when 'paused' then 'rejected' when 'rejected' then 'rejected' when 'archived' then 'archived' end;
        update public.ideas set status = legacy_status,
          archived_at = case when legacy_status = 'archived' then coalesce(archived_at, now()) else null end
        where id = source.id;
      end if;
    elsif target_field = 'owner' then
      if nullif(target_values[1], '') is not null and not exists(
        select 1 from public.workspace_members wm where wm.workspace_id = source.workspace_id
          and wm.user_profile_id = target_values[1]::uuid and wm.status = 'active'
          and (exists(select 1 from public.workspace_member_roles wmr join public.roles r on r.id = wmr.role_id where wmr.workspace_member_id = wm.id and r.code = 'super_admin' and r.is_active)
            or exists(select 1 from public.client_members cm where cm.workspace_member_id = wm.id and cm.client_id = source.client_id and cm.status = 'active'))
      ) then raise exception 'Owner does not have active Client access'; end if;
      update public.ideas set owner_user_id = nullif(target_values[1], '')::uuid where id = source.id;
      if linked_content_id is not null then update public.contents set current_owner_user_id = nullif(target_values[1], '')::uuid where id = linked_content_id; end if;
    elsif target_field = 'target_publish_date' then
      update public.ideas set planned_date = nullif(target_values[1], '')::date where id = source.id;
      if linked_content_id is not null then update public.contents set planned_date = nullif(target_values[1], '')::date where id = linked_content_id; end if;
    elsif target_field = 'shoot_planned_at' then
      update public.ideas set shoot_planned_at = nullif(target_values[1], '')::timestamptz where id = source.id;
      if linked_content_id is not null then update public.contents set shoot_scheduled_at = nullif(target_values[1], '')::timestamptz where id = linked_content_id; end if;
    elsif target_field = 'priority' then
      if target_values[1] not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
      update public.ideas set priority = target_values[1] where id = source.id;
      if linked_content_id is not null then update public.contents set priority = target_values[1] where id = linked_content_id; end if;
    elsif target_field = 'category' then
      if nullif(target_values[1], '') is not null and not exists(select 1 from public.content_categories cc where cc.id = target_values[1]::uuid and cc.workspace_id = source.workspace_id and cc.is_active) then raise exception 'Category is outside the Idea Workspace or inactive'; end if;
      update public.ideas set category_id = nullif(target_values[1], '')::uuid where id = source.id;
      if linked_content_id is not null then update public.contents set category_id = nullif(target_values[1], '')::uuid where id = linked_content_id; end if;
    elsif target_field = 'tags' then
      delete from public.idea_tags where idea_id = source.id;
      if linked_content_id is not null then delete from public.content_tags where content_id = linked_content_id; end if;
      foreach tag_name in array coalesce(target_values, '{}') loop
        if btrim(tag_name) <> '' then
          select id into tag_id from public.tags where workspace_id = source.workspace_id and client_id is not distinct from source.client_id and lower(btrim(name)) = lower(btrim(tag_name)) limit 1;
          if tag_id is null then insert into public.tags(workspace_id, client_id, name) values(source.workspace_id, source.client_id, btrim(tag_name)) on conflict do nothing returning id into tag_id; end if;
          if tag_id is null then select id into tag_id from public.tags where workspace_id = source.workspace_id and client_id is not distinct from source.client_id and lower(btrim(name)) = lower(btrim(tag_name)) limit 1; end if;
          insert into public.idea_tags(idea_id, tag_id) values(source.id, tag_id) on conflict do nothing;
          if linked_content_id is not null then insert into public.content_tags(content_id, tag_id) values(linked_content_id, tag_id) on conflict do nothing; end if;
        end if;
      end loop;
    end if;

    insert into public.activity_logs(workspace_id, client_id, content_id, actor_user_id, entity_type, entity_id, action, metadata)
    values(source.workspace_id, source.client_id, null, auth.uid(), 'idea', source.id, 'planning_bulk_updated',
      jsonb_build_object('field', target_field, 'values', target_values, 'linked_content_id', linked_content_id));
    changed := changed + 1;
  end loop;
  if changed <> cardinality(target_idea_ids) then raise exception 'One or more selected Ideas were not found'; end if;
  return changed;
end;
$$;

create or replace function public.change_idea_status(target_idea_id uuid,target_status text,target_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare source public.ideas%rowtype; allowed boolean; target_planning_status text;
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
    when 'converted' then false else false end;
  if not allowed then raise exception 'Invalid Idea status transition from % to %',source.status,target_status; end if;
  if target_status in ('rejected','archived') and nullif(btrim(target_reason),'') is null then raise exception 'Reason is required for Reject or Archive'; end if;
  target_planning_status:=case target_status when 'approved' then 'confirmed' when 'rejected' then 'rejected' else target_status end;
  update public.ideas set status=target_status,planning_status=target_planning_status,status_reason=nullif(btrim(target_reason),''),archived_at=case when target_status='archived' then now() else null end where id=source.id;
  insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(source.workspace_id,source.client_id,null,auth.uid(),'idea',source.id,'idea_status_changed',jsonb_build_object('from',source.status,'to',target_status,'planning_status',target_planning_status,'reason',nullif(btrim(target_reason),'')));
end; $$;

revoke all on function public.change_idea_status(uuid,text,text) from public, anon;
grant execute on function public.change_idea_status(uuid,text,text) to authenticated;
revoke all on function public.list_idea_planner_context(uuid) from public, anon;
revoke all on function public.list_contents(uuid, uuid) from public, anon;
revoke all on function public.bulk_update_planning_items(uuid[], text, text[]) from public, anon;
grant execute on function public.list_idea_planner_context(uuid) to authenticated;
grant execute on function public.list_contents(uuid, uuid) to authenticated;
grant execute on function public.bulk_update_planning_items(uuid[], text, text[]) to authenticated;

notify pgrst, 'reload schema';
