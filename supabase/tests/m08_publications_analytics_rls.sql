begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('f8000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase8-publisher@example.invalid','',now(),'{}','{}',now(),now());
insert into public.user_profiles(id,display_name,email) values('f8000000-0000-4000-8000-000000000001','Phase 8 Publisher','phase8-publisher@example.invalid');
insert into public.workspace_members(id,workspace_id,user_profile_id) values('f8100000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000001');
insert into public.workspace_member_roles(workspace_member_id,role_id,assigned_by)
select 'f8100000-0000-4000-8000-000000000001',id,(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1) from public.roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='publisher_marketing';
insert into public.clients(id,workspace_id,name,code,status) values
('f8200000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Phase 8 Client A','PHASE8-A','active'),
('f8200000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Phase 8 Client B','PHASE8-B','active');
insert into public.client_members(client_id,workspace_member_id,role_id,assigned_by)
select 'f8200000-0000-4000-8000-000000000001','f8100000-0000-4000-8000-000000000001',id,(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1) from public.roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='publisher_marketing';

create temporary table phase8_ids(key text primary key,id uuid not null); grant select,insert on phase8_ids to authenticated,anon;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1),'role','authenticated')::text,true); set local role authenticated;
insert into phase8_ids select 'content_a',public.save_content(null,'00000000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','Phase 8 Publishing Content',null,null,null,'M08 verification','normal','f8000000-0000-4000-8000-000000000001',null,null,null,'Rollback-only verification','{}');
insert into phase8_ids select 'content_b',public.save_content(null,'00000000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000002','Phase 8 Isolated Content',null,null,null,null,'normal',null,null,null,null,'Rollback-only isolation','{}');
insert into phase8_ids select 'publisher_assignment',public.assign_content_contributor((select id from phase8_ids where key='content_a'),'f8000000-0000-4000-8000-000000000001',(select id from public.contribution_roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='publisher'),null);
insert into phase8_ids select 'facebook_account',public.save_social_account(null,'f8200000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000201','Phase 8 Facebook','phase8-fb','https://facebook.example/phase8',true);
insert into phase8_ids select 'xhs_account',public.save_social_account(null,'f8200000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000202','Phase 8 XHS','phase8-xhs','https://xhs.example/phase8',true);
reset role;
select set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='approved' where id in(select id from phase8_ids where key in('content_a','content_b')); select set_config('contentos.workflow_action','',true);

select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1),'role','authenticated')::text,true); set local role authenticated;
insert into phase8_ids select 'facebook_publication',public.create_publication((select id from phase8_ids where key='content_a'),'00000000-0000-4000-8000-000000000201',(select id from phase8_ids where key='facebook_account'),'f8000000-0000-4000-8000-000000000001',true,'Facebook required');
insert into phase8_ids select 'xhs_publication',public.create_publication((select id from phase8_ids where key='content_a'),'00000000-0000-4000-8000-000000000202',(select id from phase8_ids where key='xhs_account'),'f8000000-0000-4000-8000-000000000001',true,'XHS required');
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub','f8000000-0000-4000-8000-000000000001','role','authenticated')::text,true); set local role authenticated;
select public.schedule_publication((select id from phase8_ids where key='facebook_publication'),'draft','2026-08-23 10:00+08','FB schedule');
do $$ begin begin perform public.schedule_publication((select id from phase8_ids where key='facebook_publication'),'draft','2026-08-23 11:00+08',null); raise exception '__stale_schedule_allowed__'; exception when others then if sqlerrm='__stale_schedule_allowed__' then raise; end if; end; end $$;
select public.mark_publication_published((select id from phase8_ids where key='facebook_publication'),'scheduled','2026-08-23 10:05+08','https://facebook.example/post/1','Published manually');
do $$ begin if public.content_publication_state((select id from phase8_ids where key='content_a'))<>'partially_published' then raise exception 'FB-only publish must be partial'; end if; end $$;
select public.schedule_publication((select id from phase8_ids where key='xhs_publication'),'draft','2026-08-23 12:00+08','XHS schedule');
select public.mark_publication_failed((select id from phase8_ids where key='xhs_publication'),'scheduled','Platform upload rejected','Retry later');
do $$ begin if public.content_publication_state((select id from phase8_ids where key='content_a'))<>'needs_attention' then raise exception 'Failed publication must need attention'; end if; end $$;
select public.schedule_publication((select id from phase8_ids where key='xhs_publication'),'failed','2026-08-24 12:00+08','Retry');
select public.mark_publication_published((select id from phase8_ids where key='xhs_publication'),'scheduled','2026-08-24 12:02+08','https://xhs.example/post/1','Retry succeeded');
do $$ begin if public.content_publication_state((select id from phase8_ids where key='content_a'))<>'fully_published' then raise exception 'Both platforms must be fully published'; end if; end $$;

