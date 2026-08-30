-- ContentOS M28 follow-up: complete the explicitly requested targeted notification sources.

create or replace function public.dispatch_idea_confirmation_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
  if new.status='evaluating' and (tg_op='INSERT' or old.status is distinct from new.status) then
    for recipient in select distinct wm.user_profile_id from public.workspace_members wm
      join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id join public.roles r on r.id=wmr.role_id
      where wm.workspace_id=new.workspace_id and wm.status='active' and r.code='super_admin'
    loop
      perform public.insert_notification(new.workspace_id,recipient,'idea_confirmation','选题待老板确认',new.title,'idea',new.id,'/ideas/'||new.id,null);
    end loop;
  end if;
  return new;
end; $$;
create trigger ideas_confirmation_notify after insert or update of status on public.ideas
for each row execute function public.dispatch_idea_confirmation_notification();

create or replace function public.dispatch_activity_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; title_text text;
begin
  if new.content_id is not null and new.action in ('shoot_scheduled','shoot_rescheduled','shoot_schedule_cleared') then
    select title into title_text from public.contents where id=new.content_id;
    for recipient in select distinct cc.user_profile_id from public.content_contributors cc
      join public.contribution_roles cr on cr.id=cc.contribution_role_id
      where cc.content_id=new.content_id and cc.status='active' and cc.user_profile_id is not null
        and cr.code in ('owner','talent','director','shooter')
    loop
      perform public.insert_notification(new.workspace_id,recipient,'shoot_schedule_changed','拍摄排期已更新',title_text,'content',new.content_id,'/content/'||new.content_id,null);
    end loop;
  end if;
  return new;
end; $$;
create trigger activity_logs_notify after insert on public.activity_logs
for each row execute function public.dispatch_activity_notification();

create or replace function public.dispatch_task_due_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
  if new.assigned_team_member_id is not null and new.due_date is not null and new.status<>'completed'
    and (tg_op='INSERT' or old.due_date is distinct from new.due_date or old.assigned_team_member_id is distinct from new.assigned_team_member_id) then
    select auth_user_id into recipient from public.team_members where id=new.assigned_team_member_id and status='active';
    perform public.insert_notification(new.workspace_id,recipient,'task_due','待办到期提醒',new.title,'task',new.id,'/tasks','task_due');
  end if;
  return new;
end; $$;
create trigger tasks_due_notify after insert or update of due_date,assigned_team_member_id,status on public.tasks
for each row execute function public.dispatch_task_due_notification();

create or replace function public.notify_team_member_mention(
  target_team_member_id uuid,target_entity_type text,target_entity_id uuid,target_route text,target_body text
) returns uuid language plpgsql security definer set search_path='' as $$
declare member public.team_members%rowtype; workspace_scope uuid;
begin
  select * into member from public.team_members where id=target_team_member_id and status='active';
  if member.id is null or member.auth_user_id is null or not public.is_internal_workspace_member(member.workspace_id) then raise exception 'Mention recipient unavailable'; end if;
  if target_entity_type not in ('content','idea','team','equipment_proposal','task') or target_route not like '/%' then raise exception 'Unsupported mention target'; end if;
  if target_entity_type='content' and not public.can_view_content(target_entity_id) then raise exception 'Mention Content access denied'; end if;
  if target_entity_type='idea' and not exists(select 1 from public.ideas i where i.id=target_entity_id and i.workspace_id=member.workspace_id and public.can_view_idea(i.id)) then raise exception 'Mention Idea access denied'; end if;
  workspace_scope:=member.workspace_id;
  return public.insert_notification(workspace_scope,member.auth_user_id,'mention','你被提及',target_body,target_entity_type,target_entity_id,target_route,null);
end; $$;

revoke all on function public.dispatch_idea_confirmation_notification(),public.dispatch_activity_notification(),public.dispatch_task_due_notification() from public,anon,authenticated;
revoke all on function public.notify_team_member_mention(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.notify_team_member_mention(uuid,text,uuid,text,text) to authenticated;

notify pgrst,'reload schema';
