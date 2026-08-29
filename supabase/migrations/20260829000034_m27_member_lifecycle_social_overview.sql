-- M27: separate Team Member lifecycle from login access and add Douyin to the LKSoft account matrix.
-- Existing members, assignments, attribution, workflow history, and social account records remain in place.

alter table public.team_members drop constraint if exists team_members_login_status_check;
alter table public.team_members drop constraint if exists team_members_login_state_check;
alter table public.team_members add constraint team_members_login_status_check
  check(login_status in ('not_enabled','invited','enabled','disabled'));
alter table public.team_members add constraint team_members_login_state_check check(
  (login_status='not_enabled' and auth_user_id is null)
  or (login_status='invited' and email is not null and auth_user_id is null)
  or (login_status in ('enabled','disabled') and email is not null and auth_user_id is not null)
);

alter table public.user_lifecycle_audits drop constraint if exists user_lifecycle_audits_action_check;
alter table public.user_lifecycle_audits add constraint user_lifecycle_audits_action_check
  check(action in('deactivated','reactivated','hard_deleted','login_disabled','login_reactivated','member_deactivated','member_reactivated'));

-- Editing a profile never changes roster eligibility. Lifecycle changes use their dedicated RPC.
create or replace function public.update_team_member(
  target_team_member_id uuid,target_name text,target_job_title text,target_active boolean
) returns void language plpgsql security definer set search_path='' as $$
declare member_scope public.team_members%rowtype;
begin
  select * into member_scope from public.team_members where id=target_team_member_id for update;
  if member_scope.id is null or not public.is_workspace_super_admin(member_scope.workspace_id) then
    raise exception 'Only Super Admin can update Team Members';
  end if;
  if nullif(btrim(target_name),'') is null then raise exception 'Team Member name is required'; end if;
  update public.team_members
    set name=btrim(target_name),job_title=nullif(btrim(target_job_title),'')
    where id=member_scope.id;
end; $$;

-- Login access is independent from the Team Member's active/inactive roster status.
create or replace function public.set_team_member_access(target_team_member_id uuid,make_active boolean)
returns void language plpgsql security definer set search_path='' as $$
declare member_scope public.team_members%rowtype; membership public.workspace_members%rowtype;
  super_role_id uuid; active_super_admins integer;
begin
  select * into member_scope from public.team_members where id=target_team_member_id for update;
  if member_scope.id is null or not public.is_workspace_super_admin(member_scope.workspace_id) then
    raise exception 'Only Super Admin can manage login access';
  end if;
  if member_scope.auth_user_id is null then raise exception 'This Team Member has no login access'; end if;
  if make_active and member_scope.status<>'active' then
    raise exception 'Reactivate the Team Member before restoring login access';
  end if;
  select * into membership from public.workspace_members
    where workspace_id=member_scope.workspace_id and user_profile_id=member_scope.auth_user_id for update;
  if membership.id is null then raise exception 'Workspace membership not found'; end if;
  select id into super_role_id from public.roles where workspace_id=member_scope.workspace_id and code='super_admin';
  if not make_active and exists(select 1 from public.workspace_member_roles where workspace_member_id=membership.id and role_id=super_role_id) then
    select count(*) into active_super_admins from public.workspace_members wm
      join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
      where wm.workspace_id=member_scope.workspace_id and wm.status='active' and wmr.role_id=super_role_id;
    if active_super_admins<=1 then raise exception 'Cannot deactivate the last Super Admin'; end if;
  end if;
  update public.workspace_members set status=case when make_active then 'active' else 'deactivated' end,
    deactivated_at=case when make_active then null else now() end where id=membership.id;
  update public.user_profiles set status=case when make_active then 'active' else 'deactivated' end,
    deactivated_at=case when make_active then null else now() end where id=member_scope.auth_user_id;
  update public.team_members set login_status=case when make_active then 'enabled' else 'disabled' end
    where id=member_scope.id;
  insert into public.user_lifecycle_audits(workspace_id,actor_user_id,subject_team_member_id,
    subject_auth_user_id,subject_name,action,metadata)
  values(member_scope.workspace_id,auth.uid(),member_scope.id,member_scope.auth_user_id,member_scope.name,
    case when make_active then 'login_reactivated' else 'login_disabled' end,
    jsonb_build_object('member_status',member_scope.status,'previous_login_status',member_scope.login_status));
end; $$;

-- Roster lifecycle controls assignment eligibility. Deactivation also closes login access; reactivation does not restore it.
create or replace function public.set_team_member_active(target_team_member_id uuid,make_active boolean)
returns void language plpgsql security definer set search_path='' as $$
declare member_scope public.team_members%rowtype; membership public.workspace_members%rowtype;
  super_role_id uuid; active_super_admins integer;
