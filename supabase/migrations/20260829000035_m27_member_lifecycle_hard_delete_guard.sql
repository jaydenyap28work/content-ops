-- M27 follow-up: repair the M26 zero-history test deletion guard to reference real history tables.
create or replace function public.hard_delete_test_team_member(target_team_member_id uuid,confirmation text)
returns void language plpgsql security definer set search_path='' as $$
declare
  member_scope public.team_members%rowtype;
  membership public.workspace_members%rowtype;
  super_role_id uuid;
  active_super_admins integer;
  linked_user_id uuid;
begin
  if confirmation<>'DELETE' then raise exception 'Type DELETE to confirm'; end if;
  select * into member_scope from public.team_members where id=target_team_member_id for update;
  if member_scope.id is null or not public.is_workspace_super_admin(member_scope.workspace_id) then
    raise exception 'Only Super Admin can permanently delete test users';
  end if;
  if not member_scope.is_test_account or not(
    lower(member_scope.name) like '%test%'
    or lower(coalesce(member_scope.email,'')) like '%+test@%'
    or lower(coalesce(member_scope.email,'')) like '%@example.com'
  ) then raise exception 'Only explicitly marked test accounts can be permanently deleted'; end if;

  linked_user_id:=member_scope.auth_user_id;
  if linked_user_id=auth.uid() then raise exception 'You cannot permanently delete your own active account'; end if;
  select * into membership from public.workspace_members
    where workspace_id=member_scope.workspace_id and user_profile_id=linked_user_id for update;
  select id into super_role_id from public.roles where workspace_id=member_scope.workspace_id and code='super_admin';
  if membership.id is not null and exists(
    select 1 from public.workspace_member_roles where workspace_member_id=membership.id and role_id=super_role_id
  ) then
    select count(*) into active_super_admins from public.workspace_members wm
      join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
      where wm.workspace_id=member_scope.workspace_id and wm.status='active' and wmr.role_id=super_role_id;
    if active_super_admins<=1 then raise exception 'Cannot delete the last Super Admin'; end if;
  end if;

  if exists(select 1 from public.ideas where idea_provider_team_member_id=member_scope.id or created_by=linked_user_id or owner_user_id=linked_user_id)
    or exists(select 1 from public.contents where owner_team_member_id=member_scope.id or created_by=linked_user_id or current_owner_user_id=linked_user_id)
    or exists(select 1 from public.content_contributors where team_member_id=member_scope.id or user_profile_id=linked_user_id)
    or exists(select 1 from public.workflow_events where actor_user_id=linked_user_id)
    or exists(select 1 from public.activity_logs where actor_user_id=linked_user_id)
    or exists(select 1 from public.tasks where assigned_team_member_id=member_scope.id or created_by=linked_user_id)
    or exists(select 1 from public.publications where assigned_publisher_user_id=linked_user_id or created_by=linked_user_id)
    or exists(select 1 from public.revision_requests where requested_by=linked_user_id)
    or exists(select 1 from public.idea_planning_events where team_member_id=member_scope.id or actor_user_id=linked_user_id)
    or exists(select 1 from public.content_attribution_events where from_team_member_id=member_scope.id or to_team_member_id=member_scope.id or actor_user_id=linked_user_id)
    or exists(select 1 from public.graphic_content_packs where created_by=linked_user_id)
    or exists(select 1 from public.customer_case_profiles where created_by=linked_user_id)
    or exists(select 1 from public.equipment_proposals where proposed_by=linked_user_id or decided_by=linked_user_id)
  then raise exception 'This member has business history and cannot be permanently deleted. Deactivate the member instead.';
  end if;

  insert into public.user_lifecycle_audits(workspace_id,actor_user_id,subject_name,action,metadata)
    values(member_scope.workspace_id,auth.uid(),member_scope.name,'hard_deleted',
      jsonb_build_object('team_member_id',member_scope.id,'auth_user_id',linked_user_id));
  delete from public.access_requests where linked_team_member_id=member_scope.id or auth_user_id=linked_user_id;
  if membership.id is not null then
    delete from public.client_members where workspace_member_id=membership.id;
    delete from public.workspace_member_roles where workspace_member_id=membership.id;
    delete from public.workspace_members where id=membership.id;
  end if;
  delete from public.team_members where id=member_scope.id;
  if linked_user_id is not null then
    delete from public.user_profiles where id=linked_user_id;
    delete from auth.users where id=linked_user_id;
  end if;
end; $$;

revoke all on function public.hard_delete_test_team_member(uuid,text) from public,anon;
grant execute on function public.hard_delete_test_team_member(uuid,text) to authenticated;
notify pgrst,'reload schema';
