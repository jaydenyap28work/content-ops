-- M23: LKSoft Idea provider semantics and least-privilege Idea Contributor access.
-- Existing Idea, Content, production, and operational records are preserved in place.

insert into public.roles(id,workspace_id,code,name,description,is_active)
select '00000000-0000-4000-8000-000000000110',w.id,'idea_contributor','Idea Contributor',
  'Can view the Idea pool and submit or edit their own early-stage Ideas.',true
from public.workspaces w where w.id='00000000-0000-4000-8000-000000000001'
on conflict(workspace_id,code) do update set name=excluded.name,description=excluded.description,is_active=true,updated_at=now();

alter table public.ideas add column if not exists idea_provider_team_member_id uuid
  references public.team_members(id) on delete restrict;
create index if not exists ideas_provider_planning_idx
  on public.ideas(idea_provider_team_member_id,planning_status,updated_at desc);
comment on column public.ideas.idea_provider_team_member_id is
  'Team Member who proposed or shared the Idea; distinct from record creator and Production owner.';

create or replace function public.has_workspace_role(target_workspace_id uuid,target_role_code text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.workspace_members wm
    join public.user_profiles up on up.id=wm.user_profile_id
    join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
    join public.roles r on r.id=wmr.role_id
    where wm.workspace_id=target_workspace_id and wm.user_profile_id=(select auth.uid())
      and wm.status='active' and up.status='active' and r.is_active and r.code=target_role_code
  );
$$;

-- Idea Contributor is deliberately not an internal production role.
create or replace function public.is_internal_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.workspace_members wm
    join public.user_profiles up on up.id=wm.user_profile_id
    join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
    join public.roles r on r.id=wmr.role_id
    where wm.workspace_id=target_workspace_id and wm.user_profile_id=(select auth.uid())
      and wm.status='active' and up.status='active' and r.is_active
      and r.code not in ('client_admin','client_viewer','idea_contributor')
  );
$$;

create or replace function public.can_access_idea_pool(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.has_research_role(target_workspace_id)
    or public.has_workspace_role(target_workspace_id,'idea_contributor');
$$;

create or replace function public.can_view_idea(target_idea_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.ideas i where i.id=target_idea_id
    and (public.can_manage_research_client(i.client_id)
      or public.has_workspace_role(i.workspace_id,'idea_contributor')));
$$;

create or replace function public.can_edit_idea_submission(target_idea_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.ideas i
    where i.id=target_idea_id and (
      public.can_manage_research_client(i.client_id)
      or (
        public.has_workspace_role(i.workspace_id,'idea_contributor')
        and i.planning_status in ('new','evaluating')
        and exists(select 1 from public.team_members tm
          where tm.id=i.idea_provider_team_member_id and tm.workspace_id=i.workspace_id
            and tm.auth_user_id=(select auth.uid()) and tm.status='active')
      )
    )
  );
$$;

create or replace function public.enforce_idea_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare client_workspace uuid; category_workspace uuid; category_client uuid; provider_workspace uuid;
begin
  select workspace_id into client_workspace from public.clients where id=new.client_id;
  if client_workspace is null or client_workspace is distinct from new.workspace_id then raise exception 'Idea and Client must share a Workspace'; end if;
  if new.category_id is not null then
    select workspace_id,client_id into category_workspace,category_client from public.content_categories where id=new.category_id and is_active;
    if category_workspace is distinct from new.workspace_id or (category_client is not null and category_client is distinct from new.client_id) then raise exception 'Category scope does not cover this Idea'; end if;
  end if;
  if new.idea_provider_team_member_id is not null then
    select workspace_id into provider_workspace from public.team_members where id=new.idea_provider_team_member_id and status='active';
    if provider_workspace is distinct from new.workspace_id then raise exception 'Idea provider must be an active Team Member in the same Workspace'; end if;
  end if;
  return new;
end; $$;

drop policy if exists "Idea contributors can view Workspace Tags" on public.tags;
create policy "Idea contributors can view Workspace Tags" on public.tags for select to authenticated
  using(public.has_workspace_role(workspace_id,'idea_contributor'));

create or replace function public.list_idea_submission_catalog(target_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare clients_json jsonb; platforms_json jsonb; categories_json jsonb;
begin
  if not public.can_access_idea_pool(target_workspace_id) then raise exception 'Idea pool access denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'workspace_id',c.workspace_id,'name',c.name,'code',c.code,'industry',c.industry,
    'description',null,'brand_notes',null,'status',c.status,'ownership_type',c.ownership_type,
    'is_default_brand',c.is_default_brand,'created_at',c.created_at,'updated_at',c.updated_at) order by c.name),'[]'::jsonb)
  into clients_json from public.clients c
  where c.workspace_id=target_workspace_id and c.status='active' and (
    public.can_manage_research_client(c.id) or (
      public.has_workspace_role(target_workspace_id,'idea_contributor')
      and c.ownership_type='internal_brand' and c.is_default_brand));

  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name) order by p.sort_order),'[]'::jsonb)
  into platforms_json from public.platforms p where p.is_active;

  select coalesce(jsonb_agg(jsonb_build_object('id',cc.id,'client_id',cc.client_id,'name',cc.name) order by cc.sort_order),'[]'::jsonb)
  into categories_json from public.content_categories cc
  where cc.workspace_id=target_workspace_id and cc.is_active
    and (cc.client_id is null or exists(
      select 1 from public.clients c where c.id=cc.client_id and c.status='active' and (
        public.can_manage_research_client(c.id) or (
          public.has_workspace_role(target_workspace_id,'idea_contributor')
          and c.ownership_type='internal_brand' and c.is_default_brand))));

  return jsonb_build_object('clients',clients_json,'platforms',platforms_json,'categories',categories_json,'contributionRoles','[]'::jsonb);