begin
  select * into member_scope from public.team_members where id=target_team_member_id for update;
  if member_scope.id is null or not public.is_workspace_super_admin(member_scope.workspace_id) then
    raise exception 'Only Super Admin can manage Team Member status';
  end if;
  if make_active and member_scope.status='active' then return; end if;
  if not make_active and member_scope.status='inactive' then return; end if;
  if member_scope.auth_user_id is not null then
    select * into membership from public.workspace_members
      where workspace_id=member_scope.workspace_id and user_profile_id=member_scope.auth_user_id for update;
    if membership.id is null then raise exception 'Workspace membership not found'; end if;
    select id into super_role_id from public.roles where workspace_id=member_scope.workspace_id and code='super_admin';
    if not make_active and exists(select 1 from public.workspace_member_roles where workspace_member_id=membership.id and role_id=super_role_id) then
      select count(*) into active_super_admins from public.workspace_members wm
        join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
        where wm.workspace_id=member_scope.workspace_id and wm.status='active' and wmr.role_id=super_role_id;
      if active_super_admins<=1 then raise exception 'Cannot deactivate the last Super Admin'; end if;
    end if;
  end if;
  update public.team_members set status=case when make_active then 'active' else 'inactive' end,
    login_status=case when not make_active and auth_user_id is not null then 'disabled' else login_status end
    where id=member_scope.id;
  if not make_active and membership.id is not null then
    update public.workspace_members set status='deactivated',deactivated_at=now() where id=membership.id;
    update public.user_profiles set status='deactivated',deactivated_at=now() where id=member_scope.auth_user_id;
  end if;
  insert into public.user_lifecycle_audits(workspace_id,actor_user_id,subject_team_member_id,
    subject_auth_user_id,subject_name,action,metadata)
  values(member_scope.workspace_id,auth.uid(),member_scope.id,member_scope.auth_user_id,member_scope.name,
    case when make_active then 'member_reactivated' else 'member_deactivated' end,
    jsonb_build_object('previous_member_status',member_scope.status,'login_status_after',
      case when not make_active and member_scope.auth_user_id is not null then 'disabled' else member_scope.login_status end));
end; $$;

-- Canonical datasource for every new Team Member assignment selector.
create or replace function public.list_active_team_members(target_workspace_id uuid,target_client_id uuid default null)
returns table(id uuid,name text,job_title text,email text,auth_user_id uuid,login_status text,status text)
language sql stable security definer set search_path='' as $$
  select tm.id,tm.name,tm.job_title,tm.email,tm.auth_user_id,tm.login_status,tm.status
  from public.team_members tm
  where tm.workspace_id=target_workspace_id and tm.status='active'
    and public.is_internal_workspace_member(target_workspace_id)
    and (target_client_id is null or exists(
      select 1 from public.clients c where c.id=target_client_id and c.workspace_id=target_workspace_id
    ))
  order by tm.name;
$$;

create or replace function public.list_production_team_members(target_workspace_id uuid,target_client_id uuid)
returns table(id uuid,name text,job_title text,email text,auth_user_id uuid,login_status text,status text)
language sql stable security definer set search_path='' as $$
  select * from public.list_active_team_members(target_workspace_id,target_client_id);
$$;

-- Unknown handles are legitimate for unverified accounts; existing handles remain untouched.
alter table public.social_accounts alter column account_handle drop not null;
alter table public.social_accounts drop constraint if exists social_accounts_account_handle_check;
alter table public.social_accounts add constraint social_accounts_account_handle_check
  check(account_handle is null or btrim(account_handle)<>'');

-- Douyin is independent from TikTok. Unknown public metadata stays NULL and is never guessed as zero.
insert into public.platforms(code,name,is_active,sort_order) values('douyin','Douyin',true,80)
on conflict(code) do update set name=excluded.name,is_active=true;

with brand as (
  select id,name from public.clients where ownership_type='internal_brand' and is_default_brand limit 1
), platform as (
  select id from public.platforms where code='douyin'
)
insert into public.social_accounts(client_id,platform_id,account_name,account_handle,external_url,is_active,
  followers,followers_updated_at,followers_data_source,note)
select brand.id,platform.id,brand.name,null,null,true,null,null,'Pending verification',
  'Official Douyin account has not been verified.'
from brand cross join platform
where not exists(select 1 from public.social_accounts sa where sa.client_id=brand.id and sa.platform_id=platform.id);

revoke all on function public.set_team_member_active(uuid,boolean),public.list_active_team_members(uuid,uuid) from public,anon;
grant execute on function public.set_team_member_active(uuid,boolean),public.list_active_team_members(uuid,uuid) to authenticated;
revoke all on function public.set_team_member_access(uuid,boolean),public.update_team_member(uuid,text,text,boolean),
  public.list_production_team_members(uuid,uuid) from public,anon;
grant execute on function public.set_team_member_access(uuid,boolean),public.update_team_member(uuid,text,text,boolean),
  public.list_production_team_members(uuid,uuid) to authenticated;

notify pgrst,'reload schema';
