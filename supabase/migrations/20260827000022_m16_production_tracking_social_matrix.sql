-- M16: Date-only shoot planning, compact social matrix, and atomic production bulk actions.
-- Existing Content, provenance, workflow events, briefs, and internal references are preserved in place.

alter table public.ideas add column if not exists planned_shoot_date date;
alter table public.contents add column if not exists planned_shoot_date date;

comment on column public.ideas.planned_shoot_date is
  'Date-only planned shooting date. No time is implied; actual timestamps come from workflow events.';
comment on column public.contents.planned_shoot_date is
  'Date-only planned shooting date inherited from the source Idea. No time is implied.';

create index if not exists ideas_client_planned_shoot_date_idx on public.ideas(client_id, planned_shoot_date);
create index if not exists contents_client_planned_shoot_date_idx on public.contents(client_id, planned_shoot_date);

-- The seven confirmed September values were supplied as shoot dates, not target publication dates.
with confirmed(title, shoot_date) as (values
  ('最近很多商家开始倒闭了，你怎样看？', date '2026-09-02'),
  ('做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？', date '2026-09-04'),
  ('不是已经有 SST 了吗？为什么安华又提 GST？', date '2026-09-09'),
  ('你觉得一个企业里面，什么部门最重要？', date '2026-09-11'),
  ('为什么公司名字叫 LKSOFT？', date '2026-09-16'),
  ('你觉得怎样的企业或老板，会有很好的发展？', date '2026-09-18'),
  ('很多人讲00后很难融入企业文化，你怎样看？', date '2026-09-23')
)
update public.ideas i set planned_shoot_date=confirmed.shoot_date, planned_date=null
from confirmed join public.clients client on client.ownership_type='internal_brand' and client.is_default_brand
where i.client_id=client.id and i.title=confirmed.title;

with confirmed(title, shoot_date) as (values
  ('最近很多商家开始倒闭了，你怎样看？', date '2026-09-02'),
  ('做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？', date '2026-09-04'),
  ('不是已经有 SST 了吗？为什么安华又提 GST？', date '2026-09-09'),
  ('你觉得一个企业里面，什么部门最重要？', date '2026-09-11'),
  ('为什么公司名字叫 LKSOFT？', date '2026-09-16'),
  ('你觉得怎样的企业或老板，会有很好的发展？', date '2026-09-18'),
  ('很多人讲00后很难融入企业文化，你怎样看？', date '2026-09-23')
)
update public.contents c set planned_shoot_date=confirmed.shoot_date, planned_date=null
from confirmed join public.clients client on client.ownership_type='internal_brand' and client.is_default_brand
where c.client_id=client.id and c.title=confirmed.title;

create or replace function public.inherit_content_planned_shoot_date()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.source_idea_id is not null and new.planned_shoot_date is null then
    select i.planned_shoot_date into new.planned_shoot_date from public.ideas i where i.id=new.source_idea_id;
  end if;
  return new;
end; $$;
drop trigger if exists contents_inherit_planned_shoot_date on public.contents;
create trigger contents_inherit_planned_shoot_date before insert or update of source_idea_id on public.contents
for each row execute function public.inherit_content_planned_shoot_date();

drop function if exists public.list_contents(uuid,uuid);
create function public.list_contents(target_workspace_id uuid,target_content_id uuid default null)
returns table(
  id uuid,workspace_id uuid,client_id uuid,source_idea_id uuid,content_code text,
  title text,working_title text,category_id uuid,campaign_id uuid,objective text,
  priority text,current_status text,current_owner_user_id uuid,current_owner_name text,
  internal_notes text,private_management_notes text,client_visible_notes text,
  direct_creation_reason text,record_status text,created_by uuid,created_at timestamptz,
  updated_at timestamptz,archived_at timestamptz,archive_reason text,planned_date date,
  planned_shoot_date date,shoot_scheduled_at timestamptz,ownership_name text,ownership_type text,is_default_brand boolean
)
language sql stable security definer set search_path='' as $$
  select c.id,c.workspace_id,c.client_id,c.source_idea_id,c.content_code,c.title,c.working_title,
    c.category_id,c.campaign_id,c.objective,c.priority,c.current_status,c.current_owner_user_id,
    owner.display_name,c.internal_notes,
    case when public.can_archive_content_client(c.client_id) then c.private_management_notes else null end,
    c.client_visible_notes,c.direct_creation_reason,c.record_status,c.created_by,c.created_at,c.updated_at,
    c.archived_at,c.archive_reason,c.planned_date,c.planned_shoot_date,c.shoot_scheduled_at,
    scope.name,scope.ownership_type,scope.is_default_brand
  from public.contents c join public.clients scope on scope.id=c.client_id
  left join public.user_profiles owner on owner.id=c.current_owner_user_id
  where c.workspace_id=target_workspace_id and (target_content_id is null or c.id=target_content_id)
    and public.can_view_content(c.id)
  order by c.planned_shoot_date nulls last,c.planned_date nulls last,c.updated_at desc;
