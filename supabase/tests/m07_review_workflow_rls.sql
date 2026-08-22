-- Rollback-only M07 verification. It uses isolated Auth actors and leaves zero residue.
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('f7000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase7-editor@example.invalid','',now(),'{}','{}',now(),now()),
('f7000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase7-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.user_profiles(id,display_name,email) values
('f7000000-0000-4000-8000-000000000001','Phase 7 Editor','phase7-editor@example.invalid'),
('f7000000-0000-4000-8000-000000000002','Phase 7 Reviewer','phase7-reviewer@example.invalid');
insert into public.workspace_members(id,workspace_id,user_profile_id) values
('f7100000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000001'),
('f7100000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000002');
insert into public.workspace_member_roles(workspace_member_id,role_id,assigned_by)
select 'f7100000-0000-4000-8000-000000000001',id,'f7000000-0000-4000-8000-000000000001' from public.roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='editor';
-- Reviewer has an internal workspace role but review power still comes from assignment + stage.
insert into public.workspace_member_roles(workspace_member_id,role_id,assigned_by)
select 'f7100000-0000-4000-8000-000000000002',id,'f7000000-0000-4000-8000-000000000001' from public.roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='strategist_content_planner';
insert into public.clients(id,workspace_id,name,code,status) values
('f7200000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Phase 7 Client A','PHASE7-A','active'),
('f7200000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Phase 7 Client B','PHASE7-B','active');
insert into public.client_members(client_id,workspace_member_id,role_id,assigned_by)
select client_id,member_id,r.id,'f7000000-0000-4000-8000-000000000001'::uuid from (
  values
  ('f7200000-0000-4000-8000-000000000001'::uuid,'f7100000-0000-4000-8000-000000000001'::uuid,'editor'),
  ('f7200000-0000-4000-8000-000000000001'::uuid,'f7100000-0000-4000-8000-000000000002'::uuid,'strategist_content_planner')
) v(client_id,member_id,code) join public.roles r on r.workspace_id='00000000-0000-4000-8000-000000000001' and r.code=v.code;

-- Create fixtures as the bound work Super Admin.
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1),'role','authenticated')::text,true);
set local role authenticated;
create temporary table phase7_ids(key text primary key,id uuid not null);
grant select,insert on phase7_ids to authenticated,anon;
insert into phase7_ids select 'content_a',public.save_content(null,'00000000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001','Phase 7 Workflow Content',null,null,null,'M07 verification','normal','f7000000-0000-4000-8000-000000000001',null,null,null,'Rollback-only verification','{}');
insert into phase7_ids select 'content_b',public.save_content(null,'00000000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000002','Phase 7 Isolated Content',null,null,null,'Isolation','normal',null,null,null,null,'Rollback-only verification','{}');
insert into phase7_ids select 'editor_assignment',public.assign_content_contributor((select id from phase7_ids where key='content_a'),'f7000000-0000-4000-8000-000000000001',(select id from public.contribution_roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='editor'),null);
insert into phase7_ids select 'editor_reviewer_assignment',public.assign_content_contributor((select id from phase7_ids where key='content_a'),'f7000000-0000-4000-8000-000000000001',(select id from public.contribution_roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='reviewer'),null);
insert into phase7_ids select 'reviewer_assignment',public.assign_content_contributor((select id from phase7_ids where key='content_a'),'f7000000-0000-4000-8000-000000000002',(select id from public.contribution_roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='reviewer'),null);
select public.configure_approval_requirement((select id from phase7_ids where key='content_a'),'internal_video',true,'f7000000-0000-4000-8000-000000000002',null);
select public.configure_approval_requirement((select id from phase7_ids where key='content_a'),'client',true,'f7000000-0000-4000-8000-000000000002',null);
select public.configure_approval_requirement((select id from phase7_ids where key='content_a'),'topic',true,'f7000000-0000-4000-8000-000000000002','Pilot override check');
select public.override_approval_requirement((select id from public.content_approval_requirements where content_id=(select id from phase7_ids where key='content_a') and approval_type='topic'),'Pilot exception approved by Super Admin');
select public.create_script_version((select id from phase7_ids where key='content_a'),'Script V1','submitted','Initial');
reset role;

-- Put the fixture at Editing through the existing guarded actions.
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1),'role','authenticated')::text,true); set local role authenticated;
select * from public.perform_content_workflow_action((select id from phase7_ids where key='content_a'),'mark_ready_to_shoot','draft',null);
reset role;
select set_config('contentos.workflow_action','allowed',true);
update public.contents set current_status='editing' where id=(select id from phase7_ids where key='content_a');
select set_config('contentos.workflow_action','',true);

-- Editor submits First Cut; duplicate stale submission must fail.
select set_config('request.jwt.claims',jsonb_build_object('sub','f7000000-0000-4000-8000-000000000001','role','authenticated')::text,true); set local role authenticated;
select public.submit_first_cut((select id from phase7_ids where key='content_a'),'editing','https://drive.example/first-cut',null,null,'V1');
do $$ begin begin perform public.submit_first_cut((select id from phase7_ids where key='content_a'),'editing','https://drive.example/duplicate',null,null,null); raise exception '__stale_allowed__'; exception when others then if sqlerrm='__stale_allowed__' then raise; end if; end; end $$;
reset role;