select public.add_manual_analytics_snapshot((select id from phase8_ids where key='facebook_publication'),now(),'24h',1000,null,1200,50,5,3,null,10,null,'{"video_completion_rate":0.42}',null);
select public.add_manual_analytics_snapshot((select id from phase8_ids where key='facebook_publication'),now(),'7d',2000,1800,2400,90,8,7,14,20,4,'{}',null);
select public.add_manual_analytics_snapshot((select id from phase8_ids where key='facebook_publication'),now(),'30d',3000,2500,3600,130,12,10,22,30,7,'{}',null);
select public.add_manual_analytics_snapshot((select id from phase8_ids where key='facebook_publication'),now(),'current',3200,null,null,140,13,11,null,null,null,'{}','Current manual capture');
select public.add_manual_analytics_snapshot((select id from phase8_ids where key='xhs_publication'),now(),'24h',800,null,900,80,6,4,18,null,3,'{}',null);
select public.add_manual_analytics_snapshot((select id from phase8_ids where key='xhs_publication'),now(),'7d',1500,null,1700,150,11,8,35,null,8,'{}',null);
select public.add_manual_analytics_snapshot((select id from phase8_ids where key='xhs_publication'),now(),'30d',2300,null,2600,220,17,12,50,null,13,'{}',null);
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1),'role','authenticated')::text,true); set local role authenticated;
select public.complete_content_analytics((select id from phase8_ids where key='content_a'),'analytics_tracking','Strategy review complete');
do $$ begin
  if (select count(*) from public.publications where content_id=(select id from phase8_ids where key='content_a'))<>2 then raise exception 'Multiple publications failed'; end if;
  if (select count(*) from public.analytics_snapshots where publication_id=(select id from phase8_ids where key='facebook_publication'))<>4 then raise exception 'Snapshot history failed'; end if;
  if not exists(select 1 from public.analytics_snapshots where publication_id=(select id from phase8_ids where key='facebook_publication') and snapshot_type='24h' and reach is null and saves_or_collects is null) then raise exception 'Unsupported metrics must stay null'; end if;
  if (select current_status from public.contents where id=(select id from phase8_ids where key='content_a'))<>'completed' then raise exception 'Content completion failed'; end if;
  begin update public.analytics_snapshots set likes=0 where publication_id=(select id from phase8_ids where key='facebook_publication'); raise exception '__snapshot_mutable__'; exception when others then if sqlerrm='__snapshot_mutable__' then raise; end if; end;
end $$;
reset role;

-- Client-A-only Publisher cannot see or mutate Client B.
select set_config('request.jwt.claims',jsonb_build_object('sub','f8000000-0000-4000-8000-000000000001','role','authenticated')::text,true); set local role authenticated;
do $$ begin if exists(select 1 from public.publications where client_id='f8200000-0000-4000-8000-000000000002') or exists(select 1 from public.analytics_snapshots where client_id='f8200000-0000-4000-8000-000000000002') then raise exception 'Cross-client RLS failed'; end if; end $$;
reset role;

-- Client role and anon stay denied even with Client membership.
delete from public.workspace_member_roles where workspace_member_id='f8100000-0000-4000-8000-000000000001';
delete from public.client_members where workspace_member_id='f8100000-0000-4000-8000-000000000001';
insert into public.workspace_member_roles(workspace_member_id,role_id,assigned_by) select 'f8100000-0000-4000-8000-000000000001',id,(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1) from public.roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='client_viewer';
insert into public.client_members(client_id,workspace_member_id,role_id,assigned_by) select 'f8200000-0000-4000-8000-000000000001','f8100000-0000-4000-8000-000000000001',id,(select id from public.user_profiles where lower(email)='jaydenyap28work@gmail.com' limit 1) from public.roles where workspace_id='00000000-0000-4000-8000-000000000001' and code='client_viewer';
select set_config('request.jwt.claims',jsonb_build_object('sub','f8000000-0000-4000-8000-000000000001','role','authenticated')::text,true); set local role authenticated;
do $$ begin if exists(select 1 from public.publications) or exists(select 1 from public.analytics_snapshots) then raise exception 'Client role deny failed'; end if; end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('role','anon')::text,true); set local role anon;
do $$ begin if exists(select 1 from public.publications) or exists(select 1 from public.analytics_snapshots) or exists(select 1 from public.social_accounts) then raise exception 'Anon RLS failed'; end if; end $$;
reset role;
rollback;
