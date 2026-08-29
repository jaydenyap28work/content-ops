begin;

create temp table m25_ctx on commit drop as
select wm.workspace_id,wm.user_profile_id admin_id,
  '25000000-0000-4000-8000-000000000001'::uuid applicant_id,
  '25000000-0000-4000-8000-000000000002'::uuid second_applicant_id
from public.workspace_members wm
join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
join public.roles r on r.id=wmr.role_id and r.code='super_admin'
where wm.status='active' limit 1;

grant select on m25_ctx to authenticated;
do $$ begin if not exists(select 1 from m25_ctx) then raise exception 'M25 Super Admin fixture unavailable'; end if; end $$;

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select applicant_id,'authenticated','authenticated','m25-access-probe@example.invalid',now(),'{}','{"full_name":"M25 Access Probe"}',now(),now() from m25_ctx;
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select second_applicant_id,'authenticated','authenticated','m25-second-probe@example.invalid',now(),'{}','{"full_name":"M25 Second Probe"}',now(),now() from m25_ctx;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select applicant_id::text from m25_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare payload jsonb; denied boolean:=false; begin
  payload:=public.ensure_my_access_request((select workspace_id from m25_ctx));
  if payload->>'status'<>'pending' then raise exception 'Unknown Google user did not enter pending state'; end if;
  if exists(select 1 from public.workspaces) or exists(select 1 from public.contents) then raise exception 'Pending applicant can read Workspace data'; end if;
  begin update public.access_requests set assigned_role_id=(select id from public.roles limit 1) where auth_user_id=(select auth.uid());
  exception when others then denied:=true; end;
  if not denied then raise exception 'Applicant forged assigned role'; end if;
end $$;

select set_config('request.jwt.claim.sub',(select second_applicant_id::text from m25_ctx),true);
select public.ensure_my_access_request((select workspace_id from m25_ctx));

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select admin_id::text from m25_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare payload jsonb; begin
  payload:=public.review_access_request(
    (select id from public.access_requests where auth_user_id=(select applicant_id from m25_ctx)),
    'approved','idea_contributor',null,true,null
  );
  if payload->>'status'<>'approved' then raise exception 'Atomic approval failed'; end if;
  if not exists(select 1 from public.access_request_audits a where a.access_request_id=(payload->>'id')::uuid and a.actor_user_id=(select admin_id from m25_ctx) and a.assigned_role_code='idea_contributor') then raise exception 'Approval audit missing'; end if;
end $$;

select set_config('request.jwt.claim.sub',(select applicant_id::text from m25_ctx),true);
do $$ declare denied boolean:=false; begin
  if (public.ensure_my_access_request((select workspace_id from m25_ctx))->>'status')<>'authorized' then raise exception 'Approved applicant did not become authorized'; end if;
  begin perform public.review_access_request((select id from public.access_requests where auth_user_id=(select second_applicant_id from m25_ctx)),'approved','super_admin',null,true,null);
  exception when others then denied:=true; end;
  if not denied then raise exception 'Idea Contributor granted Super Admin'; end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select admin_id::text from m25_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare payload jsonb; begin
  payload:=public.review_access_request(
    (select id from public.access_requests where auth_user_id=(select second_applicant_id from m25_ctx)),
    'approved','super_admin',null,true,null
  );
  if not exists(select 1 from public.access_request_audits a where a.access_request_id=(payload->>'id')::uuid and a.actor_user_id=(select admin_id from m25_ctx) and a.assigned_role_code='super_admin') then raise exception 'Super Admin grant audit missing'; end if;
end $$;

rollback;
select 'rollback_clean' result;
