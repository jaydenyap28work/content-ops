-- M17: Ensure bulk owner/contributor targets have access to every selected Content scope.

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
      if nullif(target_value,'') is not null and not exists(
        select 1 from public.workspace_members wm
        where wm.workspace_id=item.workspace_id and wm.user_profile_id=target_value::uuid and wm.status='active'
          and (exists(select 1 from public.workspace_member_roles wmr join public.roles r on r.id=wmr.role_id where wmr.workspace_member_id=wm.id and r.code='super_admin' and r.is_active)
            or exists(select 1 from public.client_members cm where cm.workspace_member_id=wm.id and cm.client_id=item.client_id and cm.status='active'))
      ) then raise exception 'Owner does not have active Client access'; end if;
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
    if not exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id=item.workspace_id and wm.user_profile_id=target_user_id and wm.status='active'
        and (exists(select 1 from public.workspace_member_roles wmr join public.roles r on r.id=wmr.role_id where wmr.workspace_member_id=wm.id and r.code='super_admin' and r.is_active)
          or exists(select 1 from public.client_members cm where cm.workspace_member_id=wm.id and cm.client_id=item.client_id and cm.status='active'))
    ) then raise exception 'Contributor does not have active Client access'; end if;
    select id into role_id from public.contribution_roles where workspace_id=item.workspace_id and code=target_role_code and is_active;
    if role_id is null then raise exception 'Contribution role is unavailable'; end if;
    perform public.assign_content_contributor(item.id,target_user_id,role_id,null);
    changed:=changed+1;
  end loop;
  if changed<>cardinality(target_content_ids) then raise exception 'One or more selected Content records were not found'; end if;
  return changed;
end; $$;

revoke all on function public.bulk_update_production_items(uuid[],text,text),public.bulk_assign_content_contributor(uuid[],uuid,text) from public,anon;
grant execute on function public.bulk_update_production_items(uuid[],text,text),public.bulk_assign_content_contributor(uuid[],uuid,text) to authenticated;
notify pgrst,'reload schema';