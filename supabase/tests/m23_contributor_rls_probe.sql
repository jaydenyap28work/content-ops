begin;
create temp table m23_ctx on commit drop as
select wm.user_profile_id user_id,wm.id membership_id,wm.workspace_id,
  c.id client_id,own_tm.id provider_id,
  (select tm.id from public.team_members tm where tm.workspace_id=wm.workspace_id and tm.status='active' and tm.id<>own_tm.id limit 1) other_provider_id,
  (select i.id from public.ideas i where i.workspace_id=wm.workspace_id order by i.created_at limit 1) other_idea_id,
  (select count(*) from public.ideas i where i.workspace_id=wm.workspace_id) total_ideas
from public.workspace_members wm
join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
join public.roles r on r.id=wmr.role_id and r.code='super_admin'
join public.clients c on c.workspace_id=wm.workspace_id and c.ownership_type='internal_brand' and c.is_default_brand and c.status='active'
join public.team_members own_tm on own_tm.workspace_id=wm.workspace_id and own_tm.auth_user_id=wm.user_profile_id and own_tm.status='active'
where wm.status='active' limit 1;
grant select on m23_ctx to authenticated;

do $$ begin if not exists(select 1 from m23_ctx) then raise exception 'RLS probe fixture unavailable'; end if; end $$;
create temp table m23_role_backup on commit drop as select wmr.* from public.workspace_member_roles wmr join m23_ctx x on x.membership_id=wmr.workspace_member_id;
delete from public.workspace_member_roles where workspace_member_id=(select membership_id from m23_ctx);
insert into public.workspace_member_roles(workspace_member_id,role_id,assigned_by)
select x.membership_id,r.id,x.user_id from m23_ctx x join public.roles r on r.workspace_id=x.workspace_id and r.code='idea_contributor';

set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from m23_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);

do $$
declare x m23_ctx%rowtype; saved uuid; denied boolean; visible_count integer;
begin
  select * into x from m23_ctx;
  if public.is_internal_workspace_member(x.workspace_id) then raise exception 'Contributor leaked into internal membership'; end if;
  select count(*) into visible_count from public.ideas where workspace_id=x.workspace_id;
  if visible_count<>x.total_ideas then raise exception 'Contributor cannot view whole Idea pool'; end if;
  if exists(select 1 from public.contents where workspace_id=x.workspace_id) then raise exception 'Contributor can read Production Content'; end if;
  if jsonb_array_length(public.list_idea_submission_catalog(x.workspace_id)->'clients')<>1 then raise exception 'Contributor catalog scope mismatch'; end if;
  if (select count(*) from public.list_idea_provider_options(x.client_id))<>1 then raise exception 'Contributor provider options are not identity-bound'; end if;

  saved:=public.save_idea_submission(null,x.workspace_id,x.client_id,'M23 Contributor Rollback Probe','','','','','',null,'','',x.provider_id,'','{}','{}','[]',null,null,'','');
  perform public.save_idea_submission(saved,x.workspace_id,x.client_id,'M23 Contributor Rollback Probe Updated','','','','','',null,'','',x.provider_id,'','{}','{}','[]',null,null,'','');
  if not exists(select 1 from public.ideas where id=saved and title='M23 Contributor Rollback Probe Updated' and created_by=x.user_id and idea_provider_team_member_id=x.provider_id) then raise exception 'Contributor own Idea round-trip failed'; end if;

  denied:=false;
  begin
    perform public.save_idea_submission(x.other_idea_id,x.workspace_id,x.client_id,'Forged Edit','','','','','',null,'','',x.provider_id,'','{}','{}','[]',null,null,'','');
  exception when others then denied:=true; end;
  if not denied then raise exception 'Contributor edited another Idea'; end if;

  if x.other_provider_id is not null then
    denied:=false;
    begin
      perform public.save_idea_submission(null,x.workspace_id,x.client_id,'Forged Provider','','','','','',null,'','',x.other_provider_id,'','{}','{}','[]',null,null,'','');
    exception when others then denied:=true; end;
    if not denied then raise exception 'Contributor forged provider identity'; end if;
  end if;

  denied:=false;
  begin perform public.confirm_idea_for_production_v2(saved,null); exception when others then denied:=true; end;
  if not denied then raise exception 'Contributor confirmed an Idea'; end if;

  create temp table m23_saved_idea(id uuid) on commit drop;
  insert into m23_saved_idea values(saved);
end $$;

reset role;
update public.ideas set planning_status='confirmed',status='approved' where id=(select id from m23_saved_idea);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from m23_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare x m23_ctx%rowtype; denied boolean:=false; begin
  select * into x from m23_ctx;
  begin
    perform public.save_idea_submission((select id from m23_saved_idea),x.workspace_id,x.client_id,'Late Edit','','','','','',null,'','',x.provider_id,'','{}','{}','[]',null,null,'','');
  exception when others then denied:=true; end;
  if not denied then raise exception 'Contributor edited a confirmed Idea'; end if;
end $$;
rollback;
select 'rollback_clean' result;