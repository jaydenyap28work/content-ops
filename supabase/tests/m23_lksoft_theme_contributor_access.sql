-- Read-only M23 schema, privilege, RLS, and pilot preservation verification.
with pilot_titles(title) as (values
 ('最近很多商家开始倒闭了，你怎样看？'),
 ('做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？'),
 ('不是已经有 SST 了吗？为什么安华又提 GST？'),
 ('你觉得一个企业里面，什么部门最重要？'),
 ('为什么公司名字叫 LKSOFT？'),
 ('你觉得怎样的企业或老板，会有很好的发展？'),
 ('很多人讲00后很难融入企业文化，你怎样看？')
), pilot as (
 select i.id idea_id,c.id content_id,c.content_code,c.current_status,c.planned_shoot_date,b.pack_segments
 from pilot_titles p join public.ideas i on i.title=p.title
 join public.contents c on c.source_idea_id=i.id
 join public.idea_shooting_briefs b on b.idea_id=i.id
), segments as (
 select count(*) segment_count,count(*) filter(where coalesce(btrim(segment->>'referenceScript'),'')<>'') reference_count
 from pilot cross join lateral jsonb_array_elements(pack_segments) segment
)
select jsonb_build_object(
 'role_exists',exists(select 1 from public.roles where code='idea_contributor' and name='Idea Contributor' and is_active),
 'provider_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='ideas' and column_name='idea_provider_team_member_id' and is_nullable='YES'),
 'provider_fk',exists(select 1 from pg_constraint where conrelid='public.ideas'::regclass and contype='f' and pg_get_constraintdef(oid) like '%idea_provider_team_member_id%team_members%'),
 'idea_rls',(select relrowsecurity from pg_class where oid='public.ideas'::regclass),
 'anon_denied',jsonb_build_object(
   'catalog',not has_function_privilege('anon','public.list_idea_submission_catalog(uuid)','execute'),
   'providers',not has_function_privilege('anon','public.list_idea_provider_options(uuid)','execute'),
   'save',not has_function_privilege('anon','public.save_idea_submission(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text)','execute')
 ),
 'rpcs',jsonb_build_object(
   'save',to_regprocedure('public.save_idea_submission(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text)') is not null,
   'catalog',to_regprocedure('public.list_idea_submission_catalog(uuid)') is not null,
   'providers',to_regprocedure('public.list_idea_provider_options(uuid)') is not null,
   'edit_guard',to_regprocedure('public.can_edit_idea_submission(uuid)') is not null
 ),
 'all_ideas_preserved',(select count(*) from public.ideas),
 'pilot_count',(select count(*) from pilot),
 'unique_contents',(select count(distinct content_id) from pilot),
 'unique_codes',(select count(distinct content_code) from pilot),
 'briefs',(select count(*) filter(where jsonb_array_length(pack_segments)>0) from pilot),
 'reference_lines',(select reference_count from segments),
 'planned_dates',(select jsonb_agg(planned_shoot_date order by planned_shoot_date) from pilot),
 'workflow',(select count(*) filter(where current_status is not null) from pilot),
 'provenance',(select count(*) filter(where idea_id is not null and content_id is not null) from pilot)
) as verification;