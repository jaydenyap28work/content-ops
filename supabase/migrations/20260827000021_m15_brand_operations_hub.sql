-- M15: Clarify planning decisions and add the LKSoft internal brand operations hub.
-- Existing Ideas, Contents, workflow history, publications, analytics, and provenance are preserved.

alter table public.social_accounts add column if not exists followers bigint
  check (followers is null or followers >= 0);
alter table public.social_accounts add column if not exists followers_updated_at timestamptz;
alter table public.social_accounts add column if not exists note text;

update public.platforms set is_active = true where code in ('facebook','instagram','youtube','xhs');
insert into public.platforms(code,name,is_active,sort_order) values
  ('threads','Threads',true,60),
  ('lemon8','Lemon8',true,70)
on conflict(code) do update set name=excluded.name,is_active=true,sort_order=excluded.sort_order;

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  category text not null check (category in ('logo','talent','office_broll','product','screenshots','workshop_event','intro_outro','other')),
  description text,
  location text not null check (btrim(location) <> ''),
  tags text[] not null default '{}',
  is_recommended boolean not null default false,
  usage_notes text,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index brand_assets_client_name_key on public.brand_assets(client_id,lower(btrim(name)));
create index brand_assets_client_status_recommended_idx on public.brand_assets(client_id,status,is_recommended desc,updated_at desc);
create trigger brand_assets_set_updated_at before update on public.brand_assets for each row execute function public.set_updated_at();
alter table public.brand_assets enable row level security;

create policy "Authorized internal users can view Brand Assets" on public.brand_assets
for select to authenticated using (
  exists(select 1 from public.clients c where c.id=brand_assets.client_id and c.workspace_id=brand_assets.workspace_id
    and c.ownership_type='internal_brand' and public.is_internal_workspace_member(c.workspace_id)
    and (public.is_workspace_super_admin(c.workspace_id) or public.has_active_client_access(c.id)))
);
revoke insert,update,delete on public.brand_assets from anon,authenticated;

create or replace function public.confirm_idea_for_production(target_idea_id uuid)
returns table(content_id uuid,content_code text,created_new boolean)
language plpgsql security definer set search_path='' as $$
declare source public.ideas%rowtype; existing public.contents%rowtype; converted record;
begin
  select * into source from public.ideas where id=target_idea_id for update;
  if source.id is null or not public.can_manage_content_client(source.client_id) then raise exception 'Idea confirmation access denied'; end if;
  if source.planning_status='archived' then raise exception 'Archived Idea cannot be confirmed'; end if;

  select * into existing from public.contents where source_idea_id=source.id;
  if existing.id is not null then
    update public.ideas set planning_status='confirmed',status='converted',archived_at=null where id=source.id;
    return query select existing.id,existing.content_code,false;
    return;
  end if;

  update public.ideas set planning_status='confirmed',status='approved',status_reason='Confirmed for production',archived_at=null where id=source.id;
  select * into converted from public.convert_idea_to_content(
    source.id,source.title,source.title,null,source.our_angle,source.owner_user_id,
    source.notes,'','','{}'::text[]
  );
  return query select converted.content_id,converted.content_code,true;
end; $$;