-- Required approval rejects the submitter even when temporarily assigned as Reviewer.
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1),'role','authenticated')::text,true); set local role authenticated;
select public.configure_approval_requirement((select id from phase7_ids where key='content_a'),'internal_video',true,'f7000000-0000-4000-8000-000000000001',null);
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','f7000000-0000-4000-8000-000000000001','role','authenticated')::text,true); set local role authenticated;
create or replace function pg_temp.assert_self_approval() returns void language plpgsql as 'begin begin perform public.start_content_review((select id from phase7_ids where key=''content_a''),''first_cut_submitted'',null); perform public.approve_content_stage((select id from phase7_ids where key=''content_a''),''internal_video'',''media_version'',(select id from public.media_versions where content_id=(select id from phase7_ids where key=''content_a'') limit 1),''internal_review'',null,null); raise exception ''__self_approval_allowed__''; exception when others then if sqlerrm=''__self_approval_allowed__'' then raise; end if; end; end;'; select pg_temp.assert_self_approval();
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1),'role','authenticated')::text,true); set local role authenticated;
select public.configure_approval_requirement((select id from phase7_ids where key='content_a'),'internal_video',true,'f7000000-0000-4000-8000-000000000002',null);
select set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='first_cut_submitted' where id=(select id from phase7_ids where key='content_a'); select set_config('contentos.workflow_action','',true);
reset role;

-- Assigned Reviewer starts review and requests revision.
select set_config('request.jwt.claims',jsonb_build_object('sub','f7000000-0000-4000-8000-000000000002','role','authenticated')::text,true); set local role authenticated;
select public.start_content_review((select id from phase7_ids where key='content_a'),'first_cut_submitted',null);
select public.request_content_revision((select id from phase7_ids where key='content_a'),'internal_review','pacing','Tighten opening',null);
reset role;

-- Editor resolves with V2; Reviewer approves the exact V2.
select set_config('request.jwt.claims',jsonb_build_object('sub','f7000000-0000-4000-8000-000000000001','role','authenticated')::text,true); set local role authenticated;
select public.start_content_revision((select id from phase7_ids where key='content_a'),'revision_required',null);
select public.submit_content_revision((select id from phase7_ids where key='content_a'),'editing','https://drive.example/revision-2',null,null,'V2','Pacing resolved');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','f7000000-0000-4000-8000-000000000002','role','authenticated')::text,true); set local role authenticated;
select public.approve_content_stage((select id from phase7_ids where key='content_a'),'internal_video','media_version',(select id from public.media_versions where content_id=(select id from phase7_ids where key='content_a') order by version_number desc limit 1),'internal_review','Approved',null);
select public.send_content_to_client_review((select id from phase7_ids where key='content_a'),'internal_review','Ready for client');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1),'role','authenticated')::text,true); set local role authenticated;
select public.record_external_approval((select id from phase7_ids where key='content_a'),'client','media_version',(select id from public.media_versions where content_id=(select id from phase7_ids where key='content_a') order by version_number desc limit 1),'client_review','LKSoft Client Approver','whatsapp',now(),'Approved in client chat','https://evidence.example/client-approval');

do $$ begin
  if (select count(*) from public.script_versions where content_id=(select id from phase7_ids where key='content_a'))<>1 then raise exception 'Script history failed'; end if;
  if (select count(*) from public.media_versions where content_id=(select id from phase7_ids where key='content_a'))<>2 then raise exception 'Media history failed'; end if;
  if not exists(select 1 from public.revision_requests where content_id=(select id from phase7_ids where key='content_a') and status='resolved' and resulting_media_version_id is not null) then raise exception 'Revision resolution failed'; end if;
  if (select current_status from public.contents where id=(select id from phase7_ids where key='content_a'))<>'approved' then raise exception 'Approval did not advance status'; end if;
  if not exists(select 1 from public.approvals where content_id=(select id from phase7_ids where key='content_a') and approval_type='client' and external_approver_name='LKSoft Client Approver' and channel='whatsapp' and approver_user_id is null and evidence_visibility='internal') then raise exception 'External approval identity or evidence boundary failed'; end if;
  if not exists(select 1 from public.activity_logs where content_id=(select id from phase7_ids where key='content_a') and action='approval_overridden' and metadata->>'reason'='Pilot exception approved by Super Admin') then raise exception 'Override audit failed'; end if;
  if exists(select 1 from public.approvals where content_id=(select id from phase7_ids where key='content_a') and approval_type='topic') then raise exception 'Override must not fabricate an Approval'; end if;
  begin update public.media_versions set note='tamper' where content_id=(select id from phase7_ids where key='content_a'); raise exception '__media_mutable__'; exception when others then if sqlerrm='__media_mutable__' then raise; end if; end;
end $$;

-- Cross-client and Client-role projections remain fail-closed.
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','f7000000-0000-4000-8000-000000000002','role','authenticated')::text,true); set local role authenticated;
create or replace function pg_temp.assert_cross_client_denied() returns void language plpgsql as 'begin begin perform public.create_script_version((select id from phase7_ids where key=''content_b''),''Leak'',''draft'',null); raise exception ''__cross_client_allowed__''; exception when others then if sqlerrm=''__cross_client_allowed__'' then raise; end if; end; end;'; select pg_temp.assert_cross_client_denied();
reset role;
select set_config('request.jwt.claims',jsonb_build_object('role','anon')::text,true); set local role anon;
do $$ begin if exists(select 1 from public.script_versions) or exists(select 1 from public.media_versions) or exists(select 1 from public.approvals) then raise exception 'Anon RLS failed'; end if; end $$;
reset role;
rollback;
