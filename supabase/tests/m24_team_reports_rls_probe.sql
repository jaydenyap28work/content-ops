begin;
create temp table m24_ctx on commit drop as
select wm.workspace_id,wm.user_profile_id user_id,wm.id membership_id
from public.workspace_members wm join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
join public.roles r on r.id=wmr.role_id and r.code='super_admin'
where wm.status='active' limit 1;
grant select on m24_ctx to authenticated;
do $$ begin if not exists(select 1 from m24_ctx) then raise exception 'M24 report fixture unavailable'; end if; end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from m24_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare payload jsonb; begin
  payload:=public.list_team_report((select workspace_id from m24_ctx),now()-interval '30 days',now()+interval '1 day',null);
  if jsonb_typeof(payload->'members')<>'array' or jsonb_typeof(payload->'actions')<>'array' then
    raise exception 'M24 report payload contract failed';
  end if;
end $$;

reset role;
create temp table m24_roles on commit drop as
select wmr.* from public.workspace_member_roles wmr where wmr.workspace_member_id=(select membership_id from m24_ctx);
delete from public.workspace_member_roles where workspace_member_id=(select membership_id from m24_ctx);
insert into public.workspace_member_roles(workspace_member_id,role_id,assigned_by)
select x.membership_id,r.id,x.user_id from m24_ctx x join public.roles r on r.workspace_id=x.workspace_id and r.code='idea_contributor';

set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from m24_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare denied boolean:=false; begin
  begin perform public.list_team_report((select workspace_id from m24_ctx),now()-interval '30 days',now()+interval '1 day',null);
  exception when others then denied:=true; end;
  if not denied then raise exception 'Idea Contributor accessed Team Report'; end if;
end $$;
rollback;
select 'rollback_clean' result;
