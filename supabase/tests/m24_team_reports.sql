-- Read-only M24 contract, permission, event-source, and preservation verification.
with pilot as (
  select i.id idea_id,c.id content_id,c.content_code,c.current_status,c.planned_shoot_date,b.pack_segments
  from public.ideas i join public.contents c on c.source_idea_id=i.id
  join public.idea_shooting_briefs b on b.idea_id=i.id
  where i.title in (
    '最近很多商家开始倒闭了，你怎样看？',
    '做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？',
    '不是已经有 SST 了吗？为什么安华又提 GST？',
    '你觉得一个企业里面，什么部门最重要？',
    '为什么公司名字叫 LKSOFT？',
    '你觉得怎样的企业或老板，会有很好的发展？',
    '很多人讲00后很难融入企业文化，你怎样看？'
  )
), report_contract as (
  select wm.workspace_id,wm.user_profile_id
  from public.workspace_members wm join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
  join public.roles r on r.id=wmr.role_id and r.code='super_admin'
  where wm.status='active' limit 1
)
select jsonb_build_object(
  'planning_history_table',to_regclass('public.idea_planning_events') is not null,
  'planning_history_rls',(select relrowsecurity from pg_class where oid='public.idea_planning_events'::regclass),
  'planning_history_immutable',exists(select 1 from pg_trigger where tgrelid='public.idea_planning_events'::regclass and tgname='idea_planning_events_immutable' and tgenabled='O'),
  'report_rpc',to_regprocedure('public.list_team_report(uuid,timestamp with time zone,timestamp with time zone,uuid)') is not null,
  'anon_report_denied',not has_function_privilege('anon','public.list_team_report(uuid,timestamp with time zone,timestamp with time zone,uuid)','execute'),
  'authenticated_report_allowed',has_function_privilege('authenticated','public.list_team_report(uuid,timestamp with time zone,timestamp with time zone,uuid)','execute'),
  'backfilled_confirmations',(select count(*) from public.idea_planning_events where event_type='confirmed_for_production'),
  'ideas_preserved',(select count(*) from public.ideas),
  'pilot_count',(select count(*) from pilot),
  'unique_contents',(select count(distinct content_id) from pilot),
  'unique_codes',(select count(distinct content_code) from pilot),
  'briefs',(select count(*) filter(where jsonb_array_length(pack_segments)>0) from pilot),
  'reference_lines',(select sum(jsonb_array_length(pack_segments)) from pilot),
  'planned_dates',(select jsonb_agg(planned_shoot_date order by planned_shoot_date) from pilot),
  'workflow',(select count(*) filter(where current_status is not null) from pilot),
  'provenance',(select count(*) filter(where idea_id is not null and content_id is not null) from pilot),
  'production_assignments',(select count(*) from public.content_contributors),
  'shoot_scenes',(select count(*) from public.shoot_scenes),
  'tasks',(select count(*) from public.tasks),
  'analytics_snapshots',(select count(*) from public.analytics_snapshots),
  'equipment_proposals',(select count(*) from public.equipment_proposals)
) verification;
