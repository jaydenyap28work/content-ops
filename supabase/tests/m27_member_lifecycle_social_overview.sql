-- M27 targeted lifecycle, selector, social metadata, and fail-closed verification.
begin;

do $$
declare
  v_workspace_id uuid;
  v_admin_user_id uuid;
  v_client_id uuid;
  v_content_id uuid;
  v_member_id uuid;
  v_linked_member_id uuid;
  v_clean_test_id uuid;
  v_history_test_id uuid;
  caught boolean;
begin
  select w.id into v_workspace_id from public.workspaces w where w.name='ContentOS' limit 1;
  select wm.user_profile_id into v_admin_user_id
    from public.workspace_members wm
    join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
    join public.roles r on r.id=wmr.role_id and r.code='super_admin'
    where wm.workspace_id=v_workspace_id and wm.status='active' limit 1;
  select id into v_client_id from public.clients where workspace_id=v_workspace_id and status='active' limit 1;
  select id into v_content_id from public.contents where workspace_id=v_workspace_id and record_status='active' limit 1;
  if v_workspace_id is null or v_admin_user_id is null then raise exception 'M27 verification scope unavailable'; end if;
  perform set_config('request.jwt.claim.sub',v_admin_user_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  select id into v_linked_member_id from public.team_members where workspace_id=v_workspace_id and auth_user_id=v_admin_user_id and status='active';
  if v_linked_member_id is null or not exists(select 1 from public.list_active_team_members(v_workspace_id,v_client_id) x where x.id=v_linked_member_id and x.login_status='enabled') then raise exception 'Active login-enabled Team Member missing from selector'; end if;
  update public.team_members set login_status='disabled' where id=v_linked_member_id;
  if not exists(select 1 from public.list_active_team_members(v_workspace_id,v_client_id) x where x.id=v_linked_member_id and x.login_status='disabled') then raise exception 'Active login-disabled Team Member missing from selector'; end if;
  update public.team_members set login_status='enabled' where id=v_linked_member_id;

  -- Active/no-login members remain eligible for every canonical new-assignment selector.
  v_member_id:=public.create_team_member(v_workspace_id,'ContentOS M27 Active No Login Test',null,null);
  if not exists(select 1 from public.list_active_team_members(v_workspace_id,v_client_id) x where x.id=v_member_id and x.login_status='not_enabled') then
    raise exception 'Active no-login Team Member missing from canonical selector';
  end if;

  -- Inactive removes new-assignment eligibility; reactivation reuses the same row without enabling login.
  perform public.set_team_member_active(v_member_id,false);
  if exists(select 1 from public.list_active_team_members(v_workspace_id,v_client_id) x where x.id=v_member_id) then
    raise exception 'Inactive Team Member leaked into canonical selector';
  end if;
  if exists(select 1 from public.list_idea_provider_options(v_client_id) x where x.team_member_id=v_member_id) then raise exception 'Inactive Team Member leaked into Idea Provider selector'; end if;
  perform public.set_team_member_active(v_member_id,true);
  if not exists(select 1 from public.team_members where id=v_member_id and status='active' and login_status='not_enabled' and auth_user_id is null) then
    raise exception 'Reactivation did not reuse the original no-login Team Member';
  end if;

  -- Existing assignment RPCs must fail closed for inactive members.
  perform public.set_team_member_active(v_member_id,false);
  caught:=false;
  begin
    perform public.save_task(null,v_workspace_id,'M27 inactive assignment probe',null,v_member_id,null,'pending',null);
  exception when others then caught:=true; end;
  if not caught then raise exception 'Task assignment accepted an inactive Team Member'; end if;
  if v_content_id is not null then
    caught:=false;
    begin perform public.assign_content_team_member(v_content_id,v_member_id,'owner',null);
    exception when others then caught:=true; end;
    if not caught then raise exception 'Content assignment accepted an inactive Team Member'; end if;
  end if;

  -- Hard delete remains limited to explicit, zero-history test records.
  v_clean_test_id:=public.create_team_member(v_workspace_id,'ContentOS M27 Clean Test',null,null);
  perform public.mark_test_team_member(v_clean_test_id,'ContentOS M27 Clean Test');
  perform public.hard_delete_test_team_member(v_clean_test_id,'DELETE');
  if exists(select 1 from public.team_members where id=v_clean_test_id) then raise exception 'Clean test member was not deleted'; end if;

  v_history_test_id:=public.create_team_member(v_workspace_id,'ContentOS M27 History Test',null,null);
  insert into public.tasks(workspace_id,title,assigned_team_member_id,status,created_by)
    values(v_workspace_id,'M27 history guard',v_history_test_id,'pending',v_admin_user_id);
  perform public.mark_test_team_member(v_history_test_id,'ContentOS M27 History Test');
  caught:=false;
  begin perform public.hard_delete_test_team_member(v_history_test_id,'DELETE');
  exception when others then caught:=true; end;
  if not caught then raise exception 'Hard delete removed a Team Member with business history'; end if;

  if not exists(select 1 from public.platforms where code='douyin' and is_active) then raise exception 'Douyin platform missing'; end if;
  if not exists(select 1 from public.social_accounts sa join public.platforms p on p.id=sa.platform_id
    join public.clients c on c.id=sa.client_id where p.code='douyin' and c.is_default_brand
    and sa.followers is null and sa.external_url is null and sa.account_handle is null) then raise exception 'Unverified LKSoft Douyin account metadata missing'; end if;
  if has_function_privilege('anon','public.list_active_team_members(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.set_team_member_active(uuid,boolean)','EXECUTE')
    or has_function_privilege('anon','public.set_team_member_access(uuid,boolean)','EXECUTE') then
    raise exception 'anon can execute M27 lifecycle functions';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.team_members'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.social_accounts'::regclass) then
    raise exception 'M27 protected tables must keep RLS enabled';
  end if;
end $$;

rollback;