$$;

drop function if exists public.list_idea_planner_context(uuid);
create function public.list_idea_planner_context(target_workspace_id uuid)
returns table(idea_id uuid,owner_name text,creator_name text,linked_content_id uuid,linked_content_code text,
  linked_content_status text,linked_content_record_status text,linked_content_planned_date date,
  linked_content_planned_shoot_date date,linked_content_shoot_scheduled_at timestamptz)
language sql stable security definer set search_path='' as $$
  select i.id,owner_profile.display_name,creator_profile.display_name,c.id,c.content_code,c.current_status,
    c.record_status,c.planned_date,c.planned_shoot_date,c.shoot_scheduled_at
  from public.ideas i
  left join public.user_profiles owner_profile on owner_profile.id=i.owner_user_id
  left join public.user_profiles creator_profile on creator_profile.id=i.created_by
  left join public.contents c on c.source_idea_id=i.id and public.can_manage_content_client(c.client_id)
  where i.workspace_id=target_workspace_id and public.can_view_idea(i.id)
  order by i.planned_shoot_date nulls last,i.planned_date nulls last,i.updated_at desc;
$$;

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
  select 'shoot-'||c.id,'SHOOT',coalesce(c.shoot_scheduled_at,c.planned_shoot_date::timestamptz),c.title,scope.name,c.current_status,'content',c.id
  from public.contents c join public.clients scope on scope.id=c.client_id
  where c.workspace_id=target_workspace_id and coalesce(c.shoot_scheduled_at::date,c.planned_shoot_date) between target_from and target_to
    and c.record_status='active' and public.can_view_content(c.id)
  union all
  select 'shoot-idea-'||i.id,'SHOOT',coalesce(i.shoot_planned_at,i.planned_shoot_date::timestamptz),i.title,scope.name,i.status,'idea',i.id
  from public.ideas i join public.clients scope on scope.id=i.client_id
  where i.workspace_id=target_workspace_id and coalesce(i.shoot_planned_at::date,i.planned_shoot_date) between target_from and target_to
    and public.can_view_idea(i.id) and not exists(select 1 from public.contents c where c.source_idea_id=i.id)
  union all
  select 'review-'||we.id,'REVIEW',we.occurred_at,c.title,scope.name,we.to_state,'content',c.id
  from public.workflow_events we join public.contents c on c.id=we.content_id join public.clients scope on scope.id=c.client_id
  where c.workspace_id=target_workspace_id and we.occurred_at::date between target_from and target_to
    and we.to_state in ('first_cut_submitted','internal_review','revision_required','client_review','approved')
    and c.record_status='active' and public.can_view_content(c.id)
  union all
  select 'publish-'||p.id,'PUBLISH',coalesce(p.published_at,p.scheduled_at),c.title,scope.name,p.status,'content',c.id
  from public.publications p join public.contents c on c.id=p.content_id join public.clients scope on scope.id=p.client_id
  where p.workspace_id=target_workspace_id and coalesce(p.published_at,p.scheduled_at)::date between target_from and target_to and public.can_view_content(c.id)
  order by 3,2;
$$;