create or replace function public.save_brand_social_account(
  target_account_id uuid,target_client_id uuid,target_platform_id uuid,target_account_name text,
  target_account_handle text,target_external_url text,target_followers bigint,target_active boolean,target_note text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
  if not exists(select 1 from public.clients c where c.id=target_client_id and c.ownership_type='internal_brand' and c.status='active')
    or not public.can_manage_content_client(target_client_id) then raise exception 'Brand account access denied'; end if;
  if not exists(select 1 from public.platforms p where p.id=target_platform_id and p.is_active) then raise exception 'Active Platform required'; end if;
  if nullif(btrim(target_account_name),'') is null or nullif(btrim(target_account_handle),'') is null then raise exception 'Account name and handle are required'; end if;
  if target_followers is not null and target_followers < 0 then raise exception 'Followers cannot be negative'; end if;

  if target_account_id is null then
    insert into public.social_accounts(client_id,platform_id,account_name,account_handle,external_url,followers,followers_updated_at,is_active,note)
    values(target_client_id,target_platform_id,btrim(target_account_name),btrim(target_account_handle),nullif(btrim(target_external_url),''),target_followers,case when target_followers is null then null else now() end,target_active,nullif(btrim(target_note),''))
    returning id into saved;
  else
    update public.social_accounts set platform_id=target_platform_id,account_name=btrim(target_account_name),account_handle=btrim(target_account_handle),
      external_url=nullif(btrim(target_external_url),''),followers=target_followers,
      followers_updated_at=case when followers is distinct from target_followers then now() else followers_updated_at end,
      is_active=target_active,note=nullif(btrim(target_note),'')
    where id=target_account_id and client_id=target_client_id returning id into saved;
    if saved is null then raise exception 'Brand account not found'; end if;
  end if;
  return saved;
end; $$;

create or replace function public.save_brand_asset(
  target_asset_id uuid,target_client_id uuid,target_name text,target_category text,target_description text,
  target_location text,target_tags text[],target_recommended boolean,target_usage_notes text,target_status text default 'active'
)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; workspace_scope uuid;
begin
  select workspace_id into workspace_scope from public.clients where id=target_client_id and ownership_type='internal_brand' and status='active';
  if workspace_scope is null or not public.can_manage_content_client(target_client_id) then raise exception 'Brand Asset access denied'; end if;
  if target_category not in ('logo','talent','office_broll','product','screenshots','workshop_event','intro_outro','other') then raise exception 'Unsupported Asset category'; end if;
  if target_status not in ('active','archived') then raise exception 'Unsupported Asset status'; end if;
  if nullif(btrim(target_name),'') is null or nullif(btrim(target_location),'') is null then raise exception 'Asset name and location are required'; end if;
  if target_asset_id is null then
    insert into public.brand_assets(workspace_id,client_id,name,category,description,location,tags,is_recommended,usage_notes,status,created_by)
    values(workspace_scope,target_client_id,btrim(target_name),target_category,nullif(btrim(target_description),''),btrim(target_location),coalesce(target_tags,'{}'),target_recommended,nullif(btrim(target_usage_notes),''),target_status,auth.uid()) returning id into saved;
  else
    update public.brand_assets set name=btrim(target_name),category=target_category,description=nullif(btrim(target_description),''),location=btrim(target_location),
      tags=coalesce(target_tags,'{}'),is_recommended=target_recommended,usage_notes=nullif(btrim(target_usage_notes),''),status=target_status
    where id=target_asset_id and client_id=target_client_id returning id into saved;
    if saved is null then raise exception 'Brand Asset not found'; end if;
  end if;
  return saved;
end; $$;

insert into public.brand_assets(workspace_id,client_id,name,category,description,location,tags,is_recommended,usage_notes,status,created_by)
select c.workspace_id,c.id,'LKSoft 常用素材库','other','LKSoft 当前常用素材的 Google Drive 索引。大文件继续保留在 Drive。',
  'https://drive.google.com/drive/folders/1t-0wy9Fu-Y8XCa3UQh-irWq_XjABOwVt?usp=sharing',array['Google Drive','常用素材','新人入口'],true,
  '优先从这里查找 Logo、Steven、Office B-roll、Product footage 与 Intro / Outro。','active',
  (select wm.user_profile_id from public.workspace_members wm join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id join public.roles r on r.id=wmr.role_id where wm.workspace_id=c.workspace_id and wm.status='active' and r.code='super_admin' and r.is_active limit 1)
from public.clients c
where lower(btrim(c.name))='lksoft' and c.ownership_type='internal_brand' and c.is_default_brand
  and not exists(select 1 from public.brand_assets ba where ba.client_id=c.id and lower(btrim(ba.name))=lower('LKSoft 常用素材库'));

revoke all on function public.confirm_idea_for_production(uuid) from public,anon;
revoke all on function public.save_brand_social_account(uuid,uuid,uuid,text,text,text,bigint,boolean,text) from public,anon;
revoke all on function public.save_brand_asset(uuid,uuid,text,text,text,text,text[],boolean,text,text) from public,anon;
grant execute on function public.confirm_idea_for_production(uuid) to authenticated;
grant execute on function public.save_brand_social_account(uuid,uuid,uuid,text,text,text,bigint,boolean,text) to authenticated;
grant execute on function public.save_brand_asset(uuid,uuid,text,text,text,text,text[],boolean,text,text) to authenticated;

notify pgrst,'reload schema';