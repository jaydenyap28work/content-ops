-- Read-only M22 contract, RLS, and preservation verification.
with pilot as (
  select i.id idea_id,c.id content_id,c.content_code,c.current_status,c.planned_shoot_date,b.pack_segments
  from public.ideas i
  join public.contents c on c.source_idea_id=i.id
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
)
select jsonb_build_object(
  'team_nullable',jsonb_build_object(
    'email',(select is_nullable='YES' from information_schema.columns where table_schema='public' and table_name='team_members' and column_name='email'),
    'auth_user_id',(select is_nullable='YES' from information_schema.columns where table_schema='public' and table_name='team_members' and column_name='auth_user_id')
  ),
  'team_rpc',to_regprocedure('public.create_team_member(uuid,text,text,text)') is not null,
  'idea_rpc',to_regprocedure('public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text)') is not null,
  'anon_team_rpc_denied',not has_function_privilege('anon','public.create_team_member(uuid,text,text,text)','execute'),
  'anon_idea_rpc_denied',not has_function_privilege('anon','public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text)','execute'),
  'team_rls',coalesce((select relrowsecurity from pg_class where oid='public.team_members'::regclass),false),
  'idea_rls',coalesce((select relrowsecurity from pg_class where oid='public.ideas'::regclass),false),
  'pilot_count',(select count(*) from pilot),
  'codes',(select count(distinct content_code) from pilot),
  'briefs',(select count(*) filter(where jsonb_array_length(pack_segments)>0) from pilot),
  'reference_lines',(select sum(jsonb_array_length(pack_segments)) from pilot),
  'planned_dates',(select jsonb_agg(planned_shoot_date order by planned_shoot_date) from pilot),
  'workflow',(select count(*) filter(where current_status is not null) from pilot),
  'provenance',(select count(*) filter(where idea_id is not null and content_id is not null) from pilot)
) as verification;