create or replace function public.bulk_update_production_items(target_content_ids uuid[],target_field text,target_value text)
returns integer language plpgsql security definer set search_path='' as $$
declare item public.contents%rowtype; changed integer:=0; previous jsonb;
begin
  if coalesce(cardinality(target_content_ids),0)=0 then raise exception 'Select at least one Content'; end if;
  if target_field not in ('owner','planned_shoot_date') then raise exception 'Unsupported production bulk field'; end if;
  for item in select * from public.contents where id=any(target_content_ids) order by id for update loop
    if not public.can_manage_content_assignments(item.id) then raise exception 'Production bulk access denied'; end if;
    previous:=case when target_field='owner' then to_jsonb(item.current_owner_user_id) else to_jsonb(item.planned_shoot_date) end;
    if target_field='owner' then
      if nullif(target_value,'') is not null and not exists(select 1 from public.workspace_members wm where wm.workspace_id=item.workspace_id and wm.user_profile_id=target_value::uuid and wm.status='active') then raise exception 'Owner is not an active Workspace member'; end if;
      update public.contents set current_owner_user_id=nullif(target_value,'')::uuid where id=item.id;
    else
      update public.contents set planned_shoot_date=nullif(target_value,'')::date where id=item.id;
      if item.source_idea_id is not null then update public.ideas set planned_shoot_date=nullif(target_value,'')::date where id=item.source_idea_id; end if;
    end if;
    insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
    values(item.workspace_id,item.client_id,item.id,auth.uid(),'content',item.id,'production_bulk_updated',jsonb_build_object('field',target_field,'from',previous,'to',target_value));
    changed:=changed+1;
  end loop;
  if changed<>cardinality(target_content_ids) then raise exception 'One or more selected Content records were not found'; end if;
  return changed;
end; $$;

create or replace function public.bulk_assign_content_contributor(target_content_ids uuid[],target_user_id uuid,target_role_code text)
returns integer language plpgsql security definer set search_path='' as $$
declare item public.contents%rowtype; role_id uuid; changed integer:=0;
begin
  if coalesce(cardinality(target_content_ids),0)=0 then raise exception 'Select at least one Content'; end if;
  if target_role_code not in ('shooter','editor','reviewer','publisher') then raise exception 'Unsupported production role'; end if;
  for item in select * from public.contents where id=any(target_content_ids) order by id for update loop
    select id into role_id from public.contribution_roles where workspace_id=item.workspace_id and code=target_role_code and is_active;
    if role_id is null then raise exception 'Contribution role is unavailable'; end if;
    perform public.assign_content_contributor(item.id,target_user_id,role_id,null);
    changed:=changed+1;
  end loop;
  if changed<>cardinality(target_content_ids) then raise exception 'One or more selected Content records were not found'; end if;
  return changed;
end; $$;

create or replace function public.bulk_perform_content_workflow_action(target_content_ids uuid[],target_action text,expected_from_state text,target_note text default null)
returns integer language plpgsql security definer set search_path='' as $$
declare item_id uuid; changed integer:=0;
begin
  if coalesce(cardinality(target_content_ids),0)=0 then raise exception 'Select at least one Content'; end if;
  for item_id in select unnest(target_content_ids) order by 1 loop
    perform public.perform_content_workflow_action(item_id,target_action,expected_from_state,target_note);
    changed:=changed+1;
  end loop;
  return changed;
end; $$;

create or replace function public.bulk_update_idea_shoot_dates(target_idea_ids uuid[],target_date date)
returns integer language plpgsql security definer set search_path='' as $$
declare item public.ideas%rowtype; linked_content_id uuid; changed integer:=0;
begin
  if coalesce(cardinality(target_idea_ids),0)=0 then raise exception 'Select at least one Idea'; end if;
  for item in select * from public.ideas where id=any(target_idea_ids) order by id for update loop
    if not public.can_manage_research_client(item.client_id) then raise exception 'Idea bulk access denied'; end if;
    update public.ideas set planned_shoot_date=target_date where id=item.id;
    select id into linked_content_id from public.contents where source_idea_id=item.id;
    if linked_content_id is not null then update public.contents set planned_shoot_date=target_date where id=linked_content_id; end if;
    insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
    values(item.workspace_id,item.client_id,null,auth.uid(),'idea',item.id,'planned_shoot_date_updated',jsonb_build_object('from',item.planned_shoot_date,'to',target_date,'linked_content_id',linked_content_id));
    changed:=changed+1;
  end loop;
  if changed<>cardinality(target_idea_ids) then raise exception 'One or more selected Ideas were not found'; end if;
  return changed;