end; $$;

create or replace function public.list_idea_provider_options(target_client_id uuid)
returns table(team_member_id uuid,display_name text,is_current_user boolean)
language sql stable security definer set search_path='' as $$
  select tm.id,tm.name,tm.auth_user_id=(select auth.uid())
  from public.team_members tm join public.clients c on c.workspace_id=tm.workspace_id and c.id=target_client_id
  where tm.status='active' and (
    public.can_manage_research_client(c.id)
    or (public.has_workspace_role(c.workspace_id,'idea_contributor') and tm.auth_user_id=(select auth.uid()))
  ) order by (tm.auth_user_id=(select auth.uid())) desc,tm.name;
$$;

create or replace function public.save_idea_submission(
  target_idea_id uuid,target_workspace_id uuid,target_client_id uuid,target_title text,target_source_url text,
  target_original_topic text,target_original_hook text,target_why_it_works text,target_our_angle text,target_category_id uuid,
  target_suggested_format text,target_priority text,target_provider_team_member_id uuid,target_notes text,target_reference_ids uuid[],
  target_tag_names text[],target_contributors jsonb,target_planned_date date,target_source_platform text,
  target_raw_content text,target_content_format text
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; existing public.ideas%rowtype; clean_title text:=btrim(target_title);
  normalized_format text:=nullif(lower(btrim(target_content_format)),'');
  normalized_priority text:=coalesce(nullif(lower(btrim(target_priority)),''),'normal'); tag_name text; tag_id uuid;
  contributor_mode boolean:=public.has_workspace_role(target_workspace_id,'idea_contributor') and not public.has_research_role(target_workspace_id);
begin
  if nullif(clean_title,'') is null then raise exception 'Idea title is required'; end if;
  if normalized_format is not null and normalized_format not in ('q_and_a','talking_head','skit','product_demo','podcast','voice_over','event') then raise exception 'Unsupported Content format'; end if;
  if normalized_priority not in ('low','normal','high','urgent') then raise exception 'Unsupported Idea priority'; end if;

  if contributor_mode then
    if not exists(select 1 from public.clients c where c.id=target_client_id and c.workspace_id=target_workspace_id
      and c.status='active' and c.ownership_type='internal_brand' and c.is_default_brand) then raise exception 'Idea Brand access denied'; end if;
    if target_provider_team_member_id is null or not exists(select 1 from public.team_members tm
      where tm.id=target_provider_team_member_id and tm.workspace_id=target_workspace_id
        and tm.auth_user_id=(select auth.uid()) and tm.status='active') then raise exception 'Idea provider identity cannot be changed'; end if;
    if coalesce(cardinality(target_reference_ids),0)>0 or coalesce(jsonb_array_length(coalesce(target_contributors,'[]'::jsonb)),0)>0 then raise exception 'Idea Contributor cannot assign References or Contributors'; end if;
    if target_idea_id is null then
      insert into public.ideas(workspace_id,client_id,title,source_url,source_platform,raw_content,content_format,
        original_topic,original_hook,why_it_works,our_angle,category_id,suggested_format,priority,planning_status,status,
        owner_user_id,idea_provider_team_member_id,notes,created_by,planned_date)
      values(target_workspace_id,target_client_id,clean_title,nullif(btrim(target_source_url),''),nullif(btrim(target_source_platform),''),
        nullif(btrim(target_raw_content),''),normalized_format,nullif(btrim(target_original_topic),''),nullif(btrim(target_original_hook),''),
        nullif(btrim(target_why_it_works),''),nullif(btrim(target_our_angle),''),target_category_id,nullif(btrim(target_suggested_format),''),
        normalized_priority,'new','new',null,target_provider_team_member_id,nullif(btrim(target_notes),''),auth.uid(),target_planned_date)
      returning id into saved;
    else
      select * into existing from public.ideas where id=target_idea_id for update;
      if existing.id is null or not public.can_edit_idea_submission(existing.id) then raise exception 'Idea edit access denied'; end if;
      if existing.workspace_id<>target_workspace_id or existing.client_id<>target_client_id
        or existing.idea_provider_team_member_id<>target_provider_team_member_id then raise exception 'Idea ownership or provider cannot be changed'; end if;
      update public.ideas set title=clean_title,source_url=nullif(btrim(target_source_url),''),source_platform=nullif(btrim(target_source_platform),''),
        raw_content=nullif(btrim(target_raw_content),''),content_format=normalized_format,original_topic=nullif(btrim(target_original_topic),''),
        original_hook=nullif(btrim(target_original_hook),''),why_it_works=nullif(btrim(target_why_it_works),''),our_angle=nullif(btrim(target_our_angle),''),
        category_id=target_category_id,suggested_format=nullif(btrim(target_suggested_format),''),priority=normalized_priority,
        notes=nullif(btrim(target_notes),''),planned_date=target_planned_date where id=existing.id;
      saved:=existing.id;
    end if;
  else
    if not public.can_manage_research_client(target_client_id) then raise exception 'Idea Client access denied'; end if;
    if target_provider_team_member_id is not null and not exists(select 1 from public.team_members tm
      where tm.id=target_provider_team_member_id and tm.workspace_id=target_workspace_id and tm.status='active') then raise exception 'Idea provider is unavailable'; end if;
    saved:=public.save_idea(target_idea_id,target_workspace_id,target_client_id,clean_title,target_source_url,target_original_topic,
      target_original_hook,target_why_it_works,target_our_angle,target_category_id,target_suggested_format,normalized_priority,
      null,target_notes,target_reference_ids,target_tag_names,target_contributors,target_planned_date,target_source_platform,target_raw_content,target_content_format);
    update public.ideas set idea_provider_team_member_id=target_provider_team_member_id,
      owner_user_id=case when target_idea_id is null then null else owner_user_id end where id=saved;
    return saved;
  end if;

  delete from public.idea_tags where idea_id=saved;
  foreach tag_name in array coalesce(target_tag_names,'{}'::text[]) loop
    if btrim(tag_name)<>'' then
      select id into tag_id from public.tags where workspace_id=target_workspace_id and client_id is not distinct from target_client_id and lower(btrim(name))=lower(btrim(tag_name)) limit 1;
      if tag_id is null then insert into public.tags(workspace_id,client_id,name) values(target_workspace_id,target_client_id,btrim(tag_name)) on conflict do nothing returning id into tag_id; end if;
      if tag_id is null then select id into tag_id from public.tags where workspace_id=target_workspace_id and client_id is not distinct from target_client_id and lower(btrim(name))=lower(btrim(tag_name)) limit 1; end if;
      insert into public.idea_tags(idea_id,tag_id) values(saved,tag_id) on conflict do nothing;
    end if;
  end loop;
  return saved;
end; $$;

create or replace function public.bulk_update_idea_providers(target_idea_ids uuid[],target_team_member_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare source public.ideas%rowtype; changed integer:=0;
begin
  if coalesce(cardinality(target_idea_ids),0)=0 then raise exception 'Select at least one Idea'; end if;
  for source in select * from public.ideas where id=any(target_idea_ids) order by id for update loop
    if not public.can_manage_research_client(source.client_id) then raise exception 'Idea bulk access denied'; end if;
    if target_team_member_id is not null and not exists(select 1 from public.team_members tm where tm.id=target_team_member_id and tm.workspace_id=source.workspace_id and tm.status='active') then raise exception 'Idea provider is unavailable'; end if;
    update public.ideas set idea_provider_team_member_id=target_team_member_id where id=source.id;
    changed:=changed+1;
  end loop;
  if changed<>cardinality(target_idea_ids) then raise exception 'One or more selected Ideas were not found'; end if;
  return changed;
end; $$;

drop function if exists public.list_idea_planner_context(uuid);
create function public.list_idea_planner_context(target_workspace_id uuid)
returns table(idea_id uuid,owner_name text,creator_name text,provider_name text,can_edit_submission boolean,
  linked_content_id uuid,linked_content_code text,linked_content_status text,linked_content_record_status text,
  linked_content_planned_date date,linked_content_planned_shoot_date date,linked_content_shoot_scheduled_at timestamptz)
language sql stable security definer set search_path='' as $$
  select i.id,owner_profile.display_name,creator_profile.display_name,provider.name,public.can_edit_idea_submission(i.id),
    c.id,c.content_code,c.current_status,c.record_status,c.planned_date,c.planned_shoot_date,c.shoot_scheduled_at
  from public.ideas i
  left join public.user_profiles owner_profile on owner_profile.id=i.owner_user_id
  left join public.user_profiles creator_profile on creator_profile.id=i.created_by
  left join public.team_members provider on provider.id=i.idea_provider_team_member_id
  left join public.contents c on c.source_idea_id=i.id
  where i.workspace_id=target_workspace_id and public.can_view_idea(i.id)
  order by i.planned_shoot_date nulls last,i.planned_date nulls last,i.updated_at desc;
$$;

revoke all on function public.has_workspace_role(uuid,text),public.can_access_idea_pool(uuid),public.can_edit_idea_submission(uuid),
  public.list_idea_submission_catalog(uuid),public.list_idea_provider_options(uuid),
  public.save_idea_submission(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text),
  public.bulk_update_idea_providers(uuid[],uuid),public.list_idea_planner_context(uuid) from public,anon;
grant execute on function public.has_workspace_role(uuid,text),public.can_access_idea_pool(uuid),public.can_edit_idea_submission(uuid),
  public.list_idea_submission_catalog(uuid),public.list_idea_provider_options(uuid),
  public.save_idea_submission(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text),
  public.bulk_update_idea_providers(uuid[],uuid),public.list_idea_planner_context(uuid) to authenticated;

notify pgrst,'reload schema';