end; $$;
alter table public.social_accounts add column if not exists followers_data_source text;
insert into public.platforms(code,name,is_active,sort_order) values('tiktok','TikTok',true,50)
on conflict(code) do update set name=excluded.name,is_active=true,sort_order=excluded.sort_order;

-- Brand name is the default account name. Existing IDs and relationships stay unchanged.
update public.clients set name='LKSoft Solutions'
where ownership_type='internal_brand' and is_default_brand and lower(btrim(name)) in ('lksoft','lksoft solutions');

with brand as (select id from public.clients where ownership_type='internal_brand' and is_default_brand limit 1),
official(code,handle,url) as (values
  ('facebook','lksoftsolutions','https://www.facebook.com/lksoftsolutions'),
  ('instagram','lksoft_solutions','https://www.instagram.com/lksoft_solutions/'),
  ('youtube','@lksoftsolutions9915','https://www.youtube.com/channel/UCdZUONui0JEkunuclnUP0zQ'),
  ('tiktok','@lksoft_solutions','https://www.tiktok.com/@lksoft_solutions')
)
insert into public.social_accounts(client_id,platform_id,account_name,account_handle,external_url,is_active,followers,followers_updated_at,followers_data_source,note)
select brand.id,p.id,'LKSoft Solutions',official.handle,official.url,true,null,now(),'Public profile lookup unavailable or blocked','Official profile confirmed; follower count pending verification.'
from brand cross join official join public.platforms p on p.code=official.code
where not exists(select 1 from public.social_accounts sa where sa.client_id=brand.id and sa.platform_id=p.id)
on conflict do nothing;

with official(code,handle,url) as (values
  ('facebook','lksoftsolutions','https://www.facebook.com/lksoftsolutions'),
  ('instagram','lksoft_solutions','https://www.instagram.com/lksoft_solutions/'),
  ('youtube','@lksoftsolutions9915','https://www.youtube.com/channel/UCdZUONui0JEkunuclnUP0zQ'),
  ('tiktok','@lksoft_solutions','https://www.tiktok.com/@lksoft_solutions')
)
update public.social_accounts sa set account_name='LKSoft Solutions',account_handle=official.handle,external_url=official.url,
  followers_updated_at=coalesce(sa.followers_updated_at,now()),followers_data_source=coalesce(sa.followers_data_source,'Public profile lookup unavailable or blocked')
from official join public.platforms p on p.code=official.code join public.clients c on c.ownership_type='internal_brand' and c.is_default_brand
where sa.client_id=c.id and sa.platform_id=p.id;

create or replace function public.update_brand_social_followers(target_account_id uuid,target_followers bigint,target_data_source text default 'Manual')
returns void language plpgsql security definer set search_path='' as $$
declare account_scope public.social_accounts%rowtype;
begin
  select * into account_scope from public.social_accounts where id=target_account_id for update;
  if account_scope.id is null or not public.can_manage_content_client(account_scope.client_id) then raise exception 'Brand account access denied'; end if;
  if target_followers is not null and target_followers<0 then raise exception 'Followers cannot be negative'; end if;
  update public.social_accounts set followers=target_followers,followers_updated_at=now(),followers_data_source=coalesce(nullif(btrim(target_data_source),''),'Manual') where id=target_account_id;
end; $$;

revoke all on function public.list_contents(uuid,uuid),public.list_idea_planner_context(uuid),public.list_calendar_events(uuid,date,date),
  public.bulk_update_idea_shoot_dates(uuid[],date),public.bulk_update_production_items(uuid[],text,text),public.bulk_assign_content_contributor(uuid[],uuid,text),
  public.bulk_perform_content_workflow_action(uuid[],text,text,text),public.update_brand_social_followers(uuid,bigint,text) from public,anon;
grant execute on function public.list_contents(uuid,uuid),public.list_idea_planner_context(uuid),public.list_calendar_events(uuid,date,date),
  public.bulk_update_idea_shoot_dates(uuid[],date),public.bulk_update_production_items(uuid[],text,text),public.bulk_assign_content_contributor(uuid[],uuid,text),
  public.bulk_perform_content_workflow_action(uuid[],text,text,text),public.update_brand_social_followers(uuid,bigint,text) to authenticated;

notify pgrst,'reload schema';